import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../../database/schema';
import { sourceChunks, sources } from '../../../database/schema';
import { DRIZZLE } from '../../database/database.module';
import { createCitationEvidence } from '../../chat/chat-citations';
import {
  RetrievalService,
  type RetrievalRequest,
} from '../../ai/retrieval/retrieval.service';
import { filterSubstantiveChunks } from './grounding/content-filtering';
import { classifyBriefIntent } from './grounding/brief-intent';
import { setGroundingKind } from './grounding/kind-metadata';
import {
  planFocusedPasses,
  postFilterPassChunks,
} from './grounding/focused-passes';
import {
  buildSourceSections,
  emptyGrounding,
  sampleStratifiedSource,
} from './grounding/source-sampling';
import { selectPerPass } from './grounding/pass-selection';
import {
  applyAdjacentOverlapStripping,
  trimChunkForFocusedBrief,
} from './grounding/overlap-trimming';
import type {
  GenerationGrounding,
  GenerationGroundingRequest,
  GroundedSource,
  IndexedChunkRow,
  PlannedPass,
  SourceSection,
  UnavailableSource,
} from './grounding/grounding.types';
export { classifyBriefIntent } from './grounding/brief-intent';
export {
  filterSubstantiveChunks,
  isBoilerplateHeadingPath,
  stripDiacritics,
} from './grounding/content-filtering';
export type {
  BriefIntent,
  GenerationGrounding,
  GenerationGroundingRequest,
  GroundedSource,
  UnavailableSource,
} from './grounding/grounding.types';
export {
  emptyGrounding,
  sampleStratifiedSource,
} from './grounding/source-sampling';
export { matchSectionsForBrief } from './grounding/focused-passes';
export { isNearDuplicateChunk } from './grounding/pass-selection';
export {
  stripAdjacentBoundaryOverlap,
  applyAdjacentOverlapStripping,
  trimChunkForFocusedBrief,
} from './grounding/overlap-trimming';
export { formatGroundedSourceText } from './grounding/prompt-formatting';
export type {
  FormattedGroundedSourceText,
  FormatGroundedSourceTextOptions,
} from './grounding/prompt-formatting';
export {
  allocateSourceChunkBudgets,
  GENERATION_EVIDENCE_CHUNKS_PER_SOURCE,
  GENERATION_KIND_BUDGETS,
  GENERATION_MAX_PASS_QUERY_CHARS,
  GENERATION_MAX_PROMPT_SOURCE_CHARS,
  GENERATION_MAX_RETRIEVAL_PASSES,
  GENERATION_MAX_SECTION_PASSES_PER_SOURCE,
  GENERATION_RETRIEVAL_CONCURRENCY,
  getKindGroundingBudget,
  MAX_FOCUSED_CHUNK_CHARS,
  MIN_SUBSTANTIVE_CHUNK_CHARS,
  NEAR_DUPLICATE_JACCARD_THRESHOLD,
  type KindGroundingBudget,
} from './grounding/budgets';
import {
  allocateSourceChunkBudgets,
  GENERATION_MAX_RETRIEVAL_PASSES,
  GENERATION_MAX_SECTION_PASSES_PER_SOURCE,
  GENERATION_RETRIEVAL_CONCURRENCY,
} from './grounding/budgets';

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
          isNull(sources.deletedAt),
        ),
      );
    const sourceById = new Map(sourceRows.map((row) => [row.id, row]));

    const nonDegradedIds = sourceRows
      .filter((row) => row.processingStatus !== 'degraded')
      .map((row) => row.id);

    const rawChunkRows =
      nonDegradedIds.length > 0
        ? await this.db
            .select({
              chunkId: sourceChunks.id,
              chunkIndex: sourceChunks.chunkIndex,
              sourceId: sourceChunks.sourceId,
              sourceVersionId: sourceChunks.sourceVersionId,
              locator: sourceChunks.locator,
              content: sourceChunks.content,
              headingPath: sourceChunks.headingPath,
            })
            .from(sourceChunks)
            .where(
              and(
                eq(sourceChunks.notebookId, request.notebookId),
                inArray(sourceChunks.sourceId, nonDegradedIds),
              ),
            )
            .orderBy(asc(sourceChunks.sourceId), asc(sourceChunks.chunkIndex))
        : [];

    const rawChunksBySource = new Map<string, IndexedChunkRow[]>();
    for (const row of rawChunkRows) {
      const list = rawChunksBySource.get(row.sourceId) ?? [];
      list.push({
        chunkId: row.chunkId,
        chunkIndex: row.chunkIndex,
        sourceId: row.sourceId,
        sourceVersionId: row.sourceVersionId ?? null,
        locator: row.locator ?? null,
        content: row.content,
        headingPath: row.headingPath ?? [],
      });
      rawChunksBySource.set(row.sourceId, list);
    }

    const filteredBySource = new Map<
      string,
      {
        substantiveChunks: IndexedChunkRow[];
        excludedChunkIds: string[];
        sections: SourceSection[];
      }
    >();

    const readySourcesForBudget: {
      sourceId: string;
      substantiveChunkCount: number;
      totalChunkCount: number;
    }[] = [];

    for (const sourceId of selectedIds) {
      const source = sourceById.get(sourceId);
      if (!source || source.processingStatus === 'degraded') continue;
      const rawChunks = rawChunksBySource.get(sourceId) ?? [];
      if (rawChunks.length === 0) continue;

      const { substantiveChunks, excludedChunkIds } = filterSubstantiveChunks(
        rawChunks,
        request.brief,
      );
      const sections = buildSourceSections(substantiveChunks);
      filteredBySource.set(sourceId, {
        substantiveChunks,
        excludedChunkIds,
        sections,
      });
      readySourcesForBudget.push({
        sourceId,
        substantiveChunkCount: substantiveChunks.length,
        totalChunkCount: rawChunks.length,
      });
    }

    const budgetBySource = allocateSourceChunkBudgets(
      readySourcesForBudget,
      request.kind,
    );

    const readySourceTitles = readySourcesForBudget
      .map((item) => sourceById.get(item.sourceId)?.title ?? '')
      .filter(Boolean);
    const allSections = readySourcesForBudget.flatMap(
      (item) => filteredBySource.get(item.sourceId)?.sections ?? [],
    );

    const intent = classifyBriefIntent({
      brief: request.brief,
      kind: request.kind,
      sourceTitles: readySourceTitles,
      sections: allSections.map((section) => section.headingPath),
    });

    const degradedSources = sourceRows
      .filter((row) => row.processingStatus === 'degraded')
      .map((row) => ({ id: row.id, title: row.title, kind: row.kind }));

    if (intent === 'broad-survey') {
      const groundedSources: GroundedSource[] = [];
      const unavailableSources: UnavailableSource[] = [];

      for (const sourceId of selectedIds) {
        const source = sourceById.get(sourceId);
        const filtered = filteredBySource.get(sourceId);
        const budget = budgetBySource.get(sourceId) ?? 0;
        if (
          !source ||
          source.processingStatus === 'degraded' ||
          !filtered ||
          filtered.substantiveChunks.length === 0 ||
          budget <= 0
        ) {
          unavailableSources.push({
            id: sourceId,
            title: source?.title ?? sourceId,
            kind: source?.kind ?? 'unknown',
          });
          continue;
        }

        const sampled = sampleStratifiedSource(
          source,
          filtered.substantiveChunks,
          budget,
        );
        groundedSources.push({
          id: source.id,
          title: source.title,
          kind: source.kind,
          url: source.url,
          chunks: sampled.chunks,
          promptChunks: sampled.promptChunks,
        });
      }

      return setGroundingKind(
        {
          sources: groundedSources,
          evidence: createCitationEvidence(
            groundedSources.flatMap((source) => source.chunks),
          ),
          unavailableSources,
          degradedSources,
          traces: [],
        },
        request.kind,
      );
    }

    const maxPassesPerSource = Math.max(
      1,
      Math.min(
        GENERATION_MAX_SECTION_PASSES_PER_SOURCE,
        Math.floor(
          GENERATION_MAX_RETRIEVAL_PASSES /
            Math.max(1, readySourcesForBudget.length),
        ),
      ),
    );

    const passes: PlannedPass[] = [];
    for (const sourceId of selectedIds) {
      const source = sourceById.get(sourceId);
      const filtered = filteredBySource.get(sourceId);
      const budget = budgetBySource.get(sourceId) ?? 0;
      if (
        !source ||
        source.processingStatus === 'degraded' ||
        !filtered ||
        budget <= 0
      ) {
        continue;
      }
      passes.push(
        ...planFocusedPasses({
          source,
          sections: filtered.sections,
          excludedChunkIds: filtered.excludedChunkIds,
          brief: request.brief,
          budget,
          maxPasses: maxPassesPerSource,
        }),
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
            topK: pass.topK,
            relevanceFloor: 0,
            rerankThreshold: 0,
            skipQueryUnderstanding: true,
            headingPaths: pass.headingPaths,
            chunkIndexRange: pass.chunkIndexRange,
            excludeChunkIds: pass.excludeChunkIds,
          } satisfies RetrievalRequest),
      ),
      GENERATION_RETRIEVAL_CONCURRENCY,
    );

    const chunksByPass = outcomes.map((outcome, index) =>
      postFilterPassChunks(outcome.chunks, passes[index]),
    );
    const traces = outcomes.map((outcome) => outcome.trace);

    const groundedSources: GroundedSource[] = [];
    const unavailableSources: UnavailableSource[] = [];

    for (const sourceId of selectedIds) {
      const source = sourceById.get(sourceId);
      const filtered = filteredBySource.get(sourceId);
      const budget = budgetBySource.get(sourceId) ?? 0;
      if (
        !source ||
        source.processingStatus === 'degraded' ||
        !filtered ||
        budget <= 0
      ) {
        unavailableSources.push({
          id: sourceId,
          title: source?.title ?? sourceId,
          kind: source?.kind ?? 'unknown',
        });
        continue;
      }

      const passIndexes = passes.flatMap((pass, index) =>
        pass.sourceId === sourceId ? [index] : [],
      );
      let promptChunks = selectPerPass(chunksByPass, passIndexes, budget);

      if (promptChunks.length === 0 && filtered.substantiveChunks.length > 0) {
        promptChunks = sampleStratifiedSource(
          source,
          filtered.substantiveChunks,
          budget,
        ).promptChunks;
      }

      if (promptChunks.length === 0) {
        unavailableSources.push({
          id: sourceId,
          title: source.title,
          kind: source.kind,
        });
        continue;
      }

      const trimmedPromptChunks = promptChunks.map((chunk) => ({
        ...chunk,
        content: trimChunkForFocusedBrief(chunk.content, request.brief),
      }));
      const deduplicated = applyAdjacentOverlapStripping(trimmedPromptChunks);

      groundedSources.push({
        id: source.id,
        title: source.title,
        kind: source.kind,
        url: source.url,
        chunks: deduplicated.chunks,
        promptChunks: deduplicated.promptChunks,
      });
    }

    return setGroundingKind(
      {
        sources: groundedSources,
        evidence: createCitationEvidence(
          groundedSources.flatMap((source) => source.chunks),
        ),
        unavailableSources,
        degradedSources,
        traces,
      },
      request.kind,
    );
  }
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
