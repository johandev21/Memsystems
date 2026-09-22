import { Inject, Injectable, Optional } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { sources } from '../../database/schema';
import { Job, JobHandler } from '../jobs/job-handler.interface';
import { JobQueueService } from '../jobs/job-queue.service';
import { DRIZZLE } from '../database/database.module';
import { IndexResult } from '../ai/indexing.service';
import { StorageService } from '../storage/storage.service';
import { SourceAcquisitionService } from './source-acquisition.service';
import { SourceVersionService } from './source-version.service';
import {
  DocumentNormalizerService,
  NormalizedDocument,
} from './document-normalizer.service';
import { ImageInspectorService, isImageFile } from './image-inspector.service';
import { AudioInspectorService, isAudioFile } from './audio-inspector.service';
import {
  VideoInspectorService,
  VideoKeyframe,
  isVideoFile,
} from './video-inspector.service';
import {
  YouTubeAcquisitionService,
  isYouTubeUrl,
} from './youtube-acquisition.service';
import { TranscriptionService } from './transcription.service';
import { SourceExtractionService } from './source-extraction.service';
import { VisionExtractionService } from './vision-extraction.service';
import type { VisionExtractionResult } from './vision-extraction.port';
import { PptxInspectorService } from './pptx-inspector.service';
import { EpubInspectorService } from './epub-inspector.service';
import { PptxParserService } from './pptx-parser.service';
import { EpubParserService } from './epub-parser.service';
import { TabularInspectorService } from './tabular-inspector.service';
import { TabularParserService } from './tabular-parser.service';
import { SourceQualityService } from './source-quality.service';
import { DomainError, InternalError } from '../../common/errors/domain-error';

export interface SourceProcessingJobPayload {
  sourceId: string;
  notebookId?: string;
}

export interface SourceProcessingResult {
  sourceVersionId: string;
  segmentCount: number;
  contentHash: string;
}

export class SourceProcessingCancelledError extends Error {
  constructor() {
    super('Source processing job was cancelled or superseded');
    this.name = 'SourceProcessingCancelledError';
  }
}

/** Extracts an immutable source version from a stored artifact and schedules indexing. */
@Injectable()
export class SourceProcessingHandler implements JobHandler<
  SourceProcessingJobPayload,
  SourceProcessingResult
