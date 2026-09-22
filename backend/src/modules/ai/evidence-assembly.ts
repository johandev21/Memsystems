import {
  clamp,
  parseBoolean,
  parsePositiveInt,
  parseRatio,
} from './config-parsing';
import { stripChunkContentHeader } from './chunking.service';
import { estimateVoyageTokens } from './providers/voyage.client';

/**
 * Evidence assembly turns the candidates that cleared the relevance threshold
 * into the final passage set the model reads. Retrieval's ranking stages
 * optimise for finding the best individual passages; assembly optimises for
 * the set: overlapping passages collapse to the best-ranked one, one Source
 * cannot fill the whole set, each passage may carry its section context, and
 * the set is bounded by a token budget instead of a character cut. The
 * assembly is pure and deterministic, so the same candidates always produce
 * the same Evidence order.
 */

/** How assembly turns candidates into the model-facing Evidence set. */
export interface RetrievalEvidenceConfig {
  /** Master switch; off restores the pre-assembly top-k selection. */
  enabled: boolean;
  /**
   * Share of a passage's tokens that a better-ranked passage must contain for
   * the passage to count as an overlap and be dropped. The check runs for
   * thresholds in (0, 1); 1 disables it.
   */
  overlapThreshold: number;
  /**
   * How many passages one Source may contribute before the diversity pass
   * parks the rest; overflow backfills when the set is not full. 0 disables
   * the cap.
   */
  maxPerSource: number;
  /** Estimated-token ceiling for the assembled passages. */
  tokenBudget: number;
  /** Carry each selected chunk's section heading path into its passage. */
  sectionExpansion: boolean;
}

export const RETRIEVAL_EVIDENCE_CONFIG = 'RETRIEVAL_EVIDENCE_CONFIG';

/**
 * Documented default for the overlap threshold. Chunks repeat a window of
 * their neighbour's text when a section spans several chunks; a passage 80%
 * contained in a better-ranked passage adds nothing to the model's context.
 */
export const DEFAULT_OVERLAP_THRESHOLD = 0.8;

/**
 * Documented default for the per-Source cap. With the default top-k of 8, no
 * single Source can contribute more than half of the Evidence set; candidates
 * the cap excludes backfill the remaining slots when the set is not full.
 */
export const DEFAULT_MAX_PER_SOURCE = 4;

/**
 * Documented default Evidence budget. It mirrors the Chat's 80,000-character
 * context cap (roughly 20,000 tokens at the provider's 4 chars/token ratio),
 * so assembly bounds the context before the character slice does.
 */
export const DEFAULT_EVIDENCE_TOKEN_BUDGET = 20000;

export const DEFAULT_EVIDENCE_CONFIG: RetrievalEvidenceConfig = {
  enabled: true,
  overlapThreshold: DEFAULT_OVERLAP_THRESHOLD,
  maxPerSource: DEFAULT_MAX_PER_SOURCE,
  tokenBudget: DEFAULT_EVIDENCE_TOKEN_BUDGET,
  sectionExpansion: true,
};

/**
 * Reads the Evidence-assembly configuration from the environment, falling
 * back to the documented defaults for anything unset or unusable.
 */
export function loadRetrievalEvidenceConfig(
  env: NodeJS.ProcessEnv = process.env,
): RetrievalEvidenceConfig {
  const overlapThreshold = parseRatio(
    env.RETRIEVAL_OVERLAP_THRESHOLD,
    DEFAULT_OVERLAP_THRESHOLD,
  );
  return {
    enabled: parseBoolean(env.RETRIEVAL_EVIDENCE_ENABLED, true),
    // Above 1 disables the check; at or below 0 the value is unusable (every
    // passage would overlap) and the default stands.
    overlapThreshold:
      overlapThreshold > 0
        ? Math.min(overlapThreshold, 1)
        : DEFAULT_OVERLAP_THRESHOLD,
    // 0 is a documented value: unlimited.
    maxPerSource: parseNonNegativeInt(
      env.RETRIEVAL_MAX_PER_SOURCE,
      DEFAULT_MAX_PER_SOURCE,
    ),
    tokenBudget: clamp(
      parsePositiveInt(
        env.RETRIEVAL_EVIDENCE_TOKEN_BUDGET,
        DEFAULT_EVIDENCE_TOKEN_BUDGET,
      ),
      1000,
      1000000,
    ),
    sectionExpansion: parseBoolean(env.RETRIEVAL_SECTION_EXPANSION, true),
  };
}

