import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../../database/schema';
import { sourceChunks, sources } from '../../../database/schema';
import { DRIZZLE } from '../../database/database.module';
import {
  createCitationEvidence,
  type CitationEvidence,
} from '../../chat/chat-citations';
import {
  estimateChunkTokens,
  stripChunkContentHeader,
} from '../../ai/indexing/chunking.service';
import {
  RetrievalService,
  type CitationLocator,
  type RetrievalChunkIndexRange,
  type RetrievalRequest,
  type RetrievedChunk,
} from '../../ai/retrieval/retrieval.service';
import type { RetrievalTrace } from '../../ai/retrieval/retrieval-trace';
import {
  jaccardSimilarity,
  textSignature,
  tokenize,
} from '../../ai/retrieval/text-similarity';
import type { StudyMaterialKind } from '../content/shapes';

export interface KindGroundingBudget {
  maxTotalChunksSingleSource: number;
  maxTotalChunksMultiSource: number;
  maxPromptChars: number;
}

export const GENERATION_KIND_BUDGETS: Record<
  StudyMaterialKind,
  KindGroundingBudget
> = {
  mind_map: {
    maxTotalChunksSingleSource: 8,
    maxTotalChunksMultiSource: 12,
    maxPromptChars: 18_000,
  },
  roadmap: {
    maxTotalChunksSingleSource: 10,
    maxTotalChunksMultiSource: 14,
    maxPromptChars: 22_000,
  },
  simple_flashcard: {
    maxTotalChunksSingleSource: 12,
    maxTotalChunksMultiSource: 16,
    maxPromptChars: 26_000,
  },
  slides: {
    maxTotalChunksSingleSource: 12,
    maxTotalChunksMultiSource: 16,
    maxPromptChars: 26_000,
  },
  quiz: {
    maxTotalChunksSingleSource: 14,
    maxTotalChunksMultiSource: 20,
    maxPromptChars: 30_000,
  },
};

export function getKindGroundingBudget(
  kind: StudyMaterialKind,
): KindGroundingBudget {
  return GENERATION_KIND_BUDGETS[kind] ?? GENERATION_KIND_BUDGETS.quiz;
}

export const GENERATION_EVIDENCE_CHUNKS_PER_SOURCE = 16;

export const GENERATION_MAX_SECTION_PASSES_PER_SOURCE = 8;

export const GENERATION_MAX_RETRIEVAL_PASSES = 16;

export const GENERATION_RETRIEVAL_CONCURRENCY = 4;

export const GENERATION_MAX_PASS_QUERY_CHARS = 600;

export const GENERATION_MAX_PROMPT_SOURCE_CHARS = 30_000;

export const MIN_SUBSTANTIVE_CHUNK_CHARS = 120;

export const NEAR_DUPLICATE_JACCARD_THRESHOLD = 0.85;

export const MAX_FOCUSED_CHUNK_CHARS = 1_400;

export type BriefIntent = 'broad-survey' | 'focused-brief';

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
  kind?: StudyMaterialKind;
}

export interface GenerationGroundingRequest {
  notebookId: string;
  kind: StudyMaterialKind;
  brief: string;
  sourceIds: string[];
}

interface SourceSection {
  headingPath: string[];
  minChunkIndex: number;
  maxChunkIndex: number;
  chunkCount: number;
}

interface IndexedChunkRow {
  chunkId: string;
  chunkIndex: number;
  sourceId: string;
  sourceVersionId: string | null;
  locator: CitationLocator | null;
  content: string;
  headingPath: string[];
}

interface SourceMetaRow {
  id: string;
  title: string;
  kind: string;
  url: string | null;
  processingStatus: string;
}

interface PlannedPass {
  sourceId: string;
  query: string;
  topK: number;
  headingPaths?: string[][];
  chunkIndexRange?: RetrievalChunkIndexRange;
  excludeChunkIds?: string[];
}

