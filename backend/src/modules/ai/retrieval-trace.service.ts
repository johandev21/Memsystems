import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { retrievalTraces } from '../../database/schema';
import { DRIZZLE } from '../database/database.module';
import type { RetrievalTrace } from './retrieval-trace';

export interface RecordRetrievalTraceInput {
  notebookId: string;
  kind: 'chat' | 'generation';
  chatMessageId?: string;
  generationRequestId?: string;
  trace: RetrievalTrace;
}

/**
 * Persists retrieval traces. Observability must never fail a Chat turn or a
 * Generation, so write failures are logged instead of thrown; callers verify
 * the row only in tests.
 */
@Injectable()
export class RetrievalTraceService {
  private readonly logger = new Logger(RetrievalTraceService.name);

  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
  ) {}

  async record(input: RecordRetrievalTraceInput): Promise<void> {
    try {
      await this.db.insert(retrievalTraces).values({
        notebookId: input.notebookId,
        kind: input.kind,
        chatMessageId: input.chatMessageId ?? null,
        generationRequestId: input.generationRequestId ?? null,
        query: input.trace.query,
        trace: input.trace,
        latencyMs: input.trace.latencyMs,
        embeddingInputTokens: input.trace.cost.embeddingInputTokens,
      });
    } catch (error) {
      this.logger.error('failed to persist retrieval trace', error);
    }
  }

  /** Clearing a Notebook's chat clears its Chat traces with it. */
  async clearChatTraces(notebookId: string): Promise<void> {
    await this.db
      .delete(retrievalTraces)
      .where(
        and(
          eq(retrievalTraces.notebookId, notebookId),
          eq(retrievalTraces.kind, 'chat'),
        ),
      );
  }
}
