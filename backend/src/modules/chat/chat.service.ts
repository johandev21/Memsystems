import { Inject, Injectable, Logger } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import { streamText } from 'ai';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import {
  notebookChatMessages,
  notebooks,
  sources,
} from '../../database/schema';
import { AiService } from '../ai/ai.service';
import { ConnectionService } from '../ai/connection.service';
import { toClientStreamError } from '../ai/stream-error';
import { resolveModelId } from '../ai/providers/model-catalog';
import { RetrievalService } from '../ai/retrieval.service';
import type { CitationLocator } from '../ai/retrieval.service';
import { DRIZZLE } from '../database/database.module';
import { NotebooksService } from '../notebooks/notebooks.service';
import {
  type CitedSourceEntry,
  type StoredCitedSourceEntry,
  createCitationEvidence,
  extractCitationEntries,
  formatCitationContext,
  normalizeStoredCitation,
  sanitizeReferenceUrl,
} from './chat-citations';

const MAX_HISTORY_MESSAGES = 6;
const MAX_SOURCE_TEXT = 80000;

const SYSTEM_PROMPT = `You are a knowledgeable tutor and research assistant. Help the user master their topics of interest using the provided source passages or your general knowledge.

GROUNDING & CITATION RULES:
- If provided passages lack sufficient info, state this clearly and offer general knowledge.
- Prioritize source-backed claims. Clearly separate source-derived info from general knowledge.
- Never treat source availability as "permission" to answer; they are for evidence only.
- Cite source-backed claims with the evidence key shown in the passages, using exactly this syntax at the end of the supported sentence: [ref:R1].
- Emit citations as plain text only: never wrap them in backticks, code spans, or markdown links such as [1](#reference-R1).
- Use only evidence keys that were provided. Never invent a key, a display number, or put source titles inside citation markers.
- Do not discuss retrieval mechanics (e.g., source counts, indexing, loaded documents).

TUTORING & ENGAGEMENT:
- Deliver clear, well-structured, insightful explanations grounded in the sources.
- Never use emojis in responses.
- Foster active learning and retention: when explaining concepts, ask the learner to recall or explain key principles, or ask at most one focused reflective question at the end to check understanding.
- When an image or document is provided, thoroughly analyze its visual content, diagrams, or handwritten steps in connection with the user question.
- CRITICAL: Produce a single assistant response. Respond ONLY to the user. Do not simulate a multi-turn conversation or fabricate user labels (e.g., "User:", "Q:").`;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string | null;
  parts?: Record<string, unknown>[] | null;
  metadata?: Record<string, unknown> | null;
  citedSourceIds: CitedSourceEntry[] | null;
  citedSources: CitedSourceMeta[];
  createdAt: Date;
}

interface CitedSourceMeta {
  id: string;
  schemaVersion: number;
  citationKey: string;
  chunkId: string | null;
  chunkIndex: number | null;
  sourceVersionId: string | null;
  locator: CitationLocator | null;
  number: number;
  title: string;
  kind: string;
  url: string | null;
  description: string | null;
  quote: string | null;
  isAvailable: boolean;
}