const groundingKindByInstance = new WeakMap<object, StudyMaterialKind>();

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

      return withGroundingKind(
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

    // Focused Brief Mode: Section Targeting & Scoped Hybrid Retrieval
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

    return withGroundingKind(
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

function withGroundingKind(
  grounding: GenerationGrounding,
  kind: StudyMaterialKind,
): GenerationGrounding {
  groundingKindByInstance.set(grounding, kind);
  return grounding;
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

// ---------------------------------------------------------------------------
// Boilerplate & Stub Chunk Filtering (Ticket 01)
// ---------------------------------------------------------------------------

const BOILERPLATE_HEADING_PATTERNS: { key: string; pattern: RegExp }[] = [
  { key: 'table of contents', pattern: /^(?:table of )?contents$|^toc$/i },
  { key: 'preface', pattern: /^preface$|^foreword$/i },
  { key: 'acknowledgments', pattern: /^acknowledgm?ents$/i },
  {
    key: 'copyright',
    pattern: /^copyright(?:\s+notice|\s+page)?$|^colophon$|^imprint$/i,
  },
  { key: 'index', pattern: /^(?:subject\s+|author\s+)?index$/i },
  {
    key: 'bibliography',
    pattern: /^bibliography$|^works\s+cited$|^further\s+reading$/i,
  },
  { key: 'references', pattern: /^(?:list\s+of\s+)?references$/i },
  {
    key: 'about the author',
    pattern: /^about\s+the\s+authors?$|^biographical\s+note$/i,
  },
  { key: 'glossary', pattern: /^glossary$/i },
  { key: 'dedication', pattern: /^dedication$|^epigraph$/i },
  { key: 'front matter', pattern: /^front\s+matter$|^back\s+matter$/i },
];

function normalizeHeadingSegment(segment: string): string {
  return segment
    .toLowerCase()
    .replace(/^[\s\d.:()-]+/, '')
    .replace(
      /^(?:part|chapter|section|appendix|unit|module)\s+[\d\w.:()-]+\s*/i,
      '',
    )
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isBoilerplateHeadingPath(
  headingPath: string[] | null | undefined,
  brief = '',
): boolean {
  if (!headingPath || headingPath.length === 0) return false;
  const normalizedBrief = brief
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const briefTokens = new Set(tokenize(brief));

  for (const segment of headingPath) {
    const normalized = normalizeHeadingSegment(segment);
    if (!normalized) continue;
    for (const entry of BOILERPLATE_HEADING_PATTERNS) {
      if (!entry.pattern.test(normalized)) continue;
      // Check if the user's Brief explicitly mentions this boilerplate section
      const segmentTokens = tokenize(normalized);
      const explicitlyRequested =
        (normalizedBrief.length > 0 && normalizedBrief.includes(normalized)) ||
        (normalizedBrief.length > 0 && normalizedBrief.includes(entry.key)) ||
        (segmentTokens.length > 0 &&
          segmentTokens.every((token) => briefTokens.has(token)));
      if (!explicitlyRequested) {
        return true;
      }
    }
  }
  return false;
}

export function filterSubstantiveChunks(
  chunks: IndexedChunkRow[],
  brief = '',
): {
  substantiveChunks: IndexedChunkRow[];
  excludedChunkIds: string[];
} {
  if (chunks.length === 0) {
    return { substantiveChunks: [], excludedChunkIds: [] };
  }

  const nonBoilerplate = chunks.filter(
    (chunk) => !isBoilerplateHeadingPath(chunk.headingPath, brief),
  );
  const basePool = nonBoilerplate.length > 0 ? nonBoilerplate : chunks;

  // Group by section to check whether a section has any non-stub chunks
  const hasLongChunkInSection = new Map<string, boolean>();
  let hasAnyLongChunkInSource = false;
  for (const chunk of basePool) {
    const key = chunk.headingPath.join(' > ');
    const len = stripChunkContentHeader(chunk.content).trim().length;
    if (len >= MIN_SUBSTANTIVE_CHUNK_CHARS) {
      hasLongChunkInSection.set(key, true);
      hasAnyLongChunkInSource = true;
    }
  }

  const substantive = basePool.filter((chunk) => {
    const len = stripChunkContentHeader(chunk.content).trim().length;
    if (len >= MIN_SUBSTANTIVE_CHUNK_CHARS) return true;
    const key = chunk.headingPath.join(' > ');
    if (key.length > 0) {
      return !hasLongChunkInSection.get(key);
    }
    return !hasAnyLongChunkInSource;
  });

  const finalSubstantive = substantive.length > 0 ? substantive : basePool;
  const keptIds = new Set(finalSubstantive.map((chunk) => chunk.chunkId));
  const excludedChunkIds = chunks
    .filter((chunk) => !keptIds.has(chunk.chunkId))
    .map((chunk) => chunk.chunkId);

  return {
    substantiveChunks: finalSubstantive,
    excludedChunkIds,
  };
}

// ---------------------------------------------------------------------------
// Adaptive Evidence Budget Allocation (Ticket 01)
// ---------------------------------------------------------------------------

export function allocateSourceChunkBudgets(
  sources: {
    sourceId: string;
    substantiveChunkCount: number;
    totalChunkCount: number;
  }[],
  kind: StudyMaterialKind,
): Map<string, number> {
  const budget = getKindGroundingBudget(kind);
  const eligible = sources.filter((source) => source.totalChunkCount > 0);
  const allocations = new Map<string, number>();
  if (eligible.length === 0) return allocations;

  if (eligible.length === 1) {
    const only = eligible[0];
    const cap = Math.max(1, only.substantiveChunkCount || only.totalChunkCount);
    allocations.set(
      only.sourceId,
      Math.min(cap, budget.maxTotalChunksSingleSource),
    );
    return allocations;
  }

  const totalBudget = Math.max(
    eligible.length,
    budget.maxTotalChunksMultiSource,
  );
  const items = eligible.map((source, index) => {
    const capacity = Math.max(
      1,
      source.substantiveChunkCount || source.totalChunkCount,
    );
    return {
      sourceId: source.sourceId,
      index,
      capacity,
      weight: Math.sqrt(capacity),
      allocated: 1,
    };
  });

  let remaining = totalBudget - items.length;
  while (remaining > 0) {
    const expandable = items.filter((item) => item.allocated < item.capacity);
    if (expandable.length === 0) break;

    const totalWeight = expandable.reduce((sum, item) => sum + item.weight, 0);
    const quotas = expandable.map((item) => {
      const exact =
        totalWeight > 0
          ? (remaining * item.weight) / totalWeight
          : remaining / expandable.length;
      const room = item.capacity - item.allocated;
      const whole = Math.min(room, Math.floor(exact));
      return {
        item,
        whole,
        remainder: exact - Math.floor(exact),
      };
    });

    const wholeSum = quotas.reduce((sum, q) => sum + q.whole, 0);
    if (wholeSum > 0) {
      for (const q of quotas) {
        q.item.allocated += q.whole;
        remaining -= q.whole;
      }
      continue;
    }

    quotas.sort(
      (a, b) =>
        b.remainder - a.remainder ||
        b.item.weight - a.item.weight ||
        a.item.index - b.item.index,
    );
    for (const q of quotas) {
      if (remaining <= 0) break;
      if (q.item.allocated < q.item.capacity) {
        q.item.allocated += 1;
        remaining -= 1;
      }
    }
  }

  for (const item of items) {
    allocations.set(item.sourceId, item.allocated);
  }
  return allocations;
}

// ---------------------------------------------------------------------------
// Brief Intent Classification (Tickets 02 & 03)
// ---------------------------------------------------------------------------

const GENERIC_SURVEY_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'of',
  'on',
  'in',
  'to',
  'for',
  'from',
  'with',
  'by',
  'about',
  'over',
  'across',
  'through',
  'into',
  'as',
  'at',
  'is',
  'are',
  'be',
  'this',
  'that',
  'these',
  'those',
  'my',
  'our',
  'your',
  'me',
  'us',
  'it',
  'its',
  'all',
  'every',
  'each',
  'whole',
  'entire',
  'full',
  'complete',
  'general',
  'overall',
  'broad',
  'main',
  'key',
  'important',
  'core',
  'essential',
  'major',
  'comprehensive',
  'detailed',
  'brief',
  'short',
  'quick',
  'create',
  'make',
  'generate',
  'build',
  'write',
  'give',
  'prepare',
  'produce',
  'design',
  'review',
  'summarize',
  'summarise',
  'summary',
  'overview',
  'survey',
  'cover',
  'covering',
  'covered',
  'study',
  'studying',
  'learn',
  'learning',
  'test',
  'testing',
  'practice',
  'practicing',
  'check',
  'revise',
  'revision',
  'recap',
  'outline',
  'synthesize',
  'synthesise',
  'explain',
  'everything',
  'anything',
  'material',
  'materials',
  'source',
  'sources',
  'content',
  'contents',
  'text',
  'book',
  'textbook',
  'guide',
  'manual',
  'notes',
  'lecture',
  'lectures',
  'document',
  'documents',
  'paper',
  'article',
  'chapter',
  'chapters',
  'part',
  'parts',
  'unit',
  'units',
  'module',
  'modules',
  'topic',
  'topics',
  'concept',
  'concepts',
  'subject',
  'course',
  'notebook',
  'reading',
  'readings',
  'handout',
  'syllabus',
  'transcript',
  'handbook',
  'quiz',
  'quizzes',
  'question',
  'questions',
  'flashcard',
  'flashcards',
  'card',
  'cards',
  'deck',
  'roadmap',
  'roadmaps',
  'mind',
  'map',
  'mindmap',
  'slides',
  'slide',
  'presentation',
  'simple',
]);

const EXPLICIT_SECTION_LOCATOR_REGEX =
  /\b(?:(?:part|chapter|chap|ch|section|sec|experiment|exp|unit|module|lecture|appendix|phase)\s*(?:\d+|[ivxlcdm]+)\b|(?:first|second|third|fourth|fifth|last|final)\s+(?:section|chapter|part|unit|experiment|module)\b)/i;

export function classifyBriefIntent(input: {
  brief: string;
  kind: StudyMaterialKind;
  sourceTitles?: string[];
  sections?: string[][];
}): BriefIntent {
  const trimmed = input.brief.trim();
  if (!trimmed) return 'broad-survey';

  const normalizedKind = input.kind.replaceAll('_', ' ').toLowerCase();
  if (trimmed.toLowerCase() === normalizedKind) {
    return 'broad-survey';
  }

  // If the Brief explicitly names a boilerplate section (like Preface, Index, Bibliography),
  // treat it as a focused brief targeting that section.
  for (const entry of BOILERPLATE_HEADING_PATTERNS) {
    if (
      new RegExp(`\\b${entry.key.replace(/\s+/g, '\\s+')}\\b`, 'i').test(
        trimmed,
      )
    ) {
      return 'focused-brief';
    }
  }

  // If the Brief contains an explicit section/chapter number or ordinal locator
  // (e.g., "Chapter 4", "Part 3", "first section"), classify as focused-brief.
  if (EXPLICIT_SECTION_LOCATOR_REGEX.test(trimmed)) {
    return 'focused-brief';
  }

  const titleTokens = new Set(
    (input.sourceTitles ?? []).flatMap((title) => tokenize(title)),
  );
  const briefTokens = tokenize(trimmed);
  const specificTokens = briefTokens.filter(
    (token) => !GENERIC_SURVEY_WORDS.has(token) && !titleTokens.has(token),
  );

  if (specificTokens.length === 0) {
    return 'broad-survey';
  }

  return 'focused-brief';
}

// ---------------------------------------------------------------------------
// Stratified SQL Sampling for Broad Survey Mode (Ticket 02)
// ---------------------------------------------------------------------------

function buildSourceSections(chunks: IndexedChunkRow[]): SourceSection[] {
  const byKey = new Map<string, SourceSection>();
  for (const chunk of chunks) {
    const key = chunk.headingPath.join(' > ');
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        headingPath: chunk.headingPath,
        minChunkIndex: chunk.chunkIndex,
        maxChunkIndex: chunk.chunkIndex,
        chunkCount: 1,
      });
    } else {
      existing.minChunkIndex = Math.min(
        existing.minChunkIndex,
        chunk.chunkIndex,
      );
      existing.maxChunkIndex = Math.max(
        existing.maxChunkIndex,
        chunk.chunkIndex,
      );
      existing.chunkCount += 1;
    }
  }
  return [...byKey.values()].sort((a, b) => a.minChunkIndex - b.minChunkIndex);
}

