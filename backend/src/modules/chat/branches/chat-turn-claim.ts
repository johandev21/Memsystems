import { isDeepStrictEqual } from 'node:util';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createId } from '@paralleldrive/cuid2';
import { BadRequestError } from '../../../common/errors/domain-error';
import * as appSchema from '../../../database/schema';
import { notebookChatMessages, notebooks } from '../../../database/schema';
import type { GroundingMode } from '../../../database/schema';
import type { SendInput } from '../chat.types';
import { buildMessagePath } from './chat-branch-path';
import { MAX_HISTORY_MESSAGES } from '../history/chat-history';

function comparableUserParts(
  parts: Record<string, unknown>[] | null | undefined,
): Record<string, unknown>[] {
  return (parts ?? []).map((part) => {
    const persistedPart = { ...part };
    delete persistedPart.state;
    return persistedPart;
  });
}

export async function claimChatTurn({
  db,
  notebookId,
  input,
  groundingMode,
}: {
  db: NodePgDatabase<typeof appSchema>;
  notebookId: string;
  input: SendInput;
  groundingMode: GroundingMode;
}) {
  let userMessage: {
    id: string;
    role: 'user';
    content: string;
    parts: Record<string, unknown>[] | null;
    createdAt: Date;
    parentId: string | null;
  };
  const messageRows = await db
    .select()
    .from(notebookChatMessages)
    .where(eq(notebookChatMessages.notebookId, notebookId))
    .orderBy(asc(notebookChatMessages.createdAt));
  const notebookRows = await db
    .select({ selectedChatMessageId: notebooks.selectedChatMessageId })
    .from(notebooks)
    .where(eq(notebooks.id, notebookId));
  const selectedMessageId = notebookRows[0]?.selectedChatMessageId ?? null;

  if (input.editMessageId && input.messageId === input.editMessageId) {
    throw new BadRequestError('Edited message must have a fresh ID');
  }
  if (input.editMessageId && input.messageId) {
    const idRows = await db
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
        const messageIdRows = await db
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
    const [inserted] = await db
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
      ...buildMessagePath(messageRows, priorEndId).slice(-MAX_HISTORY_MESSAGES),
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

  const selectedBranch = await db.transaction(async (tx) => {
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
      await db
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
  return { userMessage, priorHistory };
}
