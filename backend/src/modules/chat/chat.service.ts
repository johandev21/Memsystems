import { Inject, Injectable, Logger } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import { and, asc, desc, eq, inArray, isNull, ne } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BadRequestError } from '../../common/errors/domain-error';
import * as appSchema from '../../database/schema';
import {
  notebookChatMessages,
  notebooks,
  sources,
} from '../../database/schema';
import {
  DEFAULT_GROUNDING_MODE,
  resolveGroundingMode,
} from '../notebooks/grounding-mode';
import { AiService } from '../ai/ai.service';
import { ConnectionService } from '../ai/connection.service';
import {
  RetrievalService,
  type RetrievalOutcome,
} from '../ai/retrieval/retrieval.service';
import { RetrievalTraceService } from '../ai/retrieval/retrieval-trace.service';
import { DRIZZLE } from '../database/database.module';
import { NotebooksService } from '../notebooks/notebooks.service';
import {
  type StoredCitedSourceEntry,
  createCitationEvidence,
  formatCitationContext,
} from './chat-citations';
import { buildMessagePath } from './branches/chat-branch-path';
import { claimChatTurn } from './branches/chat-turn-claim';
import { selectChatMessageBranch } from './branches/chat-branch-selection';
import { executeChatStream } from './streaming/chat-stream-execution';
import { sendNoEvidenceReply } from './streaming/no-evidence-reply';
import {
  deduplicateHistoryMessages,
  getLastUserMessageContent,
  getLastUserMessageParts,
  HISTORY_FETCH_LIMIT,
  mapAvailableCitationSource,
  mapChatHistoryMessages,
  MAX_HISTORY_MESSAGES,
  stripCitationKeys,
} from './history/chat-history';
import type {
  ChatHistoryResponse,
  CitedSourceMeta,
  SendInput,
} from './chat.types';