function informationDensityScore(
  chunk: IndexedChunkRow,
  isSectionLead: boolean,
): number {
  const body = stripChunkContentHeader(chunk.content).trim();
  if (!body) return 0;
  const tokens = estimateChunkTokens(body);
  // Target chunk size is ~250-350 tokens (~300 tokens ideal)
  const sizeCloseness = Math.max(0, 1 - Math.abs(tokens - 300) / 400);
  const wordList = tokenize(body);
  const uniqueRatio =
    wordList.length > 0 ? new Set(wordList).size / wordList.length : 0;
  const leadBonus =
    isSectionLead && body.length >= MIN_SUBSTANTIVE_CHUNK_CHARS ? 1.5 : 0;
  return leadBonus + sizeCloseness * 0.7 + uniqueRatio * 0.3;
}

function toRetrievedChunk(
  source: SourceMetaRow,
  row: IndexedChunkRow,
  score = 1,
): RetrievedChunk {
  return {
    chunkId: row.chunkId,
    chunkIndex: row.chunkIndex,
    sourceId: source.id,
    title: source.title,
    content: row.content,
    sectionPath: row.headingPath ?? [],
    score,
    url: source.url,
    kind: source.kind,
    sourceVersionId: row.sourceVersionId,
    locator: row.locator,
  };
}

