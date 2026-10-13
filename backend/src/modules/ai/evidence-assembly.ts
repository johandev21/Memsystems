import {
  clamp,
  parseBoolean,
  parseNonNegativeInt,
  parsePositiveInt,
  parseRatio,
} from './config-parsing';
import { stripChunkContentHeader } from './chunking.service';
import { estimateVoyageTokens } from './providers/voyage.client';
import { containedShare, textSignature } from './text-similarity';

export interface RetrievalEvidenceConfig {
  enabled: boolean;
  overlapThreshold: number;
  maxPerSource: number;
  tokenBudget: number;
  sectionExpansion: boolean;
}

export const RETRIEVAL_EVIDENCE_CONFIG = 'RETRIEVAL_EVIDENCE_CONFIG';

export const DEFAULT_OVERLAP_THRESHOLD = 0.8;

export const DEFAULT_MAX_PER_SOURCE = 4;

export const DEFAULT_EVIDENCE_TOKEN_BUDGET = 20000;

export const DEFAULT_EVIDENCE_CONFIG: RetrievalEvidenceConfig = {
  enabled: true,
  overlapThreshold: DEFAULT_OVERLAP_THRESHOLD,
  maxPerSource: DEFAULT_MAX_PER_SOURCE,
  tokenBudget: DEFAULT_EVIDENCE_TOKEN_BUDGET,
  sectionExpansion: true,
};

export function loadRetrievalEvidenceConfig(
  env: NodeJS.ProcessEnv = process.env,
): RetrievalEvidenceConfig {
  const overlapThreshold = parseRatio(
    env.RETRIEVAL_OVERLAP_THRESHOLD,
    DEFAULT_OVERLAP_THRESHOLD,
  );
  return {
    enabled: parseBoolean(env.RETRIEVAL_EVIDENCE_ENABLED, true),
    overlapThreshold:
      overlapThreshold > 0
        ? Math.min(overlapThreshold, 1)
        : DEFAULT_OVERLAP_THRESHOLD,
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

export function chunkBody(content: string): string {
  return stripChunkContentHeader(content);
}

export interface EvidencePassage {
  chunkId: string;
  sourceId: string;
  chunkIndex: number;
  sectionPath: string[];
  content: string;
}

export interface AssembledEvidenceItem {
  passage: EvidencePassage;
  sectionExpanded: boolean;
  tokens: number;
}

export interface EvidenceAssembly {
  items: AssembledEvidenceItem[];
  droppedOverlap: EvidencePassage[];
  droppedDiversity: EvidencePassage[];
  droppedBudget: EvidencePassage[];
  tokens: number;
  budgetExhausted: boolean;
}

export function assembleEvidence(input: {
  candidates: EvidencePassage[];
  topK: number;
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

function removeOverlapping(
  candidates: EvidencePassage[],
  threshold: number,
): { unique: EvidencePassage[]; droppedOverlap: EvidencePassage[] } {
  const unique: EvidencePassage[] = [];
  const keptSignatures: ReturnType<typeof textSignature>[] = [];
  const droppedOverlap: EvidencePassage[] = [];

  for (const passage of candidates) {
    const signature = textSignature(chunkBody(passage.content));
    const contained =
      threshold > 0 &&
      threshold < 1 &&
      signature.tokens.size > 0 &&
      keptSignatures.some(
        (kept) => containedShare(signature, kept) >= threshold,
      );
    if (contained) {
      droppedOverlap.push(passage);
      continue;
    }
    unique.push(passage);
    keptSignatures.push(signature);
  }

  return { unique, droppedOverlap };
}

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

function sectionLine(sectionPath: string[]): string {
  return `Section: ${sectionPath.join(' > ')}\n`;
}