export interface SendInput {
  content: string;
  parts?: Record<string, unknown>[];
  messageId?: string;
  regenerateMessageId?: string;
  model: string;
  abortSignal?: AbortSignal;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly notebooksService: NotebooksService,
    private readonly aiService: AiService,
    private readonly connectionService: ConnectionService,
    private readonly retrievalService: RetrievalService,
  ) {}

  async listMessages(notebookId: string): Promise<ChatMessage[]> {
    await this.notebooksService.assertNotebookOwner(notebookId);

    const rows = await this.db
      .select()
      .from(notebookChatMessages)
      .where(eq(notebookChatMessages.notebookId, notebookId))
      .orderBy(asc(notebookChatMessages.createdAt));

    const allCitedIds = [
      ...new Set(
        rows.flatMap((r) => {
          const raw = (r.citedSourceIds ?? []) as StoredCitedSourceEntry[];
          return raw.map((e) => (typeof e === 'string' ? e : e.sourceId));
        }),
      ),
    ];

    const citedMetaMap = new Map<string, CitedSourceMeta>();
    if (allCitedIds.length > 0) {
      const sourceRows = await this.db
        .select({
          id: sources.id,
          title: sources.title,
          kind: sources.kind,
          url: sources.url,
        })
        .from(sources)
        .where(
          and(
            eq(sources.notebookId, notebookId),
            inArray(sources.id, allCitedIds),
          ),
        );
      for (const src of sourceRows) {
        citedMetaMap.set(src.id, {
          id: src.id,
          schemaVersion: 0,
          citationKey: '',
          chunkId: null,
          chunkIndex: null,
          sourceVersionId: null,
          locator: null,
          number: 0,
          title: src.title,
          kind: src.kind,
          url: sanitizeReferenceUrl(src.url),
          description: null,
          quote: null,
          isAvailable: true,
        });
      }
    }

    return rows.map((r) => {
      const rawEntries = (r.citedSourceIds ?? []) as StoredCitedSourceEntry[];
      const entries = rawEntries.map(normalizeStoredCitation);
      const citedSources: CitedSourceMeta[] = entries.map((e) => {
        const meta = citedMetaMap.get(e.sourceId);

        return {
          id: e.sourceId,
          schemaVersion: e.schemaVersion,
          citationKey: e.citationKey,
          chunkId: e.chunkId,
          chunkIndex: e.chunkIndex,
          sourceVersionId: e.sourceVersionId,
          locator: e.locator,
          number: e.number,
          title: e.title ?? meta?.title ?? 'Unavailable reference',
          kind: e.kind ?? meta?.kind ?? 'unknown',
          url: e.url ?? meta?.url ?? null,
          description: e.description,
          quote: e.quote,
          isAvailable: !!meta,
        };
      });

      let parts = r.parts;
      if (!parts || parts.length === 0) {
        parts = [];
        if (r.reasoning && r.reasoning.trim()) {
          parts.push({ type: 'reasoning', text: r.reasoning });
        }
        if (r.content) {
          parts.push({ type: 'text', text: r.content });
        }
      }

      return {
        id: r.id,
        role: r.role,
        content: r.content,
        reasoning: r.reasoning,
        parts,
        metadata: r.metadata,
        citedSourceIds: entries,
        citedSources,
        createdAt: r.createdAt,
      };
    });
  }

  extractUserMessageContent(
    messages: { role: string; parts: { type: string; text?: string }[] }[],
  ): string {
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === 'user');
    const textPart = lastUserMessage?.parts.find((p) => p.type === 'text');
    return textPart?.text ?? '';
  }

  extractUserMessageParts(
    messages: { role: string; parts: Record<string, unknown>[] }[],
  ): Record<string, unknown>[] {
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === 'user');
    return lastUserMessage?.parts ?? [];
  }

  async sendMessage(notebookId: string, input: SendInput) {
    await this.notebooksService.assertNotebookOwner(notebookId);
    await this.connectionService.requireConnected(input.model);

    // An image/file-only message has no text to embed. Retrieval is optional
    // for multimodal turns, so let the model inspect the supplied parts
    // directly instead of passing an empty query to the embedding provider.
    const retrievedChunks = input.content.trim()
      ? await this.retrievalService.retrieveRelevantChunks(
          notebookId,
          input.content,
          8,
        )
      : [];
    const citationEvidence = createCitationEvidence(retrievedChunks);

    const sourceContext = formatCitationContext(citationEvidence).slice(
      0,
      MAX_SOURCE_TEXT,
    );

    // When regenerating, previous assistant versions are preserved in history as separate versions

    let userMessage: {
      id: string;
      role: 'user';
      content: string;
      parts: Record<string, unknown>[] | null;
      createdAt: Date;
    };

    const existingUserRows = input.messageId
      ? await this.db
          .select()
          .from(notebookChatMessages)
          .where(
            and(
              eq(notebookChatMessages.id, input.messageId),
              eq(notebookChatMessages.notebookId, notebookId),
            ),
          )
      : [];

    if (existingUserRows.length > 0) {
      userMessage = {
        id: existingUserRows[0].id,
        role: 'user',
        content: existingUserRows[0].content,
        parts: existingUserRows[0].parts,
        createdAt: existingUserRows[0].createdAt,
      };
    } else {
      const userParts =
        input.parts && input.parts.length > 0
          ? input.parts
          : [{ type: 'text', text: input.content }];

      const [inserted] = await this.db
        .insert(notebookChatMessages)
        .values({
          id: input.messageId || createId(),
          notebookId,
          role: 'user',
          content: input.content,
          parts: userParts,
          metadata: { modelId: input.model },
        })
        .returning();

      userMessage = {
        id: inserted.id,
        role: 'user',
        content: inserted.content,
        parts: inserted.parts,
        createdAt: inserted.createdAt,
      };

      await this.db
        .update(notebooks)
        .set({ updatedAt: new Date() })
        .where(eq(notebooks.id, notebookId));
    }

    const priorHistory = await this.getRecentHistory(
      notebookId,
      MAX_HISTORY_MESSAGES,
      userMessage.id,
    );

    const history = [
      ...priorHistory,
      {
        id: userMessage.id,
        role: 'user' as const,
        content: userMessage.content,
        parts: userMessage.parts,
        citedSourceIds: null,
        createdAt: userMessage.createdAt,
      },
    ];

    input.abortSignal?.throwIfAborted();

    const modelId = input.model;
    const provider = await this.aiService.getProviderForModel(modelId);
    const submittedParts = input.parts ?? [];
    const hasImageInput = submittedParts.some(
      (part) =>
        part.type === 'file' &&
        typeof part.mediaType === 'string' &&
        part.mediaType.startsWith('image/'),
    );
    const hasFileInput = submittedParts.some(
      (part) =>
        part.type === 'file' &&
        (typeof part.mediaType !== 'string' ||
          !part.mediaType.startsWith('image/')),
    );
    if (hasImageInput) {
      this.aiService.requireCapability(
        provider,
        modelId,
        'imageInput',
        'image attachments',
      );
    }
    if (hasFileInput) {
      this.aiService.requireCapability(
        provider,
        modelId,
        'fileInput',
        'file attachments',
      );
    }
    const selectedModel = provider
      .listModels?.()
      .find((candidate) => candidate.id === modelId);
    // Always forward reasoning chunks when the model emits them. Gating on
    // the static capability catalog caused reasoning-capable models that were
    // misclassified to stream no reasoning live (reasoning only appeared
    // after persist + history refetch). `sendReasoning: true` is a no-op for
    // models that emit no reasoning.
    // `selectedModel` is still used for error messages below.
    void selectedModel;
    const model = provider.createModel(modelId);
    const requestOptions = this.aiService.getGatewayRequestOptions();

    const systemMessage =
      retrievedChunks.length > 0
        ? `${SYSTEM_PROMPT}\n\n---\n\nRELEVANT SOURCE PASSAGES:\n\n${sourceContext}`
        : SYSTEM_PROMPT;

    const messagesForLlm = history.map((m) => {
      const parts =
        (m.parts as Array<{
          type: string;
          text?: string;
          mediaType?: string;
          url?: string;
        }>) || [];
      const hasImage = parts.some(
        (p) => p.type === 'file' && p.mediaType?.startsWith('image/'),
      );

      if (m.role === 'user' && hasImage) {
        const contentParts: Array<
          { type: 'text'; text: string } | { type: 'image'; image: string }
        > = [];
        for (const p of parts) {
          if (p.type === 'text' && p.text) {
            contentParts.push({ type: 'text', text: p.text });
          } else if (
            p.type === 'file' &&
            p.url &&
            p.mediaType?.startsWith('image/')
          ) {
            contentParts.push({ type: 'image', image: p.url });
          }
        }
        if (contentParts.length === 0) {
          contentParts.push({ type: 'text', text: m.content });
        }
        return {
          role: 'user' as const,
          content: contentParts,
        };
      }

      return {
        role: m.role,
        content: m.content,
      };
    });

    const assistantMessageId = createId();
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

      const citedEntries = extractCitationEntries(text, citationEvidence);

      const parts: Record<string, unknown>[] = [];
      if (reasoning && reasoning.trim()) {
        parts.push({ type: 'reasoning', text: reasoning });
      }
      if (text) {
        parts.push({ type: 'text', text });
      }

      const metadata: Record<string, unknown> = {
        modelId,
        createdAt: startTime.toISOString(),
        completedAt: new Date().toISOString(),
        ...customMetadata,
      };

      try {
        await this.db.insert(notebookChatMessages).values({
          id: assistantMessageId,
          notebookId,
          role: 'assistant',
          content: text,
          reasoning,
          parts,
          metadata,
          citedSourceIds: citedEntries,
        });
      } catch (dbError) {
        this.logger.error('failed to persist assistant message', dbError);
      }
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
            // `text` is the ai v7 field; fall back to legacy `textDelta`
            // so abort-persist still captures reasoning across SDK shapes.
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
          this.logger.error('streamText onError', {
            error: error instanceof Error ? error.message : String(error),
          });
        },
        onLanguageModelCallEnd: ({ providerMetadata }) => {
          // Gateway generation id for cost/usage lookup (getGenerationInfo).
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
          // Fail loud on model substitution: the gateway must serve the
          // requested model or fail. Serving a different model silently
          // (e.g. via fallbacks) would present the wrong model as working.
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
            this.logger.debug('gateway generation completed', {
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
          await persistAssistantMessage(
            streamedText,
            streamedReasoning || null,
            { finishReason: 'cancelled' },
          );
        },
      });
    } catch (error) {
      this.logger.error('streamText threw synchronously', error);
      throw error;
    }

    return {
      streamResponse: result.toUIMessageStreamResponse({
        generateMessageId: () => assistantMessageId,
        sendReasoning: true,
        messageMetadata: ({ part }) => {
          if (part.type === 'finish') {
            return {
              modelId,
              finishReason: part.finishReason,
              totalUsage: part.totalUsage,
            };
          }
        },
        // The SDK masks raw server errors ("An error occurred.") by default,
        // which the client cannot classify. Map failures to curated
        // `{error, code[, model]}` envelopes instead.
        onError: (error) =>
          toClientStreamError(error, {
            id: modelId,
            displayName: selectedModel?.displayName,
          }),
      }),
      userMessageId: userMessage.id,
    };
  }

  async clearMessages(notebookId: string): Promise<void> {
    await this.notebooksService.assertNotebookOwner(notebookId);
    await this.db
      .delete(notebookChatMessages)
      .where(eq(notebookChatMessages.notebookId, notebookId));
  }

  private async getRecentHistory(
    notebookId: string,
    limit: number,
    excludeMessageId?: string,
  ) {
    const rows = await this.db
      .select()
      .from(notebookChatMessages)
      .where(eq(notebookChatMessages.notebookId, notebookId))
      .orderBy(asc(notebookChatMessages.createdAt));

    const filtered = excludeMessageId
      ? rows.filter((r) => r.id !== excludeMessageId)
      : rows;

    return filtered.slice(-limit);
  }
}
