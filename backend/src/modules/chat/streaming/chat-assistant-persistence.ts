import type { Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../../database/schema';
import {
  notebookChatMessages,
  notebooks,
  type GroundingMode,
} from '../../../database/schema';
import { type CitationEvidence, verifyCitations } from '../chat-citations';

export async function persistAssistantChatMessage({
  db,
  logger,
  notebookId,
  userMessageId,
  assistantMessageId,
  modelId,
  groundingMode,
  citationEvidence,
  startTime,
  text,
  reasoning,
  customMetadata,
}: {
  db: NodePgDatabase<typeof appSchema>;
  logger: Pick<Logger, 'warn' | 'error'>;
  notebookId: string;
  userMessageId: string;
  assistantMessageId: string;
  modelId: string;
  groundingMode: GroundingMode;
  citationEvidence: CitationEvidence[];
  startTime: Date;
  text: string;
  reasoning: string | null;
  customMetadata?: Record<string, unknown>;
}): Promise<void> {
  const verification = verifyCitations(text, citationEvidence, {
    attribution: false,
  });
  if (verification.droppedKeys.length > 0) {
    logger.warn(
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
    await db.insert(notebookChatMessages).values({
      id: assistantMessageId,
      notebookId,
      parentId: userMessageId,
      role: 'assistant',
      content: text,
      reasoning,
      parts,
      metadata,
      groundingMode,
      citedSourceIds: citedEntries,
    });
    if (customMetadata?.finishReason !== 'cancelled') {
      await db.transaction(async (tx) => {
        const selectedBranch = await tx
          .update(notebooks)
          .set({ selectedChatMessageId: assistantMessageId })
          .where(
            and(
              eq(notebooks.id, notebookId),
              eq(notebooks.selectedChatMessageId, userMessageId),
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
                eq(notebookChatMessages.id, userMessageId),
                eq(notebookChatMessages.notebookId, notebookId),
              ),
            );
        }
      });
    }
  } catch (dbError) {
    logger.error('failed to persist assistant message', dbError);
  }
}