export function sampleStratifiedSource(
  source: SourceMetaRow,
  substantiveChunks: IndexedChunkRow[],
  budget: number,
): { chunks: RetrievedChunk[]; promptChunks: RetrievedChunk[] } {
  if (substantiveChunks.length === 0 || budget <= 0) {
    return { chunks: [], promptChunks: [] };
  }

  // Group chunks by section in reading order
  const sectionGroups: IndexedChunkRow[][] = [];
  const sectionIndexByKey = new Map<string, number>();
  for (const chunk of substantiveChunks) {
    const key = chunk.headingPath.join(' > ');
    let idx = sectionIndexByKey.get(key);
    if (idx === undefined) {
      idx = sectionGroups.length;
      sectionIndexByKey.set(key, idx);
      sectionGroups.push([]);
    }
    sectionGroups[idx].push(chunk);
  }

  const strata: IndexedChunkRow[][] = [];

  if (sectionGroups.length <= 1) {
    // Headingless or single-section Source: partition by chunkIndex ranges into K strata
    const stratumCount = Math.min(substantiveChunks.length, budget);
    for (let k = 0; k < stratumCount; k++) {
      const start = Math.floor((k * substantiveChunks.length) / stratumCount);
      const end = Math.max(
        start + 1,
        Math.floor(((k + 1) * substantiveChunks.length) / stratumCount),
      );
      const slice = substantiveChunks.slice(start, end);
      const ranked = [...slice].sort(
        (a, b) =>
          informationDensityScore(b, false) -
            informationDensityScore(a, false) || a.chunkIndex - b.chunkIndex,
      );
      strata.push(ranked);
    }
  } else if (sectionGroups.length <= budget) {
    // Each substantive section is its own stratum
    for (const group of sectionGroups) {
      const ranked = [...group].sort((a, b) => {
        const aLead = a.chunkId === group[0].chunkId;
        const bLead = b.chunkId === group[0].chunkId;
        return (
          informationDensityScore(b, bLead) -
            informationDensityScore(a, aLead) || a.chunkIndex - b.chunkIndex
        );
      });
      strata.push(ranked);
    }
  } else {
    // More sections than budget (e.g. 40+ chapters): form K = budget section strata
    // spanning evenly from the first substantive section (0) to the final one (S - 1).
    const S = sectionGroups.length;
    const K = budget;
    for (let k = 0; k < K; k++) {
      const anchorIndex = K === 1 ? 0 : Math.round((k * (S - 1)) / (K - 1));
      const bucketStart = Math.floor((k * S) / K);
      const bucketEnd = Math.max(
        bucketStart + 1,
        Math.floor(((k + 1) * S) / K),
      );
      const orderedSectionIndices = [
        anchorIndex,
        ...Array.from(
          { length: bucketEnd - bucketStart },
          (_, i) => bucketStart + i,
        ).filter((idx) => idx !== anchorIndex),
      ];
      const candidates: IndexedChunkRow[] = [];
      for (const secIdx of orderedSectionIndices) {
        const group = sectionGroups[secIdx] ?? [];
        const ranked = [...group].sort((a, b) => {
          const aLead = a.chunkId === group[0]?.chunkId;
          const bLead = b.chunkId === group[0]?.chunkId;
          return (
            informationDensityScore(b, bLead) -
              informationDensityScore(a, aLead) || a.chunkIndex - b.chunkIndex
          );
        });
        candidates.push(...ranked);
      }
      strata.push(candidates);
    }
  }

  const strataAsRetrieved = strata.map((stratum) =>
    stratum.map((row) => toRetrievedChunk(source, row, 1)),
  );
  const passIndexes = strataAsRetrieved.map((_, index) => index);
  const promptChunks = selectPerPass(strataAsRetrieved, passIndexes, budget);
  return applyAdjacentOverlapStripping(promptChunks);
}

// ---------------------------------------------------------------------------
// Focused Brief Section Targeting & Scoped Retrieval (Ticket 03)
// ---------------------------------------------------------------------------

const SECTION_MATCH_STOP_WORDS = new Set([
  ...GENERIC_SURVEY_WORDS,
  'focus',
  'focused',
  'only',
  'specifically',
  'particular',
  'especially',
]);

