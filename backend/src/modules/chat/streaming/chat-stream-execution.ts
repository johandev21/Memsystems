import type { Logger } from '@nestjs/common';
import { streamText } from 'ai';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../../database/schema';
import type { GroundingMode } from '../../../database/schema';
import type { AiService } from '../../ai/ai.service';
import { resolveModelId } from '../../ai/providers/model-catalog';
import { toClientStreamError } from '../../ai/stream-error';
import { type CitationEvidence, verifyCitations } from '../chat-citations';
import type { SendInput } from '../chat.types';
import { persistAssistantChatMessage } from './chat-assistant-persistence';
import {
  buildChatSystemPrompt,
  prepareLanguageModelMessages,
  validateAttachmentsAndCapabilities,
} from './chat-language-model-messages';

export {
  SYSTEM_PROMPT,
  buildChatSystemPrompt,
  prepareLanguageModelMessages,
} from './chat-language-model-messages';
export { persistAssistantChatMessage } from './chat-assistant-persistence';

export interface ExecuteChatStreamOptions {
  db: NodePgDatabase<typeof appSchema>;
  logger: Pick<Logger, 'warn' | 'error' | 'debug'>;
  aiService: AiService;
  notebookId: string;
  input: SendInput;
  userMessage: { id: string };
  assistantMessageId: string;
  groundingMode: GroundingMode;
  citationEvidence: CitationEvidence[];
  sourceContext: string;
  history: Array<{
    role: string;
    content: string;
    parts?: unknown;
  }>;
  hasRetrievedChunks: boolean;
}

export async function executeChatStream({
  db,
  logger,
  aiService,
  notebookId,
  input,
  userMessage,
  assistantMessageId,
  groundingMode,
  citationEvidence,
  sourceContext,
  history,
  hasRetrievedChunks,
}: ExecuteChatStreamOptions) {
  const modelId = input.model;
  const provider = await aiService.getProviderForModel(modelId);
  validateAttachmentsAndCapabilities(input.parts, aiService, provider, modelId);

  const selectedModel = provider
    .listModels?.()
    .find((candidate) => candidate.id === modelId);

  const model = provider.createModel(modelId);
  const requestOptions = aiService.getGatewayRequestOptions();

  const systemMessage = buildChatSystemPrompt({
    sourceContext,
    groundingMode,
    hasRetrievedChunks,
  });

  const messagesForLlm = prepareLanguageModelMessages(history);

  const startTime = new Date();
  let streamedText = '';
  let streamedReasoning = '';
  let assistantMessagePersisted = false;
  let gatewayGenerationId: string | undefined;
  let servedModelId: string | undefined;

  const persistAssistantMessage = async (
    text: string,
    reasoning: string | null,
    customMetadata?: Record<string, unknown>,
  ) => {
    if (assistantMessagePersisted || !text.trim()) return;
    assistantMessagePersisted = true;
    await persistAssistantChatMessage({
      db,
      logger,
      notebookId,
      userMessageId: userMessage.id,
      assistantMessageId,
      modelId,
      groundingMode,
      citationEvidence,
      startTime,
      text,
      reasoning,
      customMetadata,
    });
  };

  let result: ReturnType<typeof streamText>;
  try {
    result = streamText({
      model,
      abortSignal: input.abortSignal,
      instructions: systemMessage,
      messages: messagesForLlm,
      ...requestOptions,
      onChunk: ({ chunk }) => {
        if (chunk.type === 'text-delta') streamedText += chunk.text;
        if (chunk.type === 'reasoning-delta') {
          const asRecord = chunk as unknown as Record<string, unknown>;
          const delta =
            typeof asRecord.text === 'string'
              ? asRecord.text
              : typeof asRecord.textDelta === 'string'
                ? asRecord.textDelta
                : '';
          streamedReasoning += delta;
        }
      },
      onError: ({ error }) => {
        logger.error('streamText onError', {
          error: error instanceof Error ? error.message : String(error),
        });
      },
      onLanguageModelCallEnd: ({ providerMetadata }) => {
        const gatewayMeta = providerMetadata?.gateway as
          | {
              generationId?: unknown;
              routing?: {
                originalModelId?: unknown;
                canonicalSlug?: unknown;
              };
            }
          | undefined;
        const generationId = gatewayMeta?.generationId;
        const served =
          gatewayMeta?.routing?.canonicalSlug ??
          gatewayMeta?.routing?.originalModelId;
        if (typeof served === 'string' && served.length > 0) {
          servedModelId = served;
          if (resolveModelId(served) !== resolveModelId(modelId)) {
            throw new Error(
              `model_substituted: requested ${modelId} but the gateway served ${served}. No model substitution is allowed — pick a model your plan includes.`,
            );
          }
        }
        if (typeof generationId === 'string' && generationId) {
          gatewayGenerationId = generationId;
          logger.debug('gateway generation completed', {
            modelId,
            generationId,
            gateway: providerMetadata?.gateway ?? null,
          });
        }
      },
      onEnd: async ({ text, reasoning, usage, finishReason }) => {
        const reasoningString = reasoning
          ? typeof reasoning === 'string'
            ? reasoning
            : Array.isArray(reasoning)
              ? reasoning
                  .map((r) =>
                    typeof r === 'object' && r && 'text' in r
                      ? (r as { text: string }).text
                      : '',
                  )
                  .join('')
              : null
          : null;

        const rawUsage = usage as Record<string, unknown> | undefined;
        const inputTokens =
          rawUsage?.inputTokens ?? rawUsage?.promptTokens ?? undefined;
        const outputTokens =
          rawUsage?.outputTokens ?? rawUsage?.completionTokens ?? undefined;
        const totalTokens = rawUsage?.totalTokens ?? undefined;

        await persistAssistantMessage(text, reasoningString, {
          finishReason: String(finishReason),
          ...(gatewayGenerationId ? { gatewayGenerationId } : {}),
          ...(servedModelId ? { servedModelId } : {}),
          usage: rawUsage
            ? {
                inputTokens:
                  typeof inputTokens === 'number' ? inputTokens : undefined,
                outputTokens:
                  typeof outputTokens === 'number' ? outputTokens : undefined,
                totalTokens:
                  typeof totalTokens === 'number' ? totalTokens : undefined,
              }
            : undefined,
        });
      },
      onAbort: async () => {
        await persistAssistantMessage(streamedText, streamedReasoning || null, {
          finishReason: 'cancelled',
        });
      },
    });
  } catch (error) {
    logger.error('streamText threw synchronously', error);
    throw error;
  }

  return {
    streamResponse: result.toUIMessageStreamResponse({
      generateMessageId: () => assistantMessageId,
      sendReasoning: true,
      messageMetadata: ({ part }) => {
        if (part.type === 'start') {
          return {
            modelId,
            citedSources: citationEvidence,
          };
        }
        if (part.type === 'finish') {
          const verification = verifyCitations(streamedText, citationEvidence, {
            attribution: false,
          });
          return {
            modelId,
            finishReason: part.finishReason,
            totalUsage: part.totalUsage,
            citedSources: verification.entries,
            citationCheck: {
              resolved: verification.entries.length,
              attributed: verification.attributedClaims,
              dropped: verification.droppedKeys.length,
            },
          };
        }
      },
      onError: (error) =>
        toClientStreamError(error, {
          id: modelId,
          displayName: selectedModel?.displayName,
        }),
    }),
    userMessageId: userMessage.id,
  };
}
