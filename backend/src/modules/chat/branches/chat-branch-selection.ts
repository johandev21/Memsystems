import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BadRequestError } from '../../../common/errors/domain-error';
import * as appSchema from '../../../database/schema';
import { notebookChatMessages, notebooks } from '../../../database/schema';
import {
  buildMessagePath,
  buildRememberedMessagePath,
} from './chat-branch-path';

export async function selectChatMessageBranch({
  db,
  notebookId,
  messageId,
}: {
  db: NodePgDatabase<typeof appSchema>;
  notebookId: string;
  messageId: string;
}): Promise<string> {
  return db.transaction(async (tx) => {
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
      const parentIndex = updatedRows.findIndex((row) => row.id === parent.id);
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
