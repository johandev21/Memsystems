import { Inject, Injectable, Optional } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { DRIZZLE } from '../database/database.module';
import { EmbeddingService } from './embedding.service';

/** Location metadata carried from a source segment into an index chunk. */
export interface CitationLocator {
  pageNumber?: number;
  slideNumber?: number;
  startOffsetMs?: number;
  endOffsetMs?: number;
  speaker?: string;
  sheetName?: string;
  cellRange?: string;
  symbol?: string;
  lineStart?: number;
  lineEnd?: number;
  imageRegion?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface RetrievedChunk {
  chunkId: string;
  chunkIndex: number;
  sourceId: string;
  title: string;
  content: string;
  score: number;
  url: string | null;
  kind: string;
  sourceVersionId: string | null;
  locator: CitationLocator | null;
}

export const DEFAULT_TOP_K = 8;

/** The distinct source behind candidates that did not clear the floor. */
export interface UnhelpfulSource {
  id: string;
  title: string;
  kind: string;
  url: string | null;
}

/** Why retrieval produced no Evidence. */
export type RetrievalAbstentionReason = 'no_indexed_chunks' | 'below_threshold';

/**
 * The retrieval outcome. A normal result carries the Evidence chunks; an
 * abstention carries no chunks, a reason, and the sources whose candidates
 * failed the floor so the Chat can name them.
 */
export interface RetrievalResult {
  chunks: RetrievedChunk[];
  abstained: boolean;
  abstentionReason: RetrievalAbstentionReason | null;
  unhelpfulSources: UnhelpfulSource[];
}

/** Minimum cosine similarity for a chunk to serve as Evidence. */
export interface RetrievalRelevanceConfig {
  relevanceFloor: number;
}

/**
 * Documented default for the relevance floor. Cosine similarity below this
 * value is treated as unrelated material, not as weak Evidence.
 */
export const DEFAULT_RELEVANCE_FLOOR = 0.3;

export const RETRIEVAL_RELEVANCE_CONFIG = 'RETRIEVAL_RELEVANCE_CONFIG';

/** Sources named in a no-evidence reply, capped to keep the reply readable. */
const MAX_UNHELPFUL_SOURCES = 5;

/** Reads the relevance floor from the environment, falling back to the default. */
export function loadRetrievalRelevanceConfig(
  env: NodeJS.ProcessEnv = process.env,
): RetrievalRelevanceConfig {
  if (env.RETRIEVAL_RELEVANCE_FLOOR === undefined) {
    return { relevanceFloor: DEFAULT_RELEVANCE_FLOOR };
  }
  const parsed = Number.parseFloat(env.RETRIEVAL_RELEVANCE_FLOOR);
  if (!Number.isFinite(parsed))
    return { relevanceFloor: DEFAULT_RELEVANCE_FLOOR };
  return { relevanceFloor: Math.min(1, Math.max(0, parsed)) };
}

@Injectable()
export class RetrievalService {
  private readonly relevanceFloor: number;

  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly embeddingService: EmbeddingService,
    @Optional()
    @Inject(RETRIEVAL_RELEVANCE_CONFIG)
    relevanceConfig?: RetrievalRelevanceConfig,
  ) {
    this.relevanceFloor =
      relevanceConfig?.relevanceFloor ?? DEFAULT_RELEVANCE_FLOOR;
  }

  async retrieve(
    notebookId: string,
    query: string,
    topK: number = DEFAULT_TOP_K,
  ): Promise<RetrievalResult> {
    const queryEmbedding = await this.embeddingService.embedQuery(query);

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
          sc.source_version_id,
          sc.locator,
          sc.content,
          1 - (sc.embedding <=> ${vectorLiteral}::vector) AS score
        FROM source_chunks sc
        JOIN sources s ON s.id = sc.source_id
        WHERE sc.notebook_id = ${notebookId}
          AND s.processing_status <> 'degraded'
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
      source_version_id: string | null;
      locator: CitationLocator | null;
      content: string;
      score: number;
    }[];

    const chunks: RetrievedChunk[] = [];
    const belowFloor: RetrievedChunk[] = [];
    for (const row of rows) {
      const chunk = {
        chunkId: row.chunk_id,
        chunkIndex: row.chunk_index,
        sourceId: row.source_id,
        title: row.title,
        url: row.url,
        kind: row.kind,
        sourceVersionId: row.source_version_id ?? null,
        locator: row.locator ?? null,
        content: row.content,
        score: Number(row.score),
      };
      if (chunk.score >= this.relevanceFloor) {
        chunks.push(chunk);
      } else {
        belowFloor.push(chunk);
      }
    }

    if (chunks.length > 0) {
      return {
        chunks,
        abstained: false,
        abstentionReason: null,
        unhelpfulSources: distinctSources(belowFloor),
      };
    }

    return {
      chunks: [],
      abstained: true,
      abstentionReason:
        rows.length === 0 ? 'no_indexed_chunks' : 'below_threshold',
      unhelpfulSources: distinctSources(belowFloor),
    };
  }
}

function distinctSources(chunks: RetrievedChunk[]): UnhelpfulSource[] {
  const byId = new Map<string, UnhelpfulSource>();
  for (const chunk of chunks) {
    if (byId.has(chunk.sourceId)) continue;
    byId.set(chunk.sourceId, {
      id: chunk.sourceId,
      title: chunk.title,
      kind: chunk.kind,
      url: chunk.url,
    });
  }
  return [...byId.values()].slice(0, MAX_UNHELPFUL_SOURCES);
}
