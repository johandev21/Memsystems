import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  DEFAULT_REWRITE_CONFIG,
  MAX_REWRITE_HISTORY_CHARS,
  MAX_REWRITE_HISTORY_TURNS,
  QUERY_REWRITER,
  RETRIEVAL_REWRITE_CONFIG,
  type QueryRewriteRequest,
  type QueryUnderstanding,
  type QueryRewriter,
  type RetrievalHistoryTurn,
  type RetrievalRewriteConfig,
} from './query-understanding.config';
import {
  buildHeuristicRewrite,
  decideRewrite,
  isAmbiguousQuery,
} from './query-heuristics';
import {
  executeLlmRewrite,
  sanitizeRewriteQuery,
  sanitizeRewriteVariants,
} from './query-rewriter-llm';

export * from './query-understanding.config';
export * from './query-heuristics';
export * from './query-rewriter-llm';

@Injectable()
export class QueryUnderstandingService {
  private readonly logger = new Logger(QueryUnderstandingService.name);
  private readonly config: RetrievalRewriteConfig;

  constructor(
    @Optional()
    @Inject(RETRIEVAL_REWRITE_CONFIG)
    config?: RetrievalRewriteConfig,
    @Optional()
    @Inject(QUERY_REWRITER)
    private readonly rewriter?: QueryRewriter,
  ) {
    this.config = config ?? DEFAULT_REWRITE_CONFIG;
  }

  async understand(input: {
    message: string;
    history?: RetrievalHistoryTurn[];
  }): Promise<QueryUnderstanding> {
    const message = input.message.trim();
    const history = (input.history ?? [])
      .slice(-MAX_REWRITE_HISTORY_TURNS)
      .map((turn): RetrievalHistoryTurn => ({
        role: turn.role,
        content: turn.content
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, MAX_REWRITE_HISTORY_CHARS),
      }));
    const decision = decideRewrite(message, this.config);
    const base = {
      enabled: this.config.enabled,
      model: this.config.model,
      trigger: decision.trigger,
      inputTokens: 0,
      outputTokens: 0,
      hypotheticalAnswer: null,
    };

    if (!decision.shouldRewrite) {
      return {
        ...base,
        queries: [message],
        strategy: null,
        reason: decision.skipReason,
      };
    }

    const wantsHypothetical =
      this.config.hypotheticalAnswer && isAmbiguousQuery(message);
    const variantCount =
      this.config.multiQuery && decision.trigger === 'ambiguous'
        ? this.config.variantCount
        : 0;
    const request: QueryRewriteRequest = {
      message,
      history,
      variantCount,
      hypotheticalAnswer: wantsHypothetical,
    };

    if (this.rewriter) {
      const outcome = await executeLlmRewrite(
        this.rewriter,
        request,
        this.config.timeoutMs,
      );
      if (outcome.status === 'timeout') {
        this.logger.warn(
          `Rewrite exceeded its ${this.config.timeoutMs}ms budget; using the heuristic.`,
        );
        return this.heuristic(message, history, base, 'timeout');
      }
      if (outcome.status === 'no_provider') {
        return this.heuristic(message, history, base, 'no_provider');
      }
      if (outcome.status === 'failed') {
        this.logger.warn(
          `Rewrite failed; using the heuristic: ${
            outcome.error instanceof Error
              ? outcome.error.message
              : String(outcome.error)
          }`,
        );
        return this.heuristic(message, history, base, 'failed');
      }

      const query = sanitizeRewriteQuery(outcome.result.query);
      if (!query) {
        this.logger.warn(
          'Rewrite returned an empty query; using the heuristic.',
        );
        return this.heuristic(message, history, base, 'failed');
      }
      const variants = sanitizeRewriteVariants(
        outcome.result.variants,
        query,
        variantCount,
      );
      return {
        ...base,
        queries: [query, ...variants],
        hypotheticalAnswer: outcome.result.hypotheticalAnswer,
        strategy: 'model',
        reason: null,
        inputTokens: outcome.result.inputTokens,
        outputTokens: outcome.result.outputTokens,
      };
    }

    return this.heuristic(message, history, base, 'no_provider');
  }

  private heuristic(
    message: string,
    history: RetrievalHistoryTurn[],
    base: Pick<
      QueryUnderstanding,
      | 'enabled'
      | 'model'
      | 'trigger'
      | 'inputTokens'
      | 'outputTokens'
      | 'hypotheticalAnswer'
    >,
    reason: 'no_provider' | 'timeout' | 'failed',
  ): QueryUnderstanding {
    const rewritten = buildHeuristicRewrite(message, history);
    return {
      ...base,
      queries: [rewritten],
      strategy: 'heuristic',
      reason,
    };
  }
}
