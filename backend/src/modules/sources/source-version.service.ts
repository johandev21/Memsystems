import { Inject, Injectable } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import { and, eq, ne } from 'drizzle-orm';
import {
  SourceQualityAssessment,
  sourceSegments,
  sourceVersions,
  sources,
} from '../../database/schema';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { DRIZZLE } from '../database/database.module';
import {
  DocumentSection,
  NormalizedDocument,
  EXTRACTOR_VERSION,
  NORMALIZATION_VERSION,
} from './document-normalizer.service';
import { qualityFailureOf } from './source-quality.service';

/** The small persistence seam shared by synchronous and queued ingestion. */
export interface PersistedSourceVersion {
  id: string;
  sourceId: string;
  contentHash: string;
  segmentCount: number;
  quality: SourceQualityAssessment | null;
}

export class SourceVersionCancelledError extends Error {
  constructor() {
    super('Source version persistence was cancelled');
    this.name = 'SourceVersionCancelledError';
  }
}

function toSegments(document: NormalizedDocument): DocumentSection[] {
  if (document.sections.length > 0) return document.sections;
  if (document.text.trim().length === 0) return [];
  return [{ headingPath: [], content: document.text, ordinal: 0 }];
}

/**
 * Persists one immutable interpretation and its ordered semantic segments in
 * a single transaction. `sources.rawText` remains a compatibility projection.
 */
@Injectable()
export class SourceVersionService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
  ) {}

  async persist(
    sourceId: string,
    document: NormalizedDocument,
    artifactKey: string | null = null,
    quality: SourceQualityAssessment | null = null,
  ): Promise<PersistedSourceVersion> {
    const versionId = createId();
    const sections = toSegments(document);
    let persistedId = versionId;
    let persistedSegmentCount = sections.length;

    const failure = quality ? qualityFailureOf(quality) : null;
    const degraded = failure !== null;
    // A degraded version keeps its extraction for inspection, but the source
    // must not look ready and no Evidence may be indexed from it.
    const lifecycle = failure
      ? {
          processingStatus: 'degraded' as const,
          processingStage: null,
          processingErrorCode: failure.code,
          processingErrorMessage: failure.messageKey,
        }
      : {
          processingStatus: 'processing' as const,
          processingStage: 'indexing' as const,
          processingErrorCode: null,
          processingErrorMessage: null,
        };

    await this.db.transaction(async (tx) => {
      const [source] = await tx
        .select({ processingStatus: sources.processingStatus })
        .from(sources)
        .where(eq(sources.id, sourceId))
        .for('update');
      if (!source || source.processingStatus === 'cancelled') {
        throw new SourceVersionCancelledError();
      }

      const [existing] = await tx
        .select({ id: sourceVersions.id })
        .from(sourceVersions)
        .where(
          and(
            eq(sourceVersions.sourceId, sourceId),
            eq(sourceVersions.contentHash, document.contentHash),
            eq(sourceVersions.extractorId, document.extractionMethod),
            eq(sourceVersions.extractorVersion, EXTRACTOR_VERSION),
            eq(sourceVersions.normalizationVersion, NORMALIZATION_VERSION),
          ),
        )
        .limit(1);

      if (existing) {
        persistedId = existing.id;
        const existingSegments = await tx
          .select({ id: sourceSegments.id })
          .from(sourceSegments)
          .where(eq(sourceSegments.sourceVersionId, existing.id));
        persistedSegmentCount = existingSegments.length;
        if (quality) {
          await tx
            .update(sourceVersions)
            .set({ quality, status: degraded ? 'degraded' : 'ready' })
            .where(eq(sourceVersions.id, existing.id));
        }
        await tx
          .update(sources)
          .set({
            ...lifecycle,
            rawText: document.text,
            contentHash: document.contentHash,
            currentVersionId: existing.id,
          })
          .where(eq(sources.id, sourceId));
        return;
      }

      await tx.insert(sourceVersions).values({
        id: versionId,
        sourceId,
        artifactKey,
        contentHash: document.contentHash,
        extractorId: document.extractionMethod,
        extractorVersion: EXTRACTOR_VERSION,
        normalizationVersion: NORMALIZATION_VERSION,
        status: degraded ? 'degraded' : 'ready',
        quality,
        errorCode: null,
        errorMessage: null,
      });

      if (sections.length > 0) {
        await tx.insert(sourceSegments).values(
          sections.map((section, index) => ({
            id: createId(),
            sourceVersionId: versionId,
            ordinal: section.ordinal ?? index,
            kind: section.kind ?? ('text' as const),
            content: section.content,
            locator: {
              ...(section.pageNumber ? { pageNumber: section.pageNumber } : {}),
              ...(section.locator ?? {}),
            },
            metadata: {
              headingPath: section.headingPath,
              ...(section.metadata ?? {}),
            },
          })),
        );
      }

      await tx
        .update(sources)
        .set({
          ...lifecycle,
          rawText: document.text,
          contentHash: document.contentHash,
          extractionMethod: document.extractionMethod,
          extractorVersion: EXTRACTOR_VERSION,
          normalizationVersion: NORMALIZATION_VERSION,
          currentVersionId: versionId,
        })
        .where(eq(sources.id, sourceId));
    });

    return {
      id: persistedId,
      sourceId,
      contentHash: document.contentHash,
      segmentCount: persistedSegmentCount,
      quality,
    };
  }

  async markProcessing(
    sourceId: string,
    stage: 'extracting' | 'transcribing' | 'analyzing_visuals' | 'indexing',
  ): Promise<void> {
    const [updated] = await this.db
      .update(sources)
      .set({
        processingStatus: 'processing',
        processingStage: stage,
        processingErrorCode: null,
        processingErrorMessage: null,
      })
      .where(
        and(
          eq(sources.id, sourceId),
          ne(sources.processingStatus, 'cancelled'),
        ),
      )
      .returning({ id: sources.id });
    if (!updated) throw new SourceVersionCancelledError();
  }

  async markFailed(
    sourceId: string,
    errorCode: string,
    message: string,
  ): Promise<void> {
    await this.db
      .update(sources)
      .set({
        processingStatus: 'failed',
        processingStage: null,
        processingErrorCode: errorCode,
        processingErrorMessage: message.slice(0, 2000),
      })
      .where(
        and(
          eq(sources.id, sourceId),
          ne(sources.processingStatus, 'cancelled'),
        ),
      );
  }

  async markReady(
    sourceId: string,
    sourceVersionId?: string | null,
  ): Promise<void> {
    const predicates = [
      eq(sources.id, sourceId),
      ne(sources.processingStatus, 'cancelled'),
      ...(sourceVersionId
        ? [eq(sources.currentVersionId, sourceVersionId)]
        : []),
    ];
    await this.db
      .update(sources)
      .set({
        processingStatus: 'ready',
        processingStage: null,
        processingErrorCode: null,
        processingErrorMessage: null,
      })
      .where(and(...predicates));
  }
}
