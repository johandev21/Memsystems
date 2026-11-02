import { clamp, parseBoolean, parsePositiveInt } from '../config-parsing';
import {
  MAX_TRACE_HYPOTHETICAL_CHARS,
  type RetrievalTraceRewrite,
} from './retrieval-trace';

export interface RetrievalHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

export type QueryRewriteTrigger =
  'meta_instructions' | 'follow_up' | 'ambiguous';

export type RetrievalRewriteReason =
  | 'disabled'
  | 'empty_message'
  | 'search_ready'
  | 'no_provider'
  | 'timeout'
  | 'failed';

export const MAX_REWRITE_HISTORY_TURNS = 4;
export const MAX_REWRITE_HISTORY_CHARS = 600;

export const MAX_REWRITE_TOPIC_TERMS = 8;

export const MIN_REWRITE_CONTENT_WORDS = 3;

export interface QueryRewriteRequest {
  message: string;
  history: RetrievalHistoryTurn[];
  variantCount: number;
  hypotheticalAnswer: boolean;
  signal?: AbortSignal;
}

export interface QueryRewriteResult {
  query: string;
  variants: string[];
  hypotheticalAnswer: string | null;
  inputTokens: number;
  outputTokens: number;
}

export interface QueryRewriter {
  rewrite(request: QueryRewriteRequest): Promise<QueryRewriteResult | null>;
}

export interface RetrievalRewriteConfig {
  enabled: boolean;
  model: string;
  timeoutMs: number;
  multiQuery: boolean;
  variantCount: number;
  hypotheticalAnswer: boolean;
}

export const RETRIEVAL_REWRITE_CONFIG = 'RETRIEVAL_REWRITE_CONFIG';

export const QUERY_REWRITER = 'QUERY_REWRITER';

export const DEFAULT_REWRITE_MODEL = 'openai/gpt-4o-mini';

export const DEFAULT_REWRITE_TIMEOUT_MS = 1200;

export const DEFAULT_REWRITE_VARIANT_COUNT = 2;

export const MAX_REWRITE_VARIANTS = 4;

export const MAX_REWRITE_OUTPUT_TOKENS = 400;

export const MAX_REWRITE_QUERY_CHARS = 600;
export const MAX_REWRITE_HYPOTHETICAL_CHARS = 600;

export const DEFAULT_REWRITE_CONFIG: RetrievalRewriteConfig = {
  enabled: true,
  model: DEFAULT_REWRITE_MODEL,
  timeoutMs: DEFAULT_REWRITE_TIMEOUT_MS,
  multiQuery: true,
  variantCount: DEFAULT_REWRITE_VARIANT_COUNT,
  hypotheticalAnswer: false,
};

export function loadRetrievalRewriteConfig(
  env: NodeJS.ProcessEnv = process.env,
): RetrievalRewriteConfig {
  return {
    enabled: parseBoolean(env.RETRIEVAL_REWRITE_ENABLED, true),
    model: env.RETRIEVAL_REWRITE_MODEL?.trim() || DEFAULT_REWRITE_MODEL,
    timeoutMs: clamp(
      parsePositiveInt(
        env.RETRIEVAL_REWRITE_TIMEOUT_MS,
        DEFAULT_REWRITE_TIMEOUT_MS,
      ),
      1,
      10000,
    ),
    multiQuery: parseBoolean(env.RETRIEVAL_REWRITE_MULTI_QUERY, true),
    variantCount: clamp(
      parsePositiveInt(
        env.RETRIEVAL_REWRITE_VARIANT_COUNT,
        DEFAULT_REWRITE_VARIANT_COUNT,
      ),
      1,
      MAX_REWRITE_VARIANTS,
    ),
    hypotheticalAnswer: parseBoolean(
      env.RETRIEVAL_REWRITE_HYPOTHETICAL_ANSWER,
      false,
    ),
  };
}

export interface RewriteDecision {
  shouldRewrite: boolean;
  trigger: QueryRewriteTrigger | null;
  skipReason: 'disabled' | 'empty_message' | 'search_ready' | null;
}

export interface QueryUnderstanding {
  enabled: boolean;
  queries: string[];
  hypotheticalAnswer: string | null;
  trigger: QueryRewriteTrigger | null;
  strategy: 'model' | 'heuristic' | null;
  reason: RetrievalRewriteReason | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export function passthroughUnderstanding(query: string): QueryUnderstanding {
  return {
    enabled: false,
    queries: [query],
    hypotheticalAnswer: null,
    trigger: null,
    strategy: null,
    reason: 'disabled',
    model: DEFAULT_REWRITE_CONFIG.model,
    inputTokens: 0,
    outputTokens: 0,
  };
}

export function traceRewrite(
  understanding: QueryUnderstanding,
  original: string,
): RetrievalTraceRewrite {
  return {
    enabled: understanding.enabled,
    original,
    query: understanding.queries[0],
    variants: understanding.queries.slice(1),
    hypotheticalAnswer: understanding.hypotheticalAnswer
      ? understanding.hypotheticalAnswer.slice(0, MAX_TRACE_HYPOTHETICAL_CHARS)
      : null,
    trigger: understanding.trigger,
    strategy: understanding.strategy,
    reason: understanding.reason,
    model: understanding.model,
  };
}
