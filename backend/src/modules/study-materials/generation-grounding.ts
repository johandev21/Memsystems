import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { sourceChunks, sources } from '../../database/schema';
import { DRIZZLE } from '../database/database.module';
import {
  createCitationEvidence,
  type CitationEvidence,
} from '../chat/chat-citations';
import { stripChunkContentHeader } from '../ai/chunking.service';
import {
  RetrievalService,
  type RetrievalRequest,
  type RetrievedChunk,
} from '../ai/retrieval.service';
import type { RetrievalTrace } from '../ai/retrieval-trace';
import type { StudyMaterialKind } from './shapes';

/**
 * How many chunks one selected Source contributes to a Generation. Retrieval
 * is planned per section (below), and the per-source budget is spent round
 * robin across those passes, so a long Source's evidence spans its whole
 * range instead of clustering at the head.
 */
export const GENERATION_EVIDENCE_CHUNKS_PER_SOURCE = 16;

/**
 * Retrieval passes planned per Source. One pass per section, capped: a source
 * with more sections than the cap has its sections grouped into that many
 * contiguous buckets, each searched with the bucket's headings, so no section
 * is silently dropped from the plan.
 */
export const GENERATION_MAX_SECTION_PASSES_PER_SOURCE = 8;

/**
 * Retrieval passes per Generation, across every selected Source. The cap is
 * shared fairly: with many selected sources each gets one pass (the previous
 * one-bounded-set-per-source behavior), while a single long source gets the
 * full per-source depth.
 */
export const GENERATION_MAX_RETRIEVAL_PASSES = 16;

/**
 * Retrieval calls run concurrently up to this bound. Each pass is an
 * embedding call plus a cross-encoder call against the provider, so the bound
 * keeps a many-section Generation from hammering the provider while still
 * completing well inside the stream's stall timeout.
 */
export const GENERATION_RETRIEVAL_CONCURRENCY = 4;

/** A pass query is a search query, not an essay; cap it like the rewriter does. */
export const GENERATION_MAX_PASS_QUERY_CHARS = 600;

/** The total source text a Generation prompt carries. */
export const GENERATION_MAX_PROMPT_SOURCE_CHARS = 100_000;

/**
 * The floor a source's share of the prompt budget can shrink to when many
 * sources compete for it. Every selected source keeps a readable excerpt, so
 * the tail of the selection order is never dropped wholesale.
 */
export const GENERATION_MIN_SOURCE_TEXT_CHARS = 2_000;

/** One selected Source with the evidence retrieved for it, in chunk order. */
export interface GroundedSource {
  id: string;
  title: string;
  kind: string;
  url: string | null;
  chunks: RetrievedChunk[];
}

/** A selected Source that contributed no evidence to the Generation. */
export interface UnavailableSource {
  id: string;
  title: string;
  kind: string;
}

/**
 * The grounding a Generation is built from: the evidence per source, the flat
 * evidence list with its citation keys, the selected sources that could not
 * contribute, and one retrieval trace per pass.
 */
export interface GenerationGrounding {
  sources: GroundedSource[];
  evidence: CitationEvidence[];
  unavailableSources: UnavailableSource[];
  /** Selected sources that are marked degraded at ingestion. */
  degradedSources: UnavailableSource[];
  traces: RetrievalTrace[];
}

export interface GenerationGroundingRequest {
  notebookId: string;
  kind: StudyMaterialKind;
  brief: string;
  sourceIds: string[];
}

/** A section of a selected source, as the chunk metadata describes it. */
interface SourceSection {
  headingPath: string[];
}

interface PlannedPass {
  sourceId: string;
  query: string;
}

/**
 * Plans and runs the retrieval passes a Generation is grounded on. The
 * retrieval pipeline remains the only selector of Evidence: this module only
 * decides which queries to run (the brief, plus one pass per section of every
 * selected source) and how to spend the per-source evidence budget across
 * them. It never reads chunk bodies to build Evidence.
 */
