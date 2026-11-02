import { createId } from '@paralleldrive/cuid2';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { and, eq, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Logger } from '@nestjs/common';
import * as appSchema from '../../../database/schema';
import {
  notebookChatMessages,
  notebooks,
  sources,
} from '../../../database/schema';
import type { GroundingMode } from '../../../database/schema';
import type { RetrievalOutcome } from '../../ai/retrieval/retrieval.service';
import type { SendInput } from '../chat.types';
import {
  composeNoEvidenceReply,
  noEvidenceMetadata,
  qualityReasonFromCode,
  type NoEvidenceContext,
} from '../chat-no-evidence';

export async function sendNoEvidenceReply(
  db: NodePgDatabase<typeof appSchema>,
  logger: Pick<Logger, 'error'>,
  notebookId: string,
  input: SendInput,
  userMessage: { id: string },
  outcome: RetrievalOutcome,
  assistantMessageId: string,
  groundingMode: GroundingMode,
) {
  const degradedRows = await db
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
    await db.insert(notebookChatMessages).values({
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
    await db.transaction(async (tx) => {
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
    logger.error('failed to persist no-evidence reply', dbError);
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
