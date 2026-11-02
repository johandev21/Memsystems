import type { StudyMaterialKind } from '../../content/shapes';

export interface KindGroundingBudget {
  maxTotalChunksSingleSource: number;
  maxTotalChunksMultiSource: number;
  maxPromptChars: number;
}

export const GENERATION_KIND_BUDGETS: Record<
  StudyMaterialKind,
  KindGroundingBudget
> = {
  audio_overview: {
    maxTotalChunksSingleSource: 10,
    maxTotalChunksMultiSource: 14,
    maxPromptChars: 22_000,
  },
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