@Injectable()
export class GenerationGroundingService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly retrievalService: RetrievalService,
  ) {}

  async ground(
    request: GenerationGroundingRequest,
  ): Promise<GenerationGrounding> {
    const selectedIds = [...new Set(request.sourceIds)];
    if (selectedIds.length === 0) {
      return emptyGrounding();
    }

    const sourceRows = await this.db
      .select({
        id: sources.id,
        title: sources.title,
        kind: sources.kind,
        url: sources.url,
        processingStatus: sources.processingStatus,
      })
      .from(sources)
      .where(
        and(
          eq(sources.notebookId, request.notebookId),
          inArray(sources.id, selectedIds),
        ),
      );
    const sourceById = new Map(sourceRows.map((row) => [row.id, row]));

    const sectionRows = await this.db
      .select({
        sourceId: sourceChunks.sourceId,
        headingPath: sourceChunks.headingPath,
      })
      .from(sourceChunks)
      .where(
        and(
          eq(sourceChunks.notebookId, request.notebookId),
          inArray(sourceChunks.sourceId, selectedIds),
        ),
      )
      .groupBy(sourceChunks.sourceId, sourceChunks.headingPath)
      .orderBy(
        sourceChunks.sourceId,
        sql`min(${sourceChunks.chunkIndex})`,
        sql`${sourceChunks.headingPath}::text`,
      );
    const sectionsBySource = new Map<string, SourceSection[]>();
    for (const row of sectionRows) {
      const list = sectionsBySource.get(row.sourceId) ?? [];
      list.push({ headingPath: row.headingPath ?? [] });
      sectionsBySource.set(row.sourceId, list);
    }

    const maxPassesPerSource = Math.max(
      1,
      Math.min(
        GENERATION_MAX_SECTION_PASSES_PER_SOURCE,
        Math.floor(GENERATION_MAX_RETRIEVAL_PASSES / selectedIds.length),
      ),
    );

    const passes: PlannedPass[] = [];
    // A Generation without a brief still needs a topical query; the material
    // kind is the only signal available, so it stands in for the topic.
    const topic = request.brief.trim() || request.kind.replaceAll('_', ' ');
    for (const sourceId of selectedIds) {
      const source = sourceById.get(sourceId);
      if (!source) continue;
      passes.push(
        ...planPasses(
          source,
          sectionsBySource.get(sourceId) ?? [],
          topic,
          maxPassesPerSource,
        ),
      );
    }

    const outcomes = await runWithConcurrency(
      passes.map(
        (pass) => () =>
          this.retrievalService.retrieve({
            notebookId: request.notebookId,
            query: pass.query,
            sourceIds: [pass.sourceId],
            topK: GENERATION_EVIDENCE_CHUNKS_PER_SOURCE,
            // Selected sources are in scope by definition; the relevance
            // floor and rerank threshold only gate Notebook-wide Evidence
            // for Chat.
            relevanceFloor: 0,
            rerankThreshold: 0,
          } satisfies RetrievalRequest),
      ),
      GENERATION_RETRIEVAL_CONCURRENCY,
    );

    const chunksByPass = outcomes.map((outcome) => outcome.chunks);
    const traces = outcomes.map((outcome) => outcome.trace);

    const groundedSources: GroundedSource[] = [];
    const unavailableSources: UnavailableSource[] = [];
    for (const sourceId of selectedIds) {
      const source = sourceById.get(sourceId);
      const passIndexes = passes.flatMap((pass, index) =>
        pass.sourceId === sourceId ? [index] : [],
      );
      const chunks = selectPerPass(
        chunksByPass,
        passIndexes,
        GENERATION_EVIDENCE_CHUNKS_PER_SOURCE,
      );
      if (!source || chunks.length === 0) {
        unavailableSources.push({
          id: sourceId,
          title: source?.title ?? sourceId,
          kind: source?.kind ?? 'unknown',
        });
        continue;
      }
      chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
      groundedSources.push({
        id: source.id,
        title: source.title,
        kind: source.kind,
        url: source.url,
        chunks,
      });
    }

    const degradedSources = sourceRows
      .filter((row) => row.processingStatus === 'degraded')
      .map((row) => ({ id: row.id, title: row.title, kind: row.kind }));

    return {
      sources: groundedSources,
      evidence: createCitationEvidence(
        groundedSources.flatMap((source) => source.chunks),
      ),
      unavailableSources,
      degradedSources,
      traces,
    };
  }
}

export function emptyGrounding(): GenerationGrounding {
  return {
    sources: [],
    evidence: [],
    unavailableSources: [],
    degradedSources: [],
    traces: [],
  };
}

