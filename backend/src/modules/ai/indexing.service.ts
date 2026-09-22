import { Inject, Injectable } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import {
  jobs,
  sourceChunks,
  sourceSegments,
  sources,
  type SourceSegmentMetadata,
} from '../../database/schema';
import { InternalError } from '../../common/errors/domain-error';
import { DRIZZLE } from '../database/database.module';
import { ChunkingService, CHUNKING_VERSION } from './chunking.service';
import { EmbeddingService, EMBEDDING_DIMENSIONS } from './embedding.service';

/**
 * Bump when the chunk/embed/replace workflow changes; used for idempotency.
 * Version 2 is the structure-aware chunking plus contextual chunk embedding
 * representation (see also `CHUNKING_VERSION` in chunking.service.ts).
 */
export const INDEX_PROCESSING_VERSION = 2;

/**
 * The representation key recorded in `app_settings` after a reindex-all run:
 * the chunking and indexing versions plus the effective embedding model and
 * dimensions. A mismatch means stored chunks predate the running
 * representation and must be rebuilt.
 */
export function indexingRepresentationKey(
  embeddingModel: string,
  dimensions: number,
): string {
  return `chunking=${CHUNKING_VERSION};indexing=${INDEX_PROCESSING_VERSION};model=${embeddingModel};dims=${dimensions}`;
}