export function matchSectionsForBrief(
  brief: string,
  sourceTitle: string,
  sections: SourceSection[],
): SourceSection[] {
  const nonEmptySections = sections.filter((sec) =>
    sec.headingPath.some((segment) => segment.trim().length > 0),
  );
  if (nonEmptySections.length <= 1) return [];

  const lowerBrief = brief.toLowerCase();
  const titleTokens = new Set(tokenize(sourceTitle));
  const briefTokens = tokenize(brief).filter(
    (token) => !SECTION_MATCH_STOP_WORDS.has(token) && !titleTokens.has(token),
  );
  const briefTokenSet = new Set(briefTokens);

  // Explicit structural references such as "Part 3", "Chapter 4", "Experiment 7"
  const structuralRefs: { label: string; value: string }[] = [];
  const structRegex =
    /\b(part|chapter|chap|ch|section|sec|experiment|exp|unit|module|lecture|appendix|phase)\s*(\d+|[ivxlcdm]+)\b/gi;
  for (const match of brief.matchAll(structRegex)) {
    const rawLabel = match[1].toLowerCase();
    const canonicalLabel =
      rawLabel.startsWith('chap') || rawLabel === 'ch'
        ? 'chapter'
        : rawLabel.startsWith('sec')
          ? 'section'
          : rawLabel.startsWith('exp')
            ? 'experiment'
            : rawLabel;
    structuralRefs.push({
      label: canonicalLabel,
      value: match[2].toLowerCase(),
    });
  }

  const scored: {
    section: SourceSection;
    structuralHits: number;
    lexicalHits: number;
  }[] = [];

  for (const section of nonEmptySections) {
    const joinedLower = section.headingPath.join(' ').toLowerCase();
    const headingTokens = tokenize(joinedLower);

    let structuralHits = 0;
    for (const ref of structuralRefs) {
      const refRegex = new RegExp(`\\b${ref.label}\\s*${ref.value}\\b`, 'i');
      if (refRegex.test(joinedLower)) {
        structuralHits += 1;
      }
    }

    let lexicalHits = 0;
    for (const hToken of headingTokens) {
      if (hToken.length < 3 || SECTION_MATCH_STOP_WORDS.has(hToken)) continue;
      if (titleTokens.has(hToken) && !lowerBrief.includes(joinedLower)) {
        continue;
      }
      if (briefTokenSet.has(hToken)) {
        lexicalHits += 1;
        continue;
      }
      // Stem prefix match ( >= 5 chars, e.g. toxic/toxicity, preserve/preservation )
      if (
        hToken.length >= 5 &&
        briefTokens.some(
          (bToken) =>
            bToken.length >= 5 &&
            (hToken.startsWith(bToken.slice(0, 5)) ||
              bToken.startsWith(hToken.slice(0, 5))),
        )
      ) {
        lexicalHits += 1;
      }
    }

    // Check explicit boilerplate section requests (e.g. "Preface", "Bibliography")
    for (const segment of section.headingPath) {
      const norm = normalizeHeadingSegment(segment);
      if (norm.length >= 4 && lowerBrief.includes(norm)) {
        lexicalHits += 2;
      }
    }

    if (structuralHits > 0 || lexicalHits > 0) {
      scored.push({ section, structuralHits, lexicalHits });
    }
  }

  if (scored.length === 0) return [];

  // If any section matched both a structural locator (e.g. "Part 3") AND a leaf lexical token
  // (e.g. "Toxic Lookalikes"), prefer the sections with both hits over sibling sections in the
  // same container or incidental single-word matches in other parts.
  const hasBothHits = scored.some(
    (item) => item.structuralHits > 0 && item.lexicalHits > 0,
  );
  const filtered = hasBothHits
    ? scored.filter((item) => item.structuralHits > 0 && item.lexicalHits > 0)
    : scored;

  const matched = filtered.map((item) => item.section);
  return matched.length < nonEmptySections.length ? matched : [];
}

function planFocusedPasses(input: {
  source: SourceMetaRow;
  sections: SourceSection[];
  excludedChunkIds: string[];
  brief: string;
  budget: number;
  maxPasses: number;
}): PlannedPass[] {
  const { source, sections, excludedChunkIds, brief, budget, maxPasses } =
    input;
  const cleanQuery = brief
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, GENERATION_MAX_PASS_QUERY_CHARS);
  const exclude = excludedChunkIds.length > 0 ? excludedChunkIds : undefined;

  const matchedSections = matchSectionsForBrief(brief, source.title, sections);
  if (matchedSections.length > 0) {
    const passCount = Math.max(
      1,
      Math.min(matchedSections.length, maxPasses, budget),
    );
    const buckets = bucketItems(matchedSections, passCount);
    return buckets.map((bucket) => ({
      sourceId: source.id,
      query: cleanQuery,
      topK: budget,
      headingPaths: bucket.map((sec) => sec.headingPath),
      excludeChunkIds: exclude,
    }));
  }

  // If the Brief explicitly asks about sections/chapters across a multi-section Source
  // without matching a specific section title, run section-scoped passes using
  // PostgreSQL headingPaths / chunkIndexRange filters rather than concatenating
  // truncated headings into the query string.
  const requestsMultiSectionWalk =
    sections.length > 1 && /\b(?:sections?|chapters?|parts?)\b/i.test(brief);

  if (requestsMultiSectionWalk) {
    const passCount = Math.max(1, Math.min(sections.length, maxPasses, budget));
    const buckets = bucketItems(sections, passCount);
    return buckets.map((bucket) => ({
      sourceId: source.id,
      query: cleanQuery,
      topK: budget,
      headingPaths: bucket.map((sec) => sec.headingPath),
      chunkIndexRange: {
        minChunkIndex: Math.min(...bucket.map((sec) => sec.minChunkIndex)),
        maxChunkIndex: Math.max(...bucket.map((sec) => sec.maxChunkIndex)),
      },
      excludeChunkIds: exclude,
    }));
  }

  // Specific Concept Match: single focused hybrid retrieval pass per Source
  return [
    {
      sourceId: source.id,
      query: cleanQuery,
      topK: budget,
      excludeChunkIds: exclude,
    },
  ];
}