/**
 * Plans one retrieval pass per section of a source, grouped into at most
 * `maxPasses` contiguous buckets ordered by chunk position. The query names
 * the source and the bucket's headings, so the pass retrieves that part of
 * the source rather than a single head-weighted set.
 */
function planPasses(
  source: { id: string; title: string },
  sections: SourceSection[],
  topic: string,
  maxPasses: number,
): PlannedPass[] {
  if (sections.length === 0) return [];
  const passCount = Math.max(1, Math.min(sections.length, maxPasses));
  const buckets: SourceSection[][] = Array.from(
    { length: passCount },
    () => [],
  );
  sections.forEach((section, index) => {
    const bucket = Math.min(
      passCount - 1,
      Math.floor((index * passCount) / sections.length),
    );
    buckets[bucket].push(section);
  });

  return buckets.map((bucket) => ({
    sourceId: source.id,
    query: buildPassQuery(topic, source.title, bucket),
  }));
}

function buildPassQuery(
  topic: string,
  title: string,
  bucket: SourceSection[],
): string {
  const headings = [
    ...new Set(bucket.flatMap((section) => section.headingPath)),
  ].filter((heading) => heading.trim().length > 0);
  const parts = [
    topic.trim().slice(0, 300),
    title.trim(),
    headings.join(' ').slice(0, 300),
  ].filter((part) => part.length > 0);
  return parts
    .join(' ')
    .replace(/\s+/g, ' ')
    .slice(0, GENERATION_MAX_PASS_QUERY_CHARS)
    .trim();
}

/**
 * Spends a source's evidence budget round robin across its retrieval passes:
 * the best chunk of each pass first, then the second best, and so on. A long
 * source therefore keeps a foothold in every section it was planned from
 * instead of letting one section fill the budget.
 */
function selectPerPass(
  chunksByPass: RetrievedChunk[][],
  passIndexes: number[],
  budget: number,
): RetrievedChunk[] {
  const seen = new Set<string>();
  const selected: RetrievedChunk[] = [];
  const maxRounds = Math.max(
    0,
    ...passIndexes.map((index) => chunksByPass[index]?.length ?? 0),
  );
  for (let round = 0; round < maxRounds; round++) {
    for (const index of passIndexes) {
      const chunk = chunksByPass[index]?.[round];
      if (!chunk || seen.has(chunk.chunkId)) continue;
      seen.add(chunk.chunkId);
      selected.push(chunk);
      if (selected.length >= budget) return selected;
    }
  }
  return selected;
}

/**
 * Formats the grounding for the Generation prompt. Each retrieved chunk is
 * labeled with its evidence key so the model can cite it, and the prompt
 * budget is split fairly across the selected sources: when the sources do not
 * all fit, every source keeps a readable share and the tail of the selection
 * order is not the only thing cut.
 */
export function formatGroundedSourceText(
  grounding: Pick<GenerationGrounding, 'sources' | 'evidence'>,
  maxChars = GENERATION_MAX_PROMPT_SOURCE_CHARS,
): string {
  const { sources, evidence } = grounding;
  if (sources.length === 0) return '';
  const keyByChunkId = new Map(
    evidence.map((item) => [item.chunkId, item.citationKey]),
  );
  const share = Math.max(
    GENERATION_MIN_SOURCE_TEXT_CHARS,
    Math.floor(maxChars / sources.length),
  );

  return sources
    .map((source) => {
      const blocks = source.chunks.map((chunk) => {
        const key = keyByChunkId.get(chunk.chunkId) ?? '';
        const body = stripChunkContentHeader(chunk.content);
        return key ? `[Evidence ${key}]\n${body}` : body;
      });
      const text = `Source: "${source.title}" (Source ID: ${source.id})\n\n${blocks.join('\n\n')}`;
      return text.length > share ? text.slice(0, share) : text;
    })
    .join('\n\n---\n\n');
}

/** Runs the tasks with a bounded number in flight, preserving result order. */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let next = 0;
  const workerCount = Math.max(1, Math.min(limit, tasks.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = next++;
      if (index >= tasks.length) return;
      results[index] = await tasks[index]();
    }
  });
  await Promise.all(workers);
  return results;
}