/** Reads the heading path a segment persisted in its metadata. */
function headingPathOf(metadata: SourceSegmentMetadata | null): string[] {
  const value = metadata?.headingPath;
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

const CHUNK_INSERT_BATCH = 200;

export interface IndexResult {
  chunksCount: number;
  /** True when the source was missing or produced no chunks. */
  skipped: boolean;
  /** True when a cancellation/supersession invalidated the indexing attempt. */
  cancelled: boolean;
  contentHash: string | null;
  processingVersion: number;
  /** The chunk representation the stored chunks were built with. */
  chunkingVersion: number;
  embeddingModel: string;
  embeddingDimensions: number;
  sourceVersionId?: string | null;
}

@Injectable()
export class IndexingService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly chunkingService: ChunkingService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  /**
   * Chunks a source, generates embeddings, and atomically replaces the
   * previous chunk set. The old chunks remain untouched until new embeddings
   * have been generated successfully.
   */
  async indexSource(
    sourceId: string,
    requestedVersionId?: string,
    jobId?: string,
  ): Promise<IndexResult> {
    const [source] = await this.db
      .select({
        id: sources.id,
        notebookId: sources.notebookId,
        kind: sources.kind,
        title: sources.title,
        rawText: sources.rawText,
        contentHash: sources.contentHash,
        currentVersionId: sources.currentVersionId,
      })
      .from(sources)
      .where(eq(sources.id, sourceId));

    if (!source) {
      return this.emptyResult(null, null);
    }

    const sourceVersionId =
      requestedVersionId ?? source.currentVersionId ?? null;
    let segments: {
      id: string;
      content: string;
      headingPath: string[];
      locator?: Record<string, unknown> | null;
    }[] = [];
    if (sourceVersionId) {
      const rows = await this.db
        .select({
          id: sourceSegments.id,
          content: sourceSegments.content,
          metadata: sourceSegments.metadata,
          locator: sourceSegments.locator,
        })
        .from(sourceSegments)
        .where(eq(sourceSegments.sourceVersionId, sourceVersionId))
        .orderBy(sourceSegments.ordinal);
      segments = rows.map((segment) => ({
        id: segment.id,
        content: segment.content,
        headingPath: headingPathOf(segment.metadata),
        locator: segment.locator as Record<string, unknown>,
      }));
    }

    const chunks = this.chunkingService.chunkSource({
      id: source.id,
      notebookId: source.notebookId,
      kind: source.kind,
      title: source.title,
      rawText: source.rawText,
      sourceVersionId,
      segments,
    });
    if (chunks.length === 0) {
      return this.emptyResult(source.contentHash ?? null, sourceVersionId);
    }

    // One Source's ordered chunks are embedded as one contextual group, so
    // every chunk encodes its document context.
    const embedding = await this.embeddingService.embedDocumentGroups([
      chunks.map((chunk) => chunk.searchableText),
    ]);

    if (embedding.embeddings.length !== chunks.length) {
      throw new InternalError(
        `Embedding count mismatch: expected ${chunks.length}, received ${embedding.embeddings.length}`,
        {
          messageKey: 'errors.ai.indexing.embeddingCountMismatch',
          params: {
            expected: chunks.length,
            received: embedding.embeddings.length,
          },
        },
      );
    }

    const replaced = await this.db.transaction(async (tx) => {
      // Cancellation and supersession update the job before the source. Keep
      // the same lock order here so a cancellation that committed before this
      // transaction began is observed before any old chunks are removed.
      if (jobId) {
        const [job] = await tx
          .select({ status: jobs.status })
          .from(jobs)
          .where(eq(jobs.id, jobId))
          .for('update');
        if (!job || job.status !== 'processing') return false;
      }

      const [currentSource] = await tx
        .select({
          currentVersionId: sources.currentVersionId,
          processingStatus: sources.processingStatus,
          rawText: sources.rawText,
          contentHash: sources.contentHash,
        })
        .from(sources)
        .where(eq(sources.id, sourceId))
        .for('update');

      // The source/version snapshot used for embedding must still be current.
      // In particular, a raw-text job has a null version fence: a newly
      // persisted version must invalidate it just as a changed version id
      // invalidates a versioned job.
      if (
        !currentSource ||
        currentSource.processingStatus === 'cancelled' ||
        currentSource.currentVersionId !== sourceVersionId ||
        currentSource.contentHash !== source.contentHash ||
        currentSource.rawText !== source.rawText
      ) {
        return false;
      }

      await tx.delete(sourceChunks).where(eq(sourceChunks.sourceId, sourceId));

      for (
        let offset = 0;
        offset < chunks.length;
        offset += CHUNK_INSERT_BATCH
      ) {
        const batch = chunks.slice(offset, offset + CHUNK_INSERT_BATCH);
        const rows = batch.map((chunk, i) => {
          const vector = embedding.embeddings[offset + i];
          const row = {
            id: createId(),
            sourceId: chunk.sourceId,
            notebookId: chunk.notebookId,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            searchableText: chunk.searchableText,
            contextHeader: chunk.contextHeader,
            headingPath: chunk.headingPath,
            sourceKind: chunk.sourceKind,
            embedding: vector,
            sourceVersionId: chunk.sourceVersionId,
            locator: chunk.locator,
            segmentIds: chunk.segmentIds,
            chunkingVersion: chunk.chunkingVersion,
            contentHash: chunk.contentHash,
          };
          return row;
        });
        await tx.insert(sourceChunks).values(rows);
      }

      return true;
    });

    if (!replaced) {
      return this.emptyResult(
        source.contentHash ?? null,
        sourceVersionId,
        true,
      );
    }

    return {
      chunksCount: chunks.length,
      skipped: false,
      cancelled: false,
      contentHash: source.contentHash ?? null,
      processingVersion: INDEX_PROCESSING_VERSION,
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: embedding.model,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      sourceVersionId,
    };
  }

  async deleteSourceChunks(sourceId: string): Promise<void> {
    await this.db
      .delete(sourceChunks)
      .where(eq(sourceChunks.sourceId, sourceId));
  }

  private emptyResult(
    contentHash: string | null,
    sourceVersionId: string | null,
    cancelled = false,
  ): IndexResult {
    return {
      chunksCount: 0,
      skipped: true,
      cancelled,
      contentHash,
      processingVersion: INDEX_PROCESSING_VERSION,
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: this.embeddingService.documentEmbeddingModel(),
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      sourceVersionId,
    };
  }
}
