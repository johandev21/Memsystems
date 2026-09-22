import { Inject, Injectable, Optional } from '@nestjs/common';
import { generateText } from 'ai';
import { AiService } from './ai.service';
import { estimateVoyageTokens } from './providers/voyage.client';
import {
  DEFAULT_REWRITE_CONFIG,
  MAX_REWRITE_OUTPUT_TOKENS,
  RETRIEVAL_REWRITE_CONFIG,
  REWRITE_INSTRUCTIONS,
  buildRewritePrompt,
  parseRewriteResponse,
  type QueryRewriteRequest,
  type QueryRewriteResult,
  type QueryRewriter,
  type RetrievalRewriteConfig,
} from './query-understanding';

/**
 * The gateway-backed rewrite model. It asks the configured chat model for a
 * JSON search query plus optional paraphrases and a hypothetical answer, and
 * validates the reply before the pipeline sees it. A missing gateway key
 * returns `null`; provider failures and unusable replies throw, so the
 * query-understanding stage degrades to its heuristic and records why.
 */
@Injectable()
export class QueryRewriterService implements QueryRewriter {
  private readonly config: RetrievalRewriteConfig;

  constructor(
    private readonly aiService: AiService,
    @Optional()
    @Inject(RETRIEVAL_REWRITE_CONFIG)
    config?: RetrievalRewriteConfig,
  ) {
    this.config = config ?? DEFAULT_REWRITE_CONFIG;
  }

  async rewrite(
    request: QueryRewriteRequest,
  ): Promise<QueryRewriteResult | null> {
    const provider = await this.aiService.getProviderIfConnected();
    if (!provider) return null;

    const prompt = buildRewritePrompt(request);
    const result = await generateText({
      model: provider.createModel(this.config.model),
      instructions: REWRITE_INSTRUCTIONS,
      prompt,
      maxOutputTokens: MAX_REWRITE_OUTPUT_TOKENS,
      abortSignal: request.signal,
      ...this.aiService.getGatewayRequestOptions(),
    });

    const parsed = parseRewriteResponse(result.text, {
      variantCount: request.variantCount,
      hypotheticalAnswer: request.hypotheticalAnswer,
    });
    if (!parsed) {
      throw new Error('The rewrite model returned no usable query.');
    }

    const usage = result.usage as
      { inputTokens?: unknown; outputTokens?: unknown } | undefined;
    return {
      query: parsed.query,
      variants: parsed.variants,
      hypotheticalAnswer: parsed.hypotheticalAnswer,
      inputTokens:
        numericTokens(usage?.inputTokens) ??
        estimateVoyageTokens(REWRITE_INSTRUCTIONS) +
          estimateVoyageTokens(prompt),
      outputTokens:
        numericTokens(usage?.outputTokens) ?? estimateVoyageTokens(result.text),
    };
  }
}

function numericTokens(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null;
}
