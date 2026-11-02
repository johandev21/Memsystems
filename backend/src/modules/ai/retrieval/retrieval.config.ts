import {
  clamp,
  parseBoolean,
  parsePositiveInt,
  parseRatio,
} from '../config-parsing';
import { MAX_RERANK_DOCUMENTS } from '../providers/voyage.client';
import type {
  RetrievalHybridConfig,
  RetrievalRelevanceConfig,
  RetrievalRerankConfig,
} from './retrieval.types';

export const DEFAULT_TOP_K = 8;
export const DEFAULT_RELEVANCE_FLOOR = 0.3;
export const RETRIEVAL_RELEVANCE_CONFIG = 'RETRIEVAL_RELEVANCE_CONFIG';
export const DEFAULT_CANDIDATE_DEPTH = 32;
export const DEFAULT_FUSION_K = 60;
export const DEFAULT_RERANK_MODEL = 'rerank-2.5';
export const DEFAULT_RERANK_THRESHOLD = 0.4;
export const RETRIEVAL_RERANK_CONFIG = 'RETRIEVAL_RERANK_CONFIG';
export const RETRIEVAL_HYBRID_CONFIG = 'RETRIEVAL_HYBRID_CONFIG';

export const DEFAULT_RERANK_CONFIG: RetrievalRerankConfig = {
  enabled: true,
  model: DEFAULT_RERANK_MODEL,
  candidateDepth: DEFAULT_CANDIDATE_DEPTH,
  threshold: DEFAULT_RERANK_THRESHOLD,
  topK: DEFAULT_TOP_K,
};

export const DEFAULT_HYBRID_CONFIG: RetrievalHybridConfig = {
  enabled: true,
  fusionK: DEFAULT_FUSION_K,
  denseWeight: 1,
  lexicalWeight: 1,
  denseCandidateDepth: null,
  lexicalCandidateDepth: null,
};

export function loadRetrievalRelevanceConfig(
  env: NodeJS.ProcessEnv = process.env,
): RetrievalRelevanceConfig {
  return {
    relevanceFloor: clamp(
      parseRatio(env.RETRIEVAL_RELEVANCE_FLOOR, DEFAULT_RELEVANCE_FLOOR),
      0,
      1,
    ),
  };
}

export function loadRetrievalRerankConfig(
  env: NodeJS.ProcessEnv = process.env,
): RetrievalRerankConfig {
  return {
    enabled: parseBoolean(env.RETRIEVAL_RERANK_ENABLED, true),
    model: env.RETRIEVAL_RERANK_MODEL?.trim() || DEFAULT_RERANK_MODEL,
    candidateDepth: clamp(
      parsePositiveInt(env.RETRIEVAL_CANDIDATE_DEPTH, DEFAULT_CANDIDATE_DEPTH),
      1,
      MAX_RERANK_DOCUMENTS,
    ),
    threshold: clamp(
      parseRatio(env.RETRIEVAL_RERANK_THRESHOLD, DEFAULT_RERANK_THRESHOLD),
      0,
      1,
    ),
    topK: Math.max(1, parsePositiveInt(env.RETRIEVAL_TOP_K, DEFAULT_TOP_K)),
  };
}

export function loadRetrievalHybridConfig(
  env: NodeJS.ProcessEnv = process.env,
): RetrievalHybridConfig {
  return {
    enabled: parseBoolean(env.RETRIEVAL_HYBRID_ENABLED, true),
    fusionK: clamp(
      parsePositiveInt(env.RETRIEVAL_RRF_K, DEFAULT_FUSION_K),
      1,
      MAX_RERANK_DOCUMENTS,
    ),
    denseWeight: clamp(parseRatio(env.RETRIEVAL_RRF_DENSE_WEIGHT, 1), 0, 1),
    lexicalWeight: clamp(parseRatio(env.RETRIEVAL_RRF_LEXICAL_WEIGHT, 1), 0, 1),
    denseCandidateDepth: parseDepthOverride(
      env.RETRIEVAL_DENSE_CANDIDATE_DEPTH,
    ),
    lexicalCandidateDepth: parseDepthOverride(
      env.RETRIEVAL_LEXICAL_CANDIDATE_DEPTH,
    ),
  };
}

function parseDepthOverride(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return clamp(parsed, 1, MAX_RERANK_DOCUMENTS);
}