> {
  readonly type = 'source_processing';
  readonly concurrency = 1;
  readonly maxAttempts = 3;
  readonly backoffBaseMs = 5_000;

  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly storageService: StorageService,
    private readonly acquisitionService: SourceAcquisitionService,
    private readonly versions: SourceVersionService,
    private readonly queue: JobQueueService,
    private readonly imageInspector: ImageInspectorService,
    private readonly visionExtraction: VisionExtractionService,
    private readonly audioInspector: AudioInspectorService,
    private readonly transcriptionService: TranscriptionService,
    private readonly sourceExtractionService: SourceExtractionService,
    private readonly documentNormalizer: DocumentNormalizerService,
    private readonly videoInspector: VideoInspectorService,
    private readonly youtubeAcquisition: YouTubeAcquisitionService,
    private readonly pptxInspector: PptxInspectorService,
    private readonly epubInspector: EpubInspectorService,
    private readonly pptxParser: PptxParserService,
    private readonly epubParser: EpubParserService,
    private readonly tabularInspector: TabularInspectorService,
    private readonly tabularParser: TabularParserService,
    @Optional() sourceQualityService?: SourceQualityService,
  ) {
    this.sourceQuality = sourceQualityService ?? new SourceQualityService();
  }

  private readonly sourceQuality: SourceQualityService;

  async process(
    job: Job<SourceProcessingJobPayload, SourceProcessingResult>,
  ): Promise<SourceProcessingResult> {
    const sourceId = job.payload.sourceId;
    const [source] = await this.db
      .select()
      .from(sources)
      .where(eq(sources.id, sourceId));
    if (!source || !(await this.queue.isActive(job.id))) {
      throw new SourceProcessingCancelledError();
    }

    try {
      if (source.processingStatus === 'cancelled') {
        throw new SourceProcessingCancelledError();
      }

      let document: NormalizedDocument;
      // Tabular data is structured, not prose: the link/boilerplate quality
      // heuristic does not apply to it.
      let qualityGateApplies = true;
      if (source.s3Key) {
        const isVideo =
          this.sourceExtractionService.isVideoFile(
            source.contentType,
            source.s3Key,
          ) ||
          isVideoFile(source.contentType, source.s3Key) ||
          source.modality === 'video';

        const isAudio =
          this.sourceExtractionService.isAudioFile(
            source.contentType,
            source.s3Key,
          ) ||
          isAudioFile(source.contentType, source.s3Key) ||
          source.modality === 'audio';

        const isImage =
          isImageFile(source.contentType, source.s3Key) ||
          source.modality === 'image';

        const isPptx =
          this.sourceExtractionService.isPptxFile(
            source.contentType,
            source.s3Key,
          ) || source.modality === 'slides';

        const isEpub =
          this.sourceExtractionService.isEpubFile(
            source.contentType,
            source.s3Key,
          ) || source.modality === 'ebook';

        const isTabular =
          this.sourceExtractionService.isTabularFile(
            source.contentType,
            source.s3Key,
          ) || source.modality === 'dataset';

        const buffer = await this.storageService.getObjectBuffer(source.s3Key);

        if (isVideo) {
          await this.versions.markProcessing(sourceId, 'transcribing');
          const inspected = this.videoInspector.inspect(
            buffer,
            source.contentType,
            source.s3Key,
          );
          const result = await this.transcriptionService.transcribeAudio({
            buffer,
            mimeType: inspected.mimeType,
            filename: source.title,
          });

          await this.versions.markProcessing(sourceId, 'analyzing_visuals');
          const keyframes = this.videoInspector.sampleKeyframes(buffer, {
            durationMs: inspected.durationMs,
            mimeType: inspected.mimeType,
            width: inspected.width,
            height: inspected.height,
          });

          const visualResults: Array<{
            keyframe: VideoKeyframe;
            result: VisionExtractionResult;
          }> = [];

          let prevHash = '';
          for (const keyframe of keyframes) {
            const visResult = await this.visionExtraction.extractVisualDocument(
              {
                buffer: keyframe.buffer,
                mimeType: keyframe.mimeType,
                filename: `${source.title} (Frame at ${Math.round(keyframe.timestampMs / 1000)}s)`,
              },
            );

            const currentHash = visResult.rawText?.trim() || '';
            if (currentHash && currentHash === prevHash) {
              continue;
            }
            if (currentHash) {
              prevHash = currentHash;
            }

            visualResults.push({ keyframe, result: visResult });
          }

          document = this.documentNormalizer.fromVideoResult(result, {
            filename: source.title,
            contentType: inspected.mimeType,
            visualResults,
          });
        } else if (isAudio) {
          await this.versions.markProcessing(sourceId, 'transcribing');
          const inspected = this.audioInspector.inspect(
            buffer,
            source.contentType,
            source.s3Key,
          );
          const result = await this.transcriptionService.transcribeAudio({
            buffer,
            mimeType: inspected.mimeType,
            filename: source.title,
          });

          document = this.documentNormalizer.fromAudioResult(result, {
            filename: source.title,
            contentType: inspected.mimeType,
          });
        } else if (isImage) {
          await this.versions.markProcessing(sourceId, 'analyzing_visuals');
          const inspected = this.imageInspector.inspect(buffer);
          const result = await this.visionExtraction.extractVisualDocument({
            buffer,
            mimeType: inspected.mimeType,
            filename: source.title,
          });

          document = this.documentNormalizer.fromImageResult(result, {
            filename: source.title,
            contentType: inspected.mimeType,
          });
        } else if (isPptx) {
          await this.versions.markProcessing(sourceId, 'extracting');
          this.pptxInspector.inspect(buffer, source.contentType, source.s3Key);
          const result = this.pptxParser.parse(buffer);
          document = this.documentNormalizer.fromPptxResult(result, {
            title: source.title,
            filename: source.s3Key,
          });
        } else if (isEpub) {
          await this.versions.markProcessing(sourceId, 'extracting');
          this.epubInspector.inspect(buffer, source.contentType, source.s3Key);
          const result = this.epubParser.parse(buffer);
          document = this.documentNormalizer.fromEpubResult(result, {
            title: source.title,
          });
        } else if (isTabular) {
          qualityGateApplies = false;
          await this.versions.markProcessing(sourceId, 'extracting');
          this.tabularInspector.inspect(
            buffer,
            source.s3Key,
            source.contentType ?? undefined,
          );
          const result = this.tabularParser.parse(buffer, source.s3Key);
          document = this.documentNormalizer.fromTabularResult(result, {
            title: source.title,
          });
        } else {
          await this.versions.markProcessing(sourceId, 'extracting');
          document = await this.acquisitionService.acquireFile(
            buffer,
            source.contentType ?? '',
            source.s3Key,
          );
        }
      } else if (
        source.url &&
        (this.sourceExtractionService.isYouTubeUrl(source.url) ||
          isYouTubeUrl(source.url))
      ) {
        await this.versions.markProcessing(sourceId, 'extracting');
        const result = await this.youtubeAcquisition.acquire(source.url);
        document = this.documentNormalizer.fromYouTubeResult(result, {
          title: source.title,
          sourceUrl: source.url,
        });
      } else if (source.url) {
        await this.versions.markProcessing(sourceId, 'extracting');
        document = await this.acquisitionService.acquireUrl(source.url);
      } else if (source.kind === 'text') {
        await this.versions.markProcessing(sourceId, 'extracting');
        document = this.acquisitionService.fromText(
          source.rawText,
          source.title,
        );
      } else {
        throw new InternalError('Source has no processable original artifact', {
          messageKey: 'errors.sources.processing.noArtifact',
        });
      }

      if (!(await this.queue.isActive(job.id))) {
        throw new SourceProcessingCancelledError();
      }
      const quality = qualityGateApplies
        ? this.sourceQuality.assess(document)
        : null;
      const version = await this.versions.persist(sourceId, document, {
        artifactKey: source.s3Key ?? null,
        quality,
      });
      if (quality?.status === 'degraded') {
        // Unusable extraction: keep the version and segments for inspection,
        // but never index them as Evidence.
        return {
          sourceVersionId: version.id,
          segmentCount: version.segmentCount,
          contentHash: version.contentHash,
        };
      }
      const indexingJob = await this.queue.enqueueIfActive<
        {
          sourceId: string;
          notebookId: string;
          contentHash?: string | null;
          sourceVersionId?: string;
        },
        IndexResult
      >(
        job.id,
        'source_indexing',
        {
          sourceId,
          notebookId: source.notebookId,
          contentHash: document.contentHash,
          sourceVersionId: version.id,
        },
        { groupKey: `source:${sourceId}`, onConflict: 'cancel_existing' },
      );
      if (!indexingJob) throw new SourceProcessingCancelledError();
      return {
        sourceVersionId: version.id,
        segmentCount: version.segmentCount,
        contentHash: version.contentHash,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const messageKey =
        error instanceof DomainError && error.messageKey
          ? error.messageKey
          : undefined;
      if (
        !(error instanceof SourceProcessingCancelledError) &&
        job.attemptCount >= job.maxAttempts &&
        (await this.queue.isActive(job.id))
      ) {
        await this.versions.markFailed(
          sourceId,
          messageKey ?? 'extraction_failed',
          messageKey ?? message,
        );
      }
      throw error;
    }
  }
}