function bucketItems<T>(items: T[], bucketCount: number): T[][] {
  const count = Math.max(1, Math.min(items.length, bucketCount));
  const buckets: T[][] = Array.from({ length: count }, () => []);
  items.forEach((item, index) => {
    const bucket = Math.min(
      count - 1,
      Math.floor((index * count) / items.length),
    );
    buckets[bucket].push(item);
  });
  return buckets.filter((bucket) => bucket.length > 0);
}

function postFilterPassChunks(
  chunks: RetrievedChunk[],
  pass: PlannedPass,
): RetrievedChunk[] {
  let result = chunks;
  if (pass.excludeChunkIds && pass.excludeChunkIds.length > 0) {
    const excluded = new Set(pass.excludeChunkIds);
    result = result.filter((chunk) => !excluded.has(chunk.chunkId));
  }
  if (pass.headingPaths && pass.headingPaths.length > 0) {
    const allowed = new Set(pass.headingPaths.map((path) => path.join(' > ')));
    const matching = result.filter((chunk) =>
      allowed.has((chunk.sectionPath ?? []).join(' > ')),
    );
    if (matching.length > 0) {
      result = matching;
    }
  }
  if (pass.chunkIndexRange) {
    const { minChunkIndex, maxChunkIndex } = pass.chunkIndexRange;
    const inRange = result.filter(
      (chunk) =>
        chunk.chunkIndex >= minChunkIndex && chunk.chunkIndex <= maxChunkIndex,
    );
    if (inRange.length > 0) {
      result = inRange;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Deduplication, Adjacent Overlap Stripping & Span Trimming (Ticket 04)
// ---------------------------------------------------------------------------

function extractNumericTokens(text: string): Set<string> {
  return new Set(text.match(/\d+/g) ?? []);
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

export function isNearDuplicateChunk(
  candidate: RetrievedChunk,
  existing: RetrievedChunk,
): boolean {
  const bodyA = stripChunkContentHeader(candidate.content).trim();
  const bodyB = stripChunkContentHeader(existing.content).trim();
  if (!bodyA || !bodyB) return false;
  if (bodyA === bodyB) return true;

  const tokensA = textSignature(bodyA).tokens;
  const tokensB = textSignature(bodyB).tokens;
  const similarity = jaccardSimilarity(tokensA, tokensB);
  if (similarity < NEAR_DUPLICATE_JACCARD_THRESHOLD) {
    return false;
  }

  const sectionKeyA = (candidate.sectionPath ?? []).join(' > ');
  const sectionKeyB = (existing.sectionPath ?? []).join(' > ');
  const sameNonEmptySection =
    sectionKeyA.length > 0 && sectionKeyA === sectionKeyB;
  if (sameNonEmptySection) {
    return true;
  }

  // Across different sections or headingless strata, if two chunks carry distinct
  // numeric identifiers (e.g. synthetic section/stratum fixtures), preserve diversity.
  const numsA = extractNumericTokens(bodyA);
  const numsB = extractNumericTokens(bodyB);
  if ((numsA.size > 0 || numsB.size > 0) && !setsEqual(numsA, numsB)) {
    return false;
  }

  return true;
}

function selectPerPass(
  chunksByPass: RetrievedChunk[][],
  passIndexes: number[],
  budget: number,
): RetrievedChunk[] {
  const seenIds = new Set<string>();
  const selected: RetrievedChunk[] = [];
  const maxRounds = Math.max(
    0,
    ...passIndexes.map((index) => chunksByPass[index]?.length ?? 0),
  );
  for (let round = 0; round < maxRounds; round++) {
    for (const index of passIndexes) {
      const chunk = chunksByPass[index]?.[round];
      if (!chunk || seenIds.has(chunk.chunkId)) continue;
      if (selected.some((existing) => isNearDuplicateChunk(chunk, existing))) {
        seenIds.add(chunk.chunkId);
        continue;
      }
      seenIds.add(chunk.chunkId);
      selected.push(chunk);
      if (selected.length >= budget) return selected;
    }
  }
  return selected;
}

function splitIntoSentences(text: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== '.' && ch !== '!' && ch !== '?' && ch !== '\n') continue;
    let end = i + 1;
    while (end < text.length && '.!?'.includes(text[end])) end++;
    if (ch !== '\n' && end < text.length && !/\s/.test(text[end])) continue;
    const piece = text.slice(start, end).trim();
    if (piece) sentences.push(piece);
    start = end;
    i = end - 1;
  }
  const rest = text.slice(start).trim();
  if (rest) sentences.push(rest);
  return sentences.length > 0 ? sentences : [text.trim()].filter(Boolean);
}

export function stripAdjacentBoundaryOverlap(
  prevContent: string,
  nextContent: string,
): string {
  const headerMatch = nextContent.match(/^(Source: "[^\n]*"\n)/);
  const header = headerMatch ? headerMatch[1] : '';
  const prevBody = stripChunkContentHeader(prevContent).trim();
  const nextBody = stripChunkContentHeader(nextContent).trim();
  if (!prevBody || !nextBody) return nextContent;

  // 1. Check explicit paragraph-separated overlap tail produced by ChunkingService.applyOverlap
  const paraSplit = nextBody.indexOf('\n\n');
  if (paraSplit > 0) {
    const leadPara = nextBody.slice(0, paraSplit).trim();
    if (leadPara.length >= 15 && prevBody.endsWith(leadPara)) {
      const remainder = nextBody.slice(paraSplit + 2).trim();
      if (remainder.length > 0) {
        return `${header}${remainder}`;
      }
    }
  }

  // 2. Check exact suffix-prefix character overlap (>= 20 chars at boundary)
  const maxOverlap = Math.min(prevBody.length, nextBody.length - 1);
  for (let len = maxOverlap; len >= 20; len--) {
    const prefix = nextBody.slice(0, len);
    if (prevBody.endsWith(prefix)) {
      const afterChar = nextBody[len];
      if (!afterChar || /\s/.test(afterChar)) {
        const remainder = nextBody.slice(len).trim();
        if (remainder.length > 0) {
          return `${header}${remainder}`;
        }
      }
    }
  }

  // 3. Check sentence-level boundary overlap between trailing sentences of prevBody
  // and leading sentences of nextBody
  const prevSentences = splitIntoSentences(prevBody);
  const nextSentences = splitIntoSentences(nextBody);
  if (prevSentences.length > 0 && nextSentences.length > 1) {
    const maxK = Math.min(3, prevSentences.length, nextSentences.length - 1);
    for (let k = maxK; k >= 1; k--) {
      const prevTail = prevSentences
        .slice(prevSentences.length - k)
        .join(' ')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
      const nextHead = nextSentences
        .slice(0, k)
        .join(' ')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
      if (prevTail.length >= 15 && prevTail === nextHead) {
        const remainder = nextSentences.slice(k).join(' ').trim();
        if (remainder.length > 0) {
          return `${header}${remainder}`;
        }
      }
    }
  }

  return nextContent;
}

export function applyAdjacentOverlapStripping(promptChunks: RetrievedChunk[]): {
  chunks: RetrievedChunk[];
  promptChunks: RetrievedChunk[];
} {
  const sortedByIndex = [...promptChunks].sort(
    (a, b) => a.chunkIndex - b.chunkIndex,
  );
  const strippedContentByChunkId = new Map<string, string>();
  const chunkByVersionAndIndex = new Map<string, RetrievedChunk>();

  for (const chunk of sortedByIndex) {
    const key = `${chunk.sourceId}::${chunk.sourceVersionId ?? ''}::${chunk.chunkIndex}`;
    chunkByVersionAndIndex.set(key, chunk);
  }

  for (const chunk of sortedByIndex) {
    const prevKey = `${chunk.sourceId}::${chunk.sourceVersionId ?? ''}::${chunk.chunkIndex - 1}`;
    const prevChunk = chunkByVersionAndIndex.get(prevKey);
    if (prevChunk) {
      const stripped = stripAdjacentBoundaryOverlap(
        prevChunk.content,
        chunk.content,
      );
      strippedContentByChunkId.set(chunk.chunkId, stripped);
    } else {
      strippedContentByChunkId.set(chunk.chunkId, chunk.content);
    }
  }

  const updateChunk = (chunk: RetrievedChunk): RetrievedChunk => ({
    ...chunk,
    content: strippedContentByChunkId.get(chunk.chunkId) ?? chunk.content,
  });

  return {
    chunks: sortedByIndex.map(updateChunk),
    promptChunks: promptChunks.map(updateChunk),
  };
}

export function trimChunkForFocusedBrief(
  content: string,
  brief: string,
  maxChars = MAX_FOCUSED_CHUNK_CHARS,
): string {
  const headerMatch = content.match(/^(Source: "[^\n]*"\n)/);
  const header = headerMatch ? headerMatch[1] : '';
  const body = stripChunkContentHeader(content).trim();
  if (body.length <= maxChars) return content;

  const sentences = splitIntoSentences(body);
  if (sentences.length <= 1) return content;

  const briefTokens = new Set(
    tokenize(brief).filter((token) => !GENERIC_SURVEY_WORDS.has(token)),
  );
  const scores = sentences.map((sentence) => {
    if (briefTokens.size === 0) return 0;
    let hits = 0;
    for (const token of tokenize(sentence)) {
      if (briefTokens.has(token)) hits += 1;
    }
    return hits;
  });

  let bestIndex = 0;
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] > scores[bestIndex]) {
      bestIndex = i;
    }
  }

  let start = bestIndex;
  let end = bestIndex;
  let currentLength = sentences[bestIndex].length;

  while (start > 0 || end < sentences.length - 1) {
    const canLeft = start > 0;
    const canRight = end < sentences.length - 1;
    const leftScore = canLeft ? scores[start - 1] : -1;
    const rightScore = canRight ? scores[end + 1] : -1;

    if (canRight && (rightScore >= leftScore || !canLeft)) {
      if (currentLength + 1 + sentences[end + 1].length <= maxChars) {
        end += 1;
        currentLength += 1 + sentences[end].length;
        continue;
      }
      if (
        canLeft &&
        currentLength + 1 + sentences[start - 1].length <= maxChars
      ) {
        start -= 1;
        currentLength += 1 + sentences[start].length;
        continue;
      }
      break;
    }

    if (canLeft) {
      if (currentLength + 1 + sentences[start - 1].length <= maxChars) {
        start -= 1;
        currentLength += 1 + sentences[start].length;
        continue;
      }
      if (
        canRight &&
        currentLength + 1 + sentences[end + 1].length <= maxChars
      ) {
        end += 1;
        currentLength += 1 + sentences[end].length;
        continue;
      }
      break;
    }
  }

  return `${header}${sentences.slice(start, end + 1).join(' ')}`;
}

