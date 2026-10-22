import { Inject, Injectable, Logger } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import { isDeepStrictEqual } from 'node:util';
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
} from 'ai';
import { and, asc, desc, eq, inArray, isNull, ne } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BadRequestError } from '../../common/errors/domain-error';
import * as appSchema from '../../database/schema';
import {
  notebookChatMessages,
  notebooks,
  sources,
} from '../../database/schema';
import type { GroundingMode } from '../../database/schema';
import {
  DEFAULT_GROUNDING_MODE,
  resolveGroundingMode,
} from '../notebooks/grounding-mode';
import { AiService } from '../ai/ai.service';
import { ConnectionService } from '../ai/connection.service';
import { toClientStreamError } from '../ai/stream-error';
import { resolveModelId } from '../ai/providers/model-catalog';
import {
  MESSAGE_LANGUAGE_INSTRUCTION,
  groundingDirective,
} from './grounding-directives';
import {
  RetrievalService,
  type RetrievalOutcome,
} from '../ai/retrieval/retrieval.service';
import type { CitationLocator } from '../ai/retrieval/retrieval.service';
import { RetrievalTraceService } from '../ai/retrieval/retrieval-trace.service';
import { DRIZZLE } from '../database/database.module';
import { NotebooksService } from '../notebooks/notebooks.service';
import {
  type CitedSourceEntry,
  type StoredCitedSourceEntry,
  createCitationEvidence,
  formatCitationContext,
  normalizeStoredCitation,
  sanitizeReferenceUrl,
  verifyCitations,
} from './chat-citations';
import {
  composeNoEvidenceReply,
  noEvidenceMetadata,
  qualityReasonFromCode,
  type NoEvidenceContext,
} from './chat-no-evidence';

export const MAX_HISTORY_MESSAGES = 6;
export const HISTORY_FETCH_LIMIT = 30;

export function stripCitationKeys(text?: string | null): string {
  if (!text) return '';
  return text
    .replace(/`?\[ref:R\d+\]`?/gi, '')
    .replace(/[ \t]+([.,;:!?])/g, '$1')
    .replace(/ {2,}/g, ' ')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

export function deduplicateHistoryMessages<T extends { role: string }>(
  messages: T[],
): T[] {
  const result: T[] = [];
  for (let i = 0; i < messages.length; i++) {
    const current = messages[i];
    const next = messages[i + 1];
    if (current.role === 'assistant' && next && next.role === 'assistant') {
      continue;
    }
    result.push(current);
  }
  return result;
}

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
  groundingMode: GroundingMode;
  citedSourceIds: CitedSourceEntry[] | null;
  citedSources: CitedSourceMeta[];
  createdAt: Date;
  parentId: string | null;
  siblingIndex: number;
  siblingCount: number;
  isOnSelectedPath: boolean;
  isSelected: boolean;
}

export interface ChatHistoryResponse {
  messages: ChatMessage[];
  selectedMessageId: string | null;
  selectedPathIds: string[];
}

export function buildMessagePath<
  T extends { id: string; parentId: string | null },
>(rows: T[], targetId: string | null): T[] {
  if (!targetId) return [];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const path: T[] = [];
  const visited = new Set<string>();
  let current = byId.get(targetId);
  if (!current) throw new BadRequestError('Unknown chat branch message');
  while (current) {
    if (visited.has(current.id)) {
      throw new BadRequestError('Invalid cyclic chat branch');
    }
    visited.add(current.id);
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
    if (path[0].parentId && !current) {
      throw new BadRequestError('Invalid chat branch parent');
    }
  }
  return path;
}

type BranchMessage = {
  id: string;
  parentId: string | null;
  preferredChildId?: string | null;
  preferredChildInitialized?: boolean;
  createdAt?: Date;
};

