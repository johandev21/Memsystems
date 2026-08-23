import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as authSchema from '../../database/auth-schema';
import * as appSchema from '../../database/schema';
import { DRIZZLE } from '../database/database.module';
import { EmbeddingService } from './embedding.service';

export interface RetrievedChunk {
  chunkId: string;
  chunkIndex: number;
  sourceId: string;
  title: string;
  content: string;
  score: number;
  url: string | null;
  kind: string;
}

export const DEFAULT_TOP_K = 8;

@Injectable()
export class RetrievalService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof authSchema & typeof appSchema>,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async retrieveRelevantChunks(
    notebookId: string,
    query: string,
    userId: string,
    topK: number = DEFAULT_TOP_K,
  ): Promise<RetrievedChunk[]> {
    const queryEmbedding = await this.embeddingService.generateEmbedding(
      query,
      userId,
    );

    const vectorLiteral = `[${queryEmbedding.join(',')}]`;

    const result = await this.db.execute(
      sql`
        SELECT
          sc.id AS chunk_id,
          sc.chunk_index,
          sc.source_id,
          s.title,
          s.url,
          s.kind,
          sc.content,
          1 - (sc.embedding <=> ${vectorLiteral}::vector) AS score
        FROM source_chunks sc
        JOIN sources s ON s.id = sc.source_id
        WHERE sc.notebook_id = ${notebookId}
        ORDER BY sc.embedding <=> ${vectorLiteral}::vector
        LIMIT ${topK}
      `,
    );

    const rows = result.rows as {
      chunk_id: string;
      chunk_index: number;
      source_id: string;
      title: string;
      url: string | null;
      kind: string;
      content: string;
      score: number;
    }[];

    return rows.map((row) => ({
      chunkId: row.chunk_id,
      chunkIndex: row.chunk_index,
      sourceId: row.source_id,
      title: row.title,
      url: row.url,
      kind: row.kind,
      content: row.content,
      score: Number(row.score),
    }));
  }
}