// ---------------------------------------------------------------------------
// Compact Prompt Formatting with Shared Section Headers (Ticket 04)
// ---------------------------------------------------------------------------

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
  kind?: StudyMaterialKind;
}

interface PreparedChunkBlock {
  chunk: RetrievedChunk;
  chunkId: string;
  sectionKey: string;
  bodyText: string;
  fullTextWithSection: string;
}

export function formatGroundedSourceText(
  grounding: Pick<GenerationGrounding, 'sources' | 'evidence'> & {
    kind?: StudyMaterialKind;
  },
  options: FormatGroundedSourceTextOptions = {},
): FormattedGroundedSourceText {
  const attachedKind =
    options.kind ?? grounding.kind ?? groundingKindByInstance.get(grounding);
  const maxChars =
    options.maxChars ??
    (attachedKind
      ? getKindGroundingBudget(attachedKind).maxPromptChars
      : GENERATION_MAX_PROMPT_SOURCE_CHARS);
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

  const preparedBySource: PreparedChunkBlock[][] = sources.map((source) => {
    const rawList =
      source.promptChunks.length > 0 ? source.promptChunks : source.chunks;
    const { promptChunks: overlapStripped } =
      applyAdjacentOverlapStripping(rawList);
    return overlapStripped.map((chunk) =>
      prepareChunkBlock(chunk, keyByChunkId.get(chunk.chunkId)),
    );
  });

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
    const blocks = preparedBySource[index];
    const keptBlocks: PreparedChunkBlock[] = [];
    const seenSectionsInSource = new Set<string>();
    let used = 0;
    let truncatedFirstBlockText: string | null = null;

    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
      const block = blocks[blockIndex];
      const needsSectionHeader =
        block.sectionKey.length > 0 &&
        !seenSectionsInSource.has(block.sectionKey);
      const candidateText = needsSectionHeader
        ? block.fullTextWithSection
        : block.bodyText;
      const joinChars = keptBlocks.length === 0 ? 0 : BLOCK_SEPARATOR.length;

      if (used + joinChars + candidateText.length <= share) {
        keptBlocks.push(block);
        if (block.sectionKey.length > 0) {
          seenSectionsInSource.add(block.sectionKey);
        }
        used += joinChars + candidateText.length;
        continue;
      }

      if (keptBlocks.length === 0 && share > 0) {
        truncatedFirstBlockText = candidateText.slice(0, share);
        keptBlocks.push(block);
        truncatedChunkIds.push(block.chunkId);
        truncatedSourceIds.push(source.id);
        droppedBlocks.push(blocks.length - 1);
      } else {
        droppedBlocks.push(blocks.length - keptBlocks.length);
      }
      break;
    }

    if (keptBlocks.length === 0) continue;

    if (truncatedFirstBlockText !== null) {
      renderedChunkIds.push(keptBlocks[0].chunkId);
      sections.push(
        `${headerOf(source)}${BLOCK_SEPARATOR}${truncatedFirstBlockText}`,
      );
      continue;
    }

    // Group kept blocks that share the same non-empty sectionKey so consecutive
    // passages under the same section share a single Section header.
    const groupedBlocks = groupKeptBlocksBySection(keptBlocks);
    const renderedStrings: string[] = [];
    let activeSectionKey = '';

    for (const block of groupedBlocks) {
      renderedChunkIds.push(block.chunkId);
      if (
        block.sectionKey.length > 0 &&
        block.sectionKey !== activeSectionKey
      ) {
        renderedStrings.push(block.fullTextWithSection);
        activeSectionKey = block.sectionKey;
      } else {
        renderedStrings.push(block.bodyText);
        if (block.sectionKey.length === 0) {
          activeSectionKey = '';
        }
      }
    }

    sections.push(
      `${headerOf(source)}${BLOCK_SEPARATOR}${renderedStrings.join(BLOCK_SEPARATOR)}`,
    );
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