function buildRememberedMessagePath<T extends BranchMessage>(
  rows: T[],
  startId: string,
): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const path: T[] = [];
  const visited = new Set<string>();
  let current = byId.get(startId);
  if (!current) throw new BadRequestError('Unknown chat branch message');

  while (current) {
    if (visited.has(current.id)) {
      throw new BadRequestError('Invalid cyclic chat branch');
    }
    visited.add(current.id);
    path.push(current);
    const children = rows
      .filter((row) => row.parentId === current!.id)
      .sort(
        (a, b) =>
          (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0) ||
          a.id.localeCompare(b.id),
      );
    const preferredChild = children.find(
      (row) => row.id === current!.preferredChildId,
    );
    current =
      preferredChild ??
      (current.preferredChildId || !current.preferredChildInitialized
        ? children[0]
        : undefined);
  }
  return path;
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
  sectionPath?: string[] | null;
  context?: string | null;
}

export interface SendInput {
  content: string;
  parts?: Record<string, unknown>[];
  messageId?: string;
  parentMessageId?: string | null;
  editMessageId?: string;
  regenerateMessageId?: string;
  sourceIds?: string[];
  model: string;
  abortSignal?: AbortSignal;
  language?: string;
  groundingMode?: GroundingMode;
}

function comparableUserParts(
  parts: Record<string, unknown>[] | null | undefined,
): Record<string, unknown>[] {
  return (parts ?? []).map((part) => {
    const persistedPart = { ...part };
    delete persistedPart.state;
    return persistedPart;
  });
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
    const childrenByParent = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = row.parentId ?? '';
      childrenByParent.set(key, [...(childrenByParent.get(key) ?? []), row]);
    }
    for (const children of childrenByParent.values()) {
      children.sort(
        (a, b) =>
          a.createdAt.getTime() - b.createdAt.getTime() ||
          a.id.localeCompare(b.id),
      );
    }

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

    const messages = rows.map((r) => {
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
          sectionPath: e.sectionPath ?? null,
          context: e.context ?? null,
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
        groundingMode: resolveGroundingMode(
          r.groundingMode,
          r.metadata?.groundingMode,
        ),
        citedSourceIds: entries,
        citedSources,
        createdAt: r.createdAt,
        parentId: r.parentId,
        siblingIndex: (childrenByParent.get(r.parentId ?? '') ?? []).findIndex(
          (child) => child.id === r.id,
        ),
        siblingCount: (childrenByParent.get(r.parentId ?? '') ?? []).length,
        isOnSelectedPath: selectedPathIds.includes(r.id),
        isSelected: selectedMessageId === r.id,
      };
    });
    return { messages, selectedMessageId, selectedPathIds };
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

    const notebookGroundingMode =
      typeof this.notebooksService.getGroundingMode === 'function'
        ? await this.notebooksService.getGroundingMode(notebookId)
        : DEFAULT_GROUNDING_MODE;
    const groundingMode = resolveGroundingMode(
      input.groundingMode,
      notebookGroundingMode,
    );

    const assistantMessageId = createId();

    let userMessage: {
      id: string;
      role: 'user';
      content: string;
      parts: Record<string, unknown>[] | null;
      createdAt: Date;
      parentId: string | null;
    };
    const messageRows = await this.db
      .select()
      .from(notebookChatMessages)
      .where(eq(notebookChatMessages.notebookId, notebookId))
      .orderBy(asc(notebookChatMessages.createdAt));
    const notebookRows = await this.db
      .select({ selectedChatMessageId: notebooks.selectedChatMessageId })
      .from(notebooks)
      .where(eq(notebooks.id, notebookId));
    const selectedMessageId = notebookRows[0]?.selectedChatMessageId ?? null;

    // Client generated IDs are persisted for new and edited user messages so
    // the streamed UI message and the durable branch node stay addressable by
    // the same ID. Reject collisions before insertion (the PK remains the
    // final guard against concurrent requests choosing the same ID).
    if (input.editMessageId && input.messageId === input.editMessageId) {
      throw new BadRequestError('Edited message must have a fresh ID');
    }
    if (input.editMessageId && input.messageId) {
      const idRows = await this.db
        .select({ id: notebookChatMessages.id })
        .from(notebookChatMessages)
        .where(eq(notebookChatMessages.id, input.messageId));
      if (idRows.length > 0) {
        throw new BadRequestError('Message ID is already in use');
      }
    }

    let parentId: string | null =
      input.parentMessageId !== undefined
        ? input.parentMessageId
        : selectedMessageId;
    let priorEndId: string | null;
    let existingUser: (typeof messageRows)[number] | undefined;
    let insertedNewUser = false;

    if (input.regenerateMessageId) {
      const regenerateTarget = messageRows.find(
        (row) => row.id === input.regenerateMessageId,
      );
      if (!regenerateTarget || regenerateTarget.role !== 'assistant') {
        throw new BadRequestError(
          'Regeneration target must be an assistant message',
        );
      }
      existingUser = messageRows.find(
        (row) => row.id === regenerateTarget.parentId && row.role === 'user',
      );
      if (!existingUser) {
        throw new BadRequestError('Invalid regeneration branch');
      }
      parentId = existingUser.parentId;
      priorEndId = existingUser.parentId;
    } else if (input.editMessageId) {
      existingUser = messageRows.find(
        (row) => row.id === input.editMessageId && row.role === 'user',
      );
      if (!existingUser) {
        throw new BadRequestError('Edit target must be a user message');
      }
      parentId = existingUser.parentId;
      priorEndId = parentId;
    } else {
      priorEndId = parentId;
      if (input.messageId) {
        const suppliedMessage = messageRows.find(
          (row) => row.id === input.messageId,
        );
        if (suppliedMessage && suppliedMessage.role !== 'user') {
          throw new BadRequestError('Message ID must identify a user message');
        }
        existingUser = suppliedMessage;
        if (!existingUser) {
          const messageIdRows = await this.db
            .select({ id: notebookChatMessages.id })
            .from(notebookChatMessages)
            .where(eq(notebookChatMessages.id, input.messageId));
          if (messageIdRows.length > 0) {
            throw new BadRequestError(
              'Message ID does not belong to this notebook',
            );
          }
        }
      }
    }

    if (existingUser && !input.editMessageId && !input.regenerateMessageId) {
      const sameContent = existingUser.content === input.content;
      const sameParts = isDeepStrictEqual(
        comparableUserParts(existingUser.parts),
        comparableUserParts(input.parts),
      );
      // A retry after a failed/cancelled request sees the user node selected.
      // An explicit parent is also accepted when it repeats the original
      // request intent. Omitted parent is otherwise resolved from selection.
      const sameParent =
        input.parentMessageId !== undefined
          ? input.parentMessageId === existingUser.parentId
          : selectedMessageId === existingUser.id ||
            selectedMessageId === existingUser.parentId;
      if (!sameContent || !sameParts || !sameParent) {
        throw new BadRequestError(
          'Message ID already belongs to a different chat request',
        );
      }
      parentId = existingUser.parentId;
      priorEndId = existingUser.parentId;
    }

    if (parentId) {
      const parent = messageRows.find((row) => row.id === parentId);
      if (!parent) throw new BadRequestError('Unknown chat branch parent');
    }
    const priorHistory = buildMessagePath(messageRows, priorEndId).slice(
      -MAX_HISTORY_MESSAGES,
    );

    if (input.regenerateMessageId) {
      userMessage = {
        id: existingUser!.id,
        role: 'user',
        content: existingUser!.content,
        parts: existingUser!.parts,
        createdAt: existingUser!.createdAt,
        parentId: existingUser!.parentId,
      };
    } else if (input.editMessageId || !existingUser) {
      const userParts = input.editMessageId
        ? (existingUser!.parts ?? []).map((part) =>
            part.type === 'text' ? { ...part, text: input.content } : part,
          )
        : input.parts && input.parts.length > 0
          ? input.parts
          : [{ type: 'text', text: input.content }];
      const [inserted] = await this.db
        .insert(notebookChatMessages)
        .values({
          id: input.messageId || createId(),
          notebookId,
          parentId,
          role: 'user',
          preferredChildInitialized: true,
          content: input.content,
          parts: userParts,
          metadata: { modelId: input.model },
          groundingMode,
        })
        .returning();
      insertedNewUser = true;
      userMessage = {
        id: inserted.id,
        role: 'user',
        content: inserted.content,
        parts: inserted.parts,
        createdAt: inserted.createdAt,
        parentId,
      };
      priorEndId = parentId;
      priorHistory.splice(
        0,
        priorHistory.length,
        ...buildMessagePath(messageRows, priorEndId).slice(
          -MAX_HISTORY_MESSAGES,
        ),
      );
    } else {
      userMessage = {
        id: existingUser.id,
        role: 'user',
        content: existingUser.content,
        parts: existingUser.parts,
        createdAt: existingUser.createdAt,
        parentId: existingUser.parentId,
      };
      priorHistory.splice(
        0,
        priorHistory.length,
        ...buildMessagePath(messageRows, existingUser.parentId).slice(
          -MAX_HISTORY_MESSAGES,
        ),
      );
    }

    // A failed or cancelled request still leaves this branch selected. The
    // assistant completion below advances selection only if this request is
    // still the active branch, so stale streams cannot steal a newer choice.
    const selectedBranch = await this.db.transaction(async (tx) => {
      const selected = await tx
        .update(notebooks)
        .set({ selectedChatMessageId: userMessage.id, updatedAt: new Date() })
        .where(
          and(
            eq(notebooks.id, notebookId),
            selectedMessageId
              ? eq(notebooks.selectedChatMessageId, selectedMessageId)
              : isNull(notebooks.selectedChatMessageId),
          ),
        )
        .returning({ id: notebooks.id });
      if (selected.length > 0) {
        const branchRows = insertedNewUser
          ? [
              ...messageRows,
              { id: userMessage.id, parentId: userMessage.parentId },
            ]
          : messageRows;
        const branchPath = buildMessagePath(branchRows, userMessage.id);
        for (let index = 0; index < branchPath.length - 1; index += 1) {
          await tx
            .update(notebookChatMessages)
            .set({
              preferredChildId: branchPath[index + 1].id,
              preferredChildInitialized: true,
            })
            .where(
              and(
                eq(notebookChatMessages.id, branchPath[index].id),
                eq(notebookChatMessages.notebookId, notebookId),
              ),
            );
        }
      }
      if (selected.length > 0 && existingUser && !insertedNewUser) {
        await tx
          .update(notebookChatMessages)
          .set({ preferredChildId: null, preferredChildInitialized: true })
          .where(
            and(
              eq(notebookChatMessages.id, userMessage.id),
              eq(notebookChatMessages.notebookId, notebookId),
            ),
          );
      }
      return selected;
    });
    if (selectedBranch.length === 0) {
      if (insertedNewUser) {
        await this.db
          .delete(notebookChatMessages)
          .where(
            and(
              eq(notebookChatMessages.notebookId, notebookId),
              eq(notebookChatMessages.id, userMessage.id),
            ),
          );
      }
      throw new BadRequestError(
        'Chat branch changed while starting the message; reload the selected branch and retry',
      );
    }

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
      return this.sendNoEvidenceReply(
        notebookId,
        input,
        userMessage,
        retrievalOutcome,
        assistantMessageId,
        groundingMode,
      );
    }

    const modelId = input.model;
    const provider = await this.aiService.getProviderForModel(modelId);
    const submittedParts = input.parts ?? [];
    for (const part of submittedParts) {
      if (part.type === 'file') {
        if (!part.mediaType || typeof part.mediaType !== 'string') {
          throw new BadRequestError(
            'Invalid file attachment: mediaType is required',
            {
              messageKey: 'errors.chat.attachment.unsupported',
            },
          );
        }
      }
    }
    const hasImageInput = submittedParts.some(
      (part) =>
        part.type === 'file' &&
        typeof part.mediaType === 'string' &&
        part.mediaType.startsWith('image/'),
    );
    const hasFileInput = submittedParts.some(
      (part) =>
        part.type === 'file' &&
        typeof part.mediaType === 'string' &&
        !part.mediaType.startsWith('image/'),
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

    const model = provider.createModel(modelId);
    const requestOptions = this.aiService.getGatewayRequestOptions();

    const systemMessage =
      (retrievedChunks.length > 0
        ? `${SYSTEM_PROMPT}\n\n---\n\nRELEVANT SOURCE PASSAGES:\n\n${sourceContext}`
        : SYSTEM_PROMPT) +
      groundingDirective(groundingMode) +
      MESSAGE_LANGUAGE_INSTRUCTION;

    const messagesForLlm = history.map((m) => {
      const parts =
        (m.parts as Array<{
          type: string;
          text?: string;
          mediaType?: string;
          url?: string;
          filename?: string;
        }>) || [];
      const hasFiles = parts.some((p) => p.type === 'file');

      if (m.role === 'user' && hasFiles) {
        const contentParts: Array<
          | { type: 'text'; text: string }
          | { type: 'image'; image: string }
          | { type: 'file'; data: string; mediaType: string; filename?: string }
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
          } else if (
            p.type === 'file' &&
            p.url &&
            p.mediaType &&
            !p.mediaType.startsWith('image/')
          ) {
            contentParts.push({
              type: 'file',
              data: p.url,
              mediaType: p.mediaType,
              ...(p.filename ? { filename: p.filename } : {}),
            });
          }
        }
        if (!parts.some((p) => p.type === 'text') && m.content?.trim()) {
          contentParts.push({ type: 'text', text: m.content });
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
        content:
          m.role === 'assistant' ? stripCitationKeys(m.content) : m.content,
      };
    });

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

      const verification = verifyCitations(text, citationEvidence, {
        attribution: false,
      });
      if (verification.droppedKeys.length > 0) {
        this.logger.warn(
          `Dropped ${verification.droppedKeys.length} unresolvable citation key(s): ${verification.droppedKeys
            .slice(0, 10)
            .join(', ')}`,
        );
      }
      const citedEntries = verification.entries;

      const parts: Record<string, unknown>[] = [];
      if (reasoning && reasoning.trim()) {
        parts.push({ type: 'reasoning', text: reasoning });
      }
      if (text) {
        parts.push({ type: 'text', text });
      }

      const metadata: Record<string, unknown> = {
        modelId,
        groundingMode,
        createdAt: startTime.toISOString(),
        completedAt: new Date().toISOString(),
        citationCheck: {
          resolved: citedEntries.length,
          attributed: verification.attributedClaims,
          dropped: verification.droppedKeys.length,
        },
        ...customMetadata,
      };

      try {
        await this.db.insert(notebookChatMessages).values({
          id: assistantMessageId,
          notebookId,
          parentId: userMessage.id,
          role: 'assistant',
          content: text,
          reasoning,
          parts,
          metadata,
          groundingMode,
          citedSourceIds: citedEntries,
        });
        if (customMetadata?.finishReason !== 'cancelled') {
          await this.db.transaction(async (tx) => {
            const selectedBranch = await tx
              .update(notebooks)
              .set({ selectedChatMessageId: assistantMessageId })
              .where(
                and(
                  eq(notebooks.id, notebookId),
                  eq(notebooks.selectedChatMessageId, userMessage.id),
                ),
              )
              .returning({ id: notebooks.id });
            if (selectedBranch.length > 0) {
              await tx
                .update(notebookChatMessages)
                .set({
                  preferredChildId: assistantMessageId,
                  preferredChildInitialized: true,
                })
                .where(
                  and(
                    eq(notebookChatMessages.id, userMessage.id),
                    eq(notebookChatMessages.notebookId, notebookId),
                  ),
                );
            }
          });
        }
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
          if (part.type === 'start') {
            return {
              modelId,
              citedSources: citationEvidence,
            };
          }
          if (part.type === 'finish') {
            const verification = verifyCitations(
              streamedText,
              citationEvidence,
              { attribution: false },
            );
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

  private async sendNoEvidenceReply(
    notebookId: string,
    input: SendInput,
    userMessage: {
      id: string;
    },
    outcome: RetrievalOutcome,
    assistantMessageId: string,
    groundingMode: GroundingMode,
  ) {
    const degradedRows = await this.db
      .select({
        id: sources.id,
        title: sources.title,
        processingErrorCode: sources.processingErrorCode,
      })
      .from(sources)
      .where(
        and(
          eq(sources.notebookId, notebookId),
          eq(sources.processingStatus, 'degraded'),
          isNull(sources.deletedAt),
        ),
      );

    const noEvidenceContext: NoEvidenceContext = {
      degradedSources: degradedRows.map((row) => ({
        id: row.id,
        title: row.title,
        reason: qualityReasonFromCode(row.processingErrorCode),
      })),
      unhelpfulSources: outcome.unhelpfulSources.map((source) => ({
        id: source.id,
        title: source.title,
      })),
    };

    const text = composeNoEvidenceReply(noEvidenceContext, input.language);
    const now = new Date().toISOString();
    const metadata: Record<string, unknown> = {
      modelId: input.model,
      groundingMode,
      createdAt: now,
      completedAt: now,
      finishReason: 'no_evidence',
      noEvidence: noEvidenceMetadata(
        noEvidenceContext,
        outcome.abstentionReason ?? 'below_threshold',
      ),
    };

    try {
      await this.db.insert(notebookChatMessages).values({
        id: assistantMessageId,
        notebookId,
        parentId: userMessage.id,
        role: 'assistant',
        content: text,
        reasoning: null,
        parts: [{ type: 'text', text }],
        metadata,
        groundingMode,
        citedSourceIds: [],
      });
      await this.db.transaction(async (tx) => {
        const selectedBranch = await tx
          .update(notebooks)
          .set({ selectedChatMessageId: assistantMessageId })
          .where(
            and(
              eq(notebooks.id, notebookId),
              eq(notebooks.selectedChatMessageId, userMessage.id),
            ),
          )
          .returning({ id: notebooks.id });
        if (selectedBranch.length > 0) {
          await tx
            .update(notebookChatMessages)
            .set({
              preferredChildId: assistantMessageId,
              preferredChildInitialized: true,
            })
            .where(
              and(
                eq(notebookChatMessages.id, userMessage.id),
                eq(notebookChatMessages.notebookId, notebookId),
              ),
            );
        }
      });
    } catch (dbError) {
      this.logger.error('failed to persist no-evidence reply', dbError);
    }

    const textPartId = createId();
    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({
          type: 'start',
          messageId: assistantMessageId,
          messageMetadata: metadata,
        });
        writer.write({ type: 'text-start', id: textPartId });
        writer.write({ type: 'text-delta', id: textPartId, delta: text });
        writer.write({ type: 'text-end', id: textPartId });
        writer.write({
          type: 'finish',
          messageMetadata: metadata,
        });
      },
    });

    return {
      streamResponse: createUIMessageStreamResponse({ stream }),
      userMessageId: userMessage.id,
    };
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
    return this.db.transaction(async (tx) => {
      // This write acquires the notebook row lock. Branch choice edges and the
      // selected endpoint are committed together while generation callbacks
      // serialize on the same row.
      const lockedNotebook = await tx
        .update(notebooks)
        .set({ updatedAt: new Date() })
        .where(eq(notebooks.id, notebookId))
        .returning({ id: notebooks.id });
      if (lockedNotebook.length === 0) {
        throw new BadRequestError('Notebook does not exist');
      }
      const messageRows = await tx
        .select()
        .from(notebookChatMessages)
        .where(eq(notebookChatMessages.notebookId, notebookId));
      if (!messageRows.some((row) => row.id === messageId)) {
        throw new BadRequestError(
          'Chat message does not belong to this notebook',
        );
      }
      const pathToSelected = buildMessagePath(messageRows, messageId);
      const updatedRows = [...messageRows];
      for (let index = 0; index < pathToSelected.length - 1; index += 1) {
        const parent = pathToSelected[index];
        const child = pathToSelected[index + 1];
        const parentIndex = updatedRows.findIndex(
          (row) => row.id === parent.id,
        );
        updatedRows[parentIndex] = {
          ...parent,
          preferredChildId: child.id,
          preferredChildInitialized: true,
        };
        await tx
          .update(notebookChatMessages)
          .set({
            preferredChildId: child.id,
            preferredChildInitialized: true,
          })
          .where(
            and(
              eq(notebookChatMessages.id, parent.id),
              eq(notebookChatMessages.notebookId, notebookId),
            ),
          );
      }
      const restoredPath = buildRememberedMessagePath(updatedRows, messageId);
      const selectedEndpoint = restoredPath.at(-1)?.id ?? messageId;
      await tx
        .update(notebooks)
        .set({ selectedChatMessageId: selectedEndpoint })
        .where(eq(notebooks.id, notebookId));
      return selectedEndpoint;
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
