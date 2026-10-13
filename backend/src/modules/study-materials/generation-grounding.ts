import { Inject, Injectable, Logger } from '@nestjs/common';
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

export const GENERATION_EVIDENCE_CHUNKS_PER_SOURCE = 16;

export const GENERATION_MAX_SECTION_PASSES_PER_SOURCE = 8;

export const GENERATION_MAX_RETRIEVAL_PASSES = 16;

export const GENERATION_RETRIEVAL_CONCURRENCY = 4;

export const GENERATION_MAX_PASS_QUERY_CHARS = 600;

export const GENERATION_MAX_PROMPT_SOURCE_CHARS = 100_000;

export interface GroundedSource {
  id: string;
  title: string;
  kind: string;
  url: string | null;
  chunks: RetrievedChunk[];
  promptChunks: RetrievedChunk[];
}

export interface UnavailableSource {
  id: string;
  title: string;
  kind: string;
}

export interface GenerationGrounding {
  sources: GroundedSource[];
  evidence: CitationEvidence[];
  unavailableSources: UnavailableSource[];
  degradedSources: UnavailableSource[];
  traces: RetrievalTrace[];
}

export interface GenerationGroundingRequest {
  notebookId: string;
  kind: StudyMaterialKind;
  brief: string;
  sourceIds: string[];
}

interface SourceSection {
  headingPath: string[];
}

interface PlannedPass {
  sourceId: string;
  query: string;
}

@Injectable()
export class GenerationGroundingService {
  private readonly logger = new Logger(GenerationGroundingService.name);

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

    if (passes.length > GENERATION_MAX_RETRIEVAL_PASSES) {
      this.logger.warn(
        `Generation grounding planned ${passes.length} retrieval passes for ${selectedIds.length} selected sources, above the soft cap of ${GENERATION_MAX_RETRIEVAL_PASSES}; every source keeps at least one pass so none is dropped.`,
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
      const promptChunks = selectPerPass(
        chunksByPass,
        passIndexes,
        GENERATION_EVIDENCE_CHUNKS_PER_SOURCE,
      );
      if (!source || promptChunks.length === 0) {
        unavailableSources.push({
          id: sourceId,
          title: source?.title ?? sourceId,
          kind: source?.kind ?? 'unknown',
        });
        continue;
      }
      const chunks = [...promptChunks].sort(
        (a, b) => a.chunkIndex - b.chunkIndex,
      );
      groundedSources.push({
        id: source.id,
        title: source.title,
        kind: source.kind,
        url: source.url,
        chunks,
        promptChunks,
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

const SOURCE_SEPARATOR = '\n\n---\n\n';
const BLOCK_SEPARATOR = '\n\n';

export interface FormattedGroundedSourceText {
  text: string;
  droppedBlocks: number;
  truncatedSourceIds: string[];
  renderedChunkIds: string[];
  truncatedChunkIds: string[];
}

export interface FormatGroundedSourceTextOptions {
  maxChars?: number;
  includeSourceId?: boolean;
}

export function formatGroundedSourceText(
  grounding: Pick<GenerationGrounding, 'sources' | 'evidence'>,
  options: FormatGroundedSourceTextOptions = {},
): FormattedGroundedSourceText {
  const maxChars = options.maxChars ?? GENERATION_MAX_PROMPT_SOURCE_CHARS;
  const includeSourceId = options.includeSourceId ?? false;
  const { sources, evidence } = grounding;
  const empty: FormattedGroundedSourceText = {
    text: '',
    droppedBlocks: 0,
    truncatedSourceIds: [],
    renderedChunkIds: [],
    truncatedChunkIds: [],
  };
  if (sources.length === 0 || maxChars <= 0) return empty;

  const keyByChunkId = new Map(
    evidence.map((item) => [item.chunkId, item.citationKey]),
  );
  const headerOf = (source: GroundedSource) =>
    includeSourceId
      ? `Source: "${source.title}" (Source ID: ${source.id})`
      : `Source: "${source.title}"`;
  const blocksBySource = sources.map((source) =>
    (source.promptChunks.length > 0 ? source.promptChunks : source.chunks).map(
      (chunk) => ({
        chunkId: chunk.chunkId,
        text: formatEvidenceBlock(chunk, keyByChunkId.get(chunk.chunkId)),
      }),
    ),
  );

  const headerChars = sources.reduce(
    (sum, source) => sum + headerOf(source).length,
    0,
  );
  const separatorChars =
    SOURCE_SEPARATOR.length * Math.max(0, sources.length - 1);
  const blockSeparatorChars = BLOCK_SEPARATOR.length * sources.length;
  const share = Math.floor(
    Math.max(0, maxChars - headerChars - separatorChars - blockSeparatorChars) /
      sources.length,
  );

  const droppedBlocks: number[] = [];
  const truncatedSourceIds: string[] = [];
  const renderedChunkIds: string[] = [];
  const truncatedChunkIds: string[] = [];
  const sections: string[] = [];

  for (let index = 0; index < sources.length; index++) {
    const source = sources[index];
    const blocks = blocksBySource[index];
    const kept: string[] = [];
    let used = 0;
    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
      const block = blocks[blockIndex];
      const joinChars = kept.length === 0 ? 0 : BLOCK_SEPARATOR.length;
      if (used + joinChars + block.text.length <= share) {
        kept.push(block.text);
        used += joinChars + block.text.length;
        renderedChunkIds.push(block.chunkId);
        continue;
      }
      if (kept.length === 0 && share > 0) {
        kept.push(block.text.slice(0, share));
        renderedChunkIds.push(block.chunkId);
        truncatedChunkIds.push(block.chunkId);
        truncatedSourceIds.push(source.id);
        droppedBlocks.push(blocks.length - 1);
      } else {
        droppedBlocks.push(blocks.length - kept.length);
      }
      break;
    }
    if (kept.length > 0) {
      sections.push(
        `${headerOf(source)}${BLOCK_SEPARATOR}${kept.join(BLOCK_SEPARATOR)}`,
      );
    }
  }

  let text = sections.join(SOURCE_SEPARATOR);
  if (text.length > maxChars) text = text.slice(0, maxChars);

  return {
    text,
    droppedBlocks: droppedBlocks.reduce((sum, count) => sum + count, 0),
    truncatedSourceIds,
    renderedChunkIds,
    truncatedChunkIds,
  };
}

function formatEvidenceBlock(
  chunk: RetrievedChunk,
  citationKey: string | undefined,
): string {
  const body = stripChunkContentHeader(chunk.content);
  return citationKey ? `[Evidence ${citationKey}]\n${body}` : body;
}

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