function prepareChunkBlock(
  chunk: RetrievedChunk,
  citationKey: string | undefined,
): PreparedChunkBlock {
  let rawBody = stripChunkContentHeader(chunk.content);
  let inlineSection = '';
  const sectionLineMatch = rawBody.match(/^Section:\s*([^\n]+)\n/);
  if (sectionLineMatch) {
    inlineSection = sectionLineMatch[1].trim();
    rawBody = rawBody.slice(sectionLineMatch[0].length);
  }

  const sectionKey =
    chunk.sectionPath && chunk.sectionPath.length > 0
      ? chunk.sectionPath.join(' > ')
      : inlineSection;

  const bodyText = citationKey
    ? `[Evidence ${citationKey}]\n${rawBody}`
    : rawBody;
  const fullTextWithSection =
    sectionKey.length > 0 ? `Section: ${sectionKey}\n${bodyText}` : bodyText;

  return {
    chunk,
    chunkId: chunk.chunkId,
    sectionKey,
    bodyText,
    fullTextWithSection,
  };
}

function groupKeptBlocksBySection(
  blocks: PreparedChunkBlock[],
): PreparedChunkBlock[] {
  if (blocks.length <= 1) return blocks;
  const result: PreparedChunkBlock[] = [];
  const bySection = new Map<string, PreparedChunkBlock[]>();

  for (const block of blocks) {
    if (!block.sectionKey) continue;
    const list = bySection.get(block.sectionKey) ?? [];
    list.push(block);
    bySection.set(block.sectionKey, list);
  }

  for (const list of bySection.values()) {
    list.sort((a, b) => a.chunk.chunkIndex - b.chunk.chunkIndex);
  }

  const emittedSections = new Set<string>();
  for (const block of blocks) {
    if (!block.sectionKey) {
      result.push(block);
      continue;
    }
    if (emittedSections.has(block.sectionKey)) continue;
    emittedSections.add(block.sectionKey);
    result.push(...(bySection.get(block.sectionKey) ?? [block]));
  }

  return result;
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