function parseNonNegativeInt(
  value: string | undefined,
  fallback: number,
): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

/** The passage content without the source-title header the chunk carries. */
export function chunkBody(content: string): string {
  return stripChunkContentHeader(content);
}

/** One candidate passage entering assembly. */
export interface EvidencePassage {
  chunkId: string;
  sourceId: string;
  chunkIndex: number;
  /** The heading path of the chunk's section; empty when it has none. */
  sectionPath: string[];
  /** The chunk content, possibly with its source-title header. */
  content: string;
}

/** One selected passage with the assembly decision recorded. */
export interface AssembledEvidenceItem {
  passage: EvidencePassage;
  /** True when the section heading path was carried into the passage. */
  sectionExpanded: boolean;
  /** Estimated tokens of the assembled passage. */
  tokens: number;
}

export interface EvidenceAssembly {
  items: AssembledEvidenceItem[];
  /** Passages dropped because a better-ranked passage contained them. */
  droppedOverlap: EvidencePassage[];
  /** Passages the diversity pass and top-k left out. */
  droppedDiversity: EvidencePassage[];
  /** Passages dropped because the token budget was exhausted. */
  droppedBudget: EvidencePassage[];
  /** Estimated tokens of all assembled passages. */
  tokens: number;
  budgetExhausted: boolean;
}

/**
 * Assembles the final Evidence set. Candidates must arrive in final rank
 * order; the returned order is that order with overlapping passages removed,
 * so the best-ranked representative of each group is the one kept.
 */
export function assembleEvidence(input: {
  candidates: EvidencePassage[];
  topK: number;
  /** Selected-source scope: `topK` bounds each source independently. */
  perSource: boolean;
  config: RetrievalEvidenceConfig;
}): EvidenceAssembly {
  const { candidates, topK, perSource, config } = input;
  const { unique, droppedOverlap } = config.enabled
    ? removeOverlapping(candidates, config.overlapThreshold)
    : { unique: candidates, droppedOverlap: [] as EvidencePassage[] };

  const { selected, droppedDiversity } = selectWithinCaps(unique, {
    topK,
    perSource,
    // In the selected-source scope `topK` already bounds each source, so the
    // diversity cap has nothing to add.
    maxPerSource: config.enabled && !perSource ? config.maxPerSource : 0,
  });

  const { items, droppedBudget, tokens, budgetExhausted } = applyTokenBudget(
    selected,
    config.enabled ? config.sectionExpansion : false,
    config.tokenBudget,
  );

  return {
    items,
    droppedOverlap,
    droppedDiversity,
    droppedBudget,
    tokens,
    budgetExhausted,
  };
}

/**
 * Drops a passage when a better-ranked passage already contains it. The
 * similarity is directional containment, not Jaccard: a short excerpt
 * repeated inside a long passage is an overlap, while a longer candidate that
 * merely contains an earlier passage adds text and is kept.
 */
function removeOverlapping(
  candidates: EvidencePassage[],
  threshold: number,
): { unique: EvidencePassage[]; droppedOverlap: EvidencePassage[] } {
  const unique: EvidencePassage[] = [];
  const keptTokens: Set<string>[] = [];
  const droppedOverlap: EvidencePassage[] = [];

  for (const passage of candidates) {
    const tokens = tokenSet(chunkBody(passage.content));
    const contained =
      threshold > 0 &&
      threshold < 1 &&
      tokens.size > 0 &&
      keptTokens.some((kept) => containedShare(tokens, kept) >= threshold);
    if (contained) {
      droppedOverlap.push(passage);
      continue;
    }
    unique.push(passage);
    keptTokens.push(tokens);
  }

  return { unique, droppedOverlap };
}