export type { ChatHistoryResponse, ChatMessage, SendInput } from './chat.types';
export { buildMessagePath } from './branches/chat-branch-path';
export {
  deduplicateHistoryMessages,
  HISTORY_FETCH_LIMIT,
  MAX_HISTORY_MESSAGES,
  stripCitationKeys,
} from './history/chat-history';

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
    private readonly retrievalTraceService: RetrievalTraceService,
  ) {}

  async listMessages(notebookId: string): Promise<ChatHistoryResponse> {
    await this.notebooksService.assertNotebookOwner(notebookId);

    const historySnapshot = await this.db
      .select({
        message: notebookChatMessages,
        selectedChatMessageId: notebooks.selectedChatMessageId,
      })
      .from(notebooks)
      .leftJoin(
        notebookChatMessages,
        eq(notebookChatMessages.notebookId, notebooks.id),
      )
      .where(eq(notebooks.id, notebookId))
      .orderBy(asc(notebookChatMessages.createdAt));
    const rows = historySnapshot.flatMap((row) =>
      row.message ? [row.message] : [],
    );
    const selectedMessageId = historySnapshot[0]?.selectedChatMessageId ?? null;
    const selectedPathIds = buildMessagePath(rows, selectedMessageId).map(
      (row) => row.id,
    );
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
            isNull(sources.deletedAt),
          ),
        );
      for (const src of sourceRows) {
        citedMetaMap.set(src.id, mapAvailableCitationSource(src));
      }
    }
    const messages = mapChatHistoryMessages(
      rows,
      selectedMessageId,
      selectedPathIds,
      citedMetaMap,
    );
    return { messages, selectedMessageId, selectedPathIds };
  }

  extractUserMessageContent(
    messages: { role: string; parts: { type: string; text?: string }[] }[],
  ): string {
    return getLastUserMessageContent(messages);
  }

  extractUserMessageParts(
    messages: { role: string; parts: Record<string, unknown>[] }[],
  ): Record<string, unknown>[] {
    return getLastUserMessageParts(messages);
  }

  async sendMessage(notebookId: string, input: SendInput) {
    await this.notebooksService.assertNotebookOwner(notebookId);
    await this.connectionService.requireConnected(input.model);

    const notebookGroundingMode =
      typeof this.notebooksService.getGroundingMode === 'function'
        ? await this.notebooksService.getGroundingMode(notebookId)
        : DEFAULT_GROUNDING_MODE;
    const groundingMode = resolveGroundingMode(
      input.groundingMode,
      notebookGroundingMode,
    );

    const assistantMessageId = createId();

    const { userMessage, priorHistory } = await claimChatTurn({
      db: this.db,
      notebookId,
      input,
      groundingMode,
    });

    const retrievalOutcome: RetrievalOutcome | null = userMessage.content.trim()
      ? await this.retrievalService.retrieve({
          notebookId,
          query: userMessage.content,
          ...(input.sourceIds !== undefined
            ? {
                sourceIds: await this.validateSourceIds(
                  notebookId,
                  input.sourceIds,
                ),
              }
            : {}),
          history: priorHistory.map((message) => ({
            role: message.role,
            content:
              message.role === 'assistant'
                ? stripCitationKeys(message.content)
                : message.content,
          })),
        })
      : null;
    if (retrievalOutcome) {
      await this.retrievalTraceService.record({
        notebookId,
        kind: 'chat',
        chatMessageId: assistantMessageId,
        groundingMode,
        trace: retrievalOutcome.trace,
      });
    }
    const retrievedChunks = retrievalOutcome?.chunks ?? [];
    const citationEvidence = createCitationEvidence(retrievedChunks);

    const sourceContext = formatCitationContext(citationEvidence);

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

    if (retrievalOutcome?.abstained && groundingMode === 'strict') {
      return sendNoEvidenceReply(
        this.db,
        this.logger,
        notebookId,
        input,
        userMessage,
        retrievalOutcome,
        assistantMessageId,
        groundingMode,
      );
    }

    return executeChatStream({
      db: this.db,
      logger: this.logger,
      aiService: this.aiService,
      notebookId,
      input,
      userMessage,
      assistantMessageId,
      groundingMode,
      citationEvidence,
      sourceContext,
      history,
      hasRetrievedChunks: retrievedChunks.length > 0,
    });
  }

  async clearMessages(notebookId: string): Promise<void> {
    await this.notebooksService.assertNotebookOwner(notebookId);
    await this.db
      .delete(notebookChatMessages)
      .where(eq(notebookChatMessages.notebookId, notebookId));
    await this.retrievalTraceService.clearChatTraces(notebookId);
  }

  async selectMessage(notebookId: string, messageId: string): Promise<string> {
    await this.notebooksService.assertNotebookOwner(notebookId);
    return selectChatMessageBranch({
      db: this.db,
      notebookId,
      messageId,
    });
  }

  private async validateSourceIds(
    notebookId: string,
    sourceIds?: string[],
  ): Promise<string[] | undefined> {
    if (!sourceIds) return undefined;
    const uniqueIds = [...new Set(sourceIds)];
    if (uniqueIds.length === 0) return [];
    const matchingSources = await this.db
      .select({ id: sources.id })
      .from(sources)
      .where(
        and(
          eq(sources.notebookId, notebookId),
          inArray(sources.id, uniqueIds),
          isNull(sources.deletedAt),
        ),
      );
    if (matchingSources.length !== uniqueIds.length) {
      throw new BadRequestError(
        'Selected sources must belong to this notebook',
      );
    }
    return uniqueIds;
  }

  async getRecentHistory(
    notebookId: string,
    limit: number = MAX_HISTORY_MESSAGES,
    excludeMessageId?: string,
  ) {
    const fetchLimit = Math.max(limit * 4, HISTORY_FETCH_LIMIT);
    const whereConditions = [eq(notebookChatMessages.notebookId, notebookId)];
    if (excludeMessageId) {
      whereConditions.push(ne(notebookChatMessages.id, excludeMessageId));
    }

    const rows = await this.db
      .select()
      .from(notebookChatMessages)
      .where(
        whereConditions.length > 1
          ? and(...whereConditions)
          : whereConditions[0],
      )
      .orderBy(desc(notebookChatMessages.createdAt))
      .limit(fetchLimit);

    const chronological = [...rows].reverse();
    const deduplicated = deduplicateHistoryMessages(chronological);
    const windowed = deduplicated.slice(-limit);

    return windowed.map((msg) => {
      if (msg.role !== 'assistant') return msg;
      const cleanContent = stripCitationKeys(msg.content);
      const cleanParts = Array.isArray(msg.parts)
        ? msg.parts.map((part) =>
            part.type === 'text' && typeof part.text === 'string'
              ? { ...part, text: stripCitationKeys(part.text) }
              : part,
          )
        : msg.parts;
      return {
        ...msg,
        content: cleanContent,
        parts: cleanParts,
      };
    });
  }
}
