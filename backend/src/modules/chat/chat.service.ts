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
import { RetrievalService } from '../ai/retrieval.service';
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

const SYSTEM_PROMPT = `You are a knowledgeable tutor and research assistant. Help the user understand their topics of interest using the provided source passages or your general knowledge.

GROUNDING & CITATION RULES:
- If provided passages lack sufficient info, state this clearly and offer general knowledge.
- Prioritize source-backed claims. Clearly separate source-derived info from general knowledge.
- Never treat source availability as "permission" to answer; they are for evidence only.
- Cite source-backed claims with the evidence key shown in the passages, using exactly this syntax at the end of the supported sentence: [ref:R1].
- Use only evidence keys that were provided. Never invent a key or put source titles inside citation markers.
- Do not discuss retrieval mechanics (e.g., source counts, indexing, loaded documents).

CRITICAL OUTPUT BOUNDARIES:
- Respond ONLY to the most recent user message. Do not simulate a multi-turn conversation or fabricate user labels (e.g., "User:", "Q:").
- Produce a single assistant response.
- Do not ask follow-up questions or invite the user to keep talking unless explicitly required. If necessary, ask a maximum of one short clarifying question at the very end.`;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string | null;
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

  async listMessages(
    userId: string,
    notebookId: string,
  ): Promise<ChatMessage[]> {
    await this.notebooksService.assertNotebookOwner(userId, notebookId);

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
          number: e.number,
          title: e.title ?? meta?.title ?? 'Unavailable reference',
          kind: e.kind ?? meta?.kind ?? 'unknown',
          url: e.url ?? meta?.url ?? null,
          description: e.description,
          quote: e.quote,
          isAvailable: !!meta,
        };
      });
      return {
        id: r.id,
        role: r.role,
        content: r.content,
        reasoning: r.reasoning,
        citedSourceIds: entries,
        citedSources,
        createdAt: r.createdAt,
      };
    });
  }

  extractUserMessageContent(
    messages: { role: string; parts: { type: string; text: string }[] }[],
  ): string {
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === 'user');
    const textPart = lastUserMessage?.parts.find((p) => p.type === 'text');
    return textPart?.text ?? '';
  }

  async sendMessage(userId: string, notebookId: string, input: SendInput) {
    await this.notebooksService.assertNotebookOwner(userId, notebookId);
    await this.connectionService.requireConnected(userId, input.model);

    const retrievedChunks = await this.retrievalService.retrieveRelevantChunks(
      notebookId,
      input.content,
      userId,
      8,
    );
    const citationEvidence = createCitationEvidence(retrievedChunks);

    const sourceContext = formatCitationContext(citationEvidence).slice(
      0,
      MAX_SOURCE_TEXT,
    );

    const priorHistory = await this.getRecentHistory(
      notebookId,
      MAX_HISTORY_MESSAGES,
    );

    const [userMessage] = await this.db
      .insert(notebookChatMessages)
      .values({
        notebookId,
        role: 'user',
        content: input.content,
      })
      .returning();

    await this.db
      .update(notebooks)
      .set({ updatedAt: new Date() })
      .where(eq(notebooks.id, notebookId));

    const history = [
      ...priorHistory,
      {
        id: userMessage.id,
        role: 'user' as const,
        content: userMessage.content,
        citedSourceIds: null,
        createdAt: userMessage.createdAt,
      },
    ];

    input.abortSignal?.throwIfAborted();

    const modelId = input.model;
    const provider = await this.aiService.getProviderForModel(modelId, userId);
    const model = provider.createModel(modelId);

    const systemMessage =
      retrievedChunks.length > 0
        ? `${SYSTEM_PROMPT}\n\n---\n\nRELEVANT SOURCE PASSAGES:\n\n${sourceContext}`
        : SYSTEM_PROMPT;

    const messagesForLlm = history.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const assistantMessageId = createId();
    let streamedText = '';
    let streamedReasoning = '';
    let assistantMessagePersisted = false;

    const persistAssistantMessage = async (
      text: string,
      reasoning: string | null,
    ) => {
      if (assistantMessagePersisted || !text.trim()) return;
      assistantMessagePersisted = true;

      const citedEntries = extractCitationEntries(text, citationEvidence);

      try {
        await this.db.insert(notebookChatMessages).values({
          id: assistantMessageId,
          notebookId,
          role: 'assistant',
          content: text,
          reasoning,
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
        system: systemMessage,
        messages: messagesForLlm,
        onChunk: ({ chunk }) => {
          if (chunk.type === 'text-delta') streamedText += chunk.text;
          if (chunk.type === 'reasoning-delta') {
            streamedReasoning += chunk.text;
          }
        },
        onError: ({ error }) => {
          this.logger.error('streamText onError', {
            error: error instanceof Error ? error.message : String(error),
          });
        },
        onFinish: async ({ text, reasoning }) => {
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

          await persistAssistantMessage(text, reasoningString);
        },
        onAbort: async () => {
          await persistAssistantMessage(
            streamedText,
            streamedReasoning || null,
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
      }),
      userMessageId: userMessage.id,
    };
  }

  async clearMessages(userId: string, notebookId: string): Promise<void> {
    await this.notebooksService.assertNotebookOwner(userId, notebookId);
    await this.db
      .delete(notebookChatMessages)
      .where(eq(notebookChatMessages.notebookId, notebookId));
  }

  private async getRecentHistory(notebookId: string, limit: number) {
    const rows = await this.db
      .select()
      .from(notebookChatMessages)
      .where(eq(notebookChatMessages.notebookId, notebookId))
      .orderBy(asc(notebookChatMessages.createdAt));

    return rows.slice(-limit);
  }
}