/**
 * Applies the per-Source diversity cap first, then backfills the set with the
 * overflow in rank order. The backfill keeps recall when the sources that
 * were skipped have nothing else to offer (for example a single-source
 * Notebook), while a multi-source Notebook still shows breadth before depth.
 */
function selectWithinCaps(
  candidates: EvidencePassage[],
  input: { topK: number; perSource: boolean; maxPerSource: number },
): { selected: EvidencePassage[]; droppedDiversity: EvidencePassage[] } {
  const globalLimit = input.perSource ? Number.POSITIVE_INFINITY : input.topK;
  const perSourceLimit = input.perSource
    ? input.topK
    : input.maxPerSource > 0
      ? input.maxPerSource
      : Number.POSITIVE_INFINITY;

  const counts = new Map<string, number>();
  const selected: EvidencePassage[] = [];
  const overflow: EvidencePassage[] = [];

  for (const passage of candidates) {
    const count = counts.get(passage.sourceId) ?? 0;
    if (selected.length < globalLimit && count < perSourceLimit) {
      counts.set(passage.sourceId, count + 1);
      selected.push(passage);
    } else {
      overflow.push(passage);
    }
  }

  const droppedDiversity: EvidencePassage[] = [];
  for (const passage of overflow) {
    const count = counts.get(passage.sourceId) ?? 0;
    if (selected.length < globalLimit && count < input.topK) {
      counts.set(passage.sourceId, count + 1);
      selected.push(passage);
    } else {
      droppedDiversity.push(passage);
    }
  }

  return { selected, droppedDiversity };
}

/**
 * Bounds the assembled set by the token budget and decides which passages
 * carry their section context. The first selected passage always fits, so the
 * budget can never turn a non-empty result into an abstention: the threshold
 * is what gates Evidence. A section header that no longer fits is dropped
 * before the passage it belongs to.
 */
function applyTokenBudget(
  selected: EvidencePassage[],
  sectionExpansion: boolean,
  tokenBudget: number,
): {
  items: AssembledEvidenceItem[];
  droppedBudget: EvidencePassage[];
  tokens: number;
  budgetExhausted: boolean;
} {
  const items: AssembledEvidenceItem[] = [];
  const droppedBudget: EvidencePassage[] = [];
  let tokens = 0;
  let budgetExhausted = false;

  for (const passage of selected) {
    const bodyTokens = estimateVoyageTokens(chunkBody(passage.content));
    const sectionPath =
      sectionExpansion && passage.sectionPath.length > 0
        ? passage.sectionPath
        : [];
    const sectionTokens =
      sectionPath.length > 0
        ? estimateVoyageTokens(sectionLine(sectionPath))
        : 0;

    let sectionExpanded = sectionPath.length > 0;
    let itemTokens = bodyTokens + sectionTokens;
    if (tokens + itemTokens > tokenBudget) {
      if (items.length > 0) {
        droppedBudget.push(passage);
        budgetExhausted = true;
        continue;
      }
      // The first passage is always kept; shed its section header if the
      // header alone is what breaks the budget.
      if (sectionExpanded && tokens + bodyTokens <= tokenBudget) {
        sectionExpanded = false;
        itemTokens = bodyTokens;
      }
      budgetExhausted = true;
    }

    items.push({ passage, sectionExpanded, tokens: itemTokens });
    tokens += itemTokens;
  }

  return { items, droppedBudget, tokens, budgetExhausted };
}

/** The section line assembly renders into a passage, for token accounting. */
function sectionLine(sectionPath: string[]): string {
  // Keep in step with `formatCitationContext` in chat-citations, which
  // renders the same line into the model-facing passage.
  return `Section: ${sectionPath.join(' > ')}\n`;
}

/** Unicode-aware word tokens, matching the retrieval dedupe tokenizer. */
function tokenSet(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
}

/**
 * The share of the candidate's tokens that the earlier passage also
 * contains: how much of the candidate is already in the model's context.
 */
function containedShare(candidate: Set<string>, kept: Set<string>): number {
  if (candidate.size === 0) return 0;
  let shared = 0;
  for (const token of candidate) {
    if (kept.has(token)) shared++;
  }
  return shared / candidate.size;
}
