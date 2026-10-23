import { Inject, Injectable, Optional } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../../database/schema';
import { sources, sourceUploadIntents } from '../../../database/schema';
import { Job, JobHandler } from '../../jobs/job-handler.interface';
import { JobQueueService } from '../../jobs/job-queue.service';
import { DRIZZLE } from '../../database/database.module';
import { IndexResult } from '../../ai/indexing/indexing.service';
import { StorageService } from '../../storage/storage.service';
import { SourceAcquisitionService } from '../acquisition/source-acquisition.service';
import { SourceVersionService } from '../source-version.service';
import {
  DocumentNormalizerService,
  NormalizedDocument,
} from '../extraction/document-normalizer.service';
import {
  ImageInspectorService,
  isImageFile,
} from '../extraction/image-inspector.service';
import {
  AudioInspectorService,
  isAudioFile,
} from '../extraction/audio-inspector.service';
import {
  VideoInspectorService,
  VideoKeyframe,
  isVideoFile,
} from '../extraction/video-inspector.service';
import {
  YouTubeAcquisitionService,
  isYouTubeUrl,
} from '../acquisition/youtube-acquisition.service';
import { TranscriptionService } from '../extraction/transcription.service';
import { SourceExtractionService } from '../extraction/source-extraction.service';
import { VisionExtractionService } from '../extraction/vision-extraction.service';
import type { VisionExtractionResult } from '../extraction/vision-extraction.port';
import { SourceQualityService } from '../source-quality.service';
import {
  CRAWLER_SERVICE,
  type CrawlerService,
} from '../../crawler/crawler.types';
import { ParseFileError } from '../source-errors';
import {
  getFileExtension,
  isTabularFile,
} from '../extraction/tabular-inspector.service';
import { TabularInspectorService } from '../extraction/tabular-inspector.service';
import { TabularParserService } from '../extraction/tabular-parser.service';
import {
  DomainError,
  InternalError,
} from '../../../common/errors/domain-error';

const PARSED_FILE_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/epub+zip': 'epub',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'pptx',
  'application/vnd.ms-powerpoint.presentation.macroenabled.12': 'pptm',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'application/x-excel': 'xls',
  'text/csv': 'csv',
};

function parsedFileExtension(
  contentType: string | null,
  fileName: string,
): string | undefined {
  const extension = getFileExtension(fileName);
  const supported = new Set([
    'pdf',
    'epub',
    'docx',
    'pptx',
    'pptm',
    'xlsx',
    'xls',
    'csv',
  ]);
  if (extension && supported.has(extension)) return extension;
  const mime = contentType?.split(';')[0].trim().toLowerCase();
  return mime ? PARSED_FILE_TYPES[mime] : undefined;
}

function isLocalTextFile(
  contentType: string | null,
  fileName: string,
): boolean {
  const extension = getFileExtension(fileName);
  const mime = contentType?.split(';')[0].trim().toLowerCase();
  return (
    extension === 'txt' ||
    extension === 'md' ||
    (!extension && (mime === 'text/plain' || mime === 'text/markdown'))
  );
}

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
    @Inject(CRAWLER_SERVICE)
    private readonly crawler: CrawlerService,
    private readonly videoInspector: VideoInspectorService,
    private readonly youtubeAcquisition: YouTubeAcquisitionService,
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

        const artifactName = source.s3Key.split('/').pop() || source.s3Key;
        const [upload] = await this.db
          .select({ filename: sourceUploadIntents.filename })
          .from(sourceUploadIntents)
          .where(eq(sourceUploadIntents.storageKey, source.s3Key))
          .limit(1);
        const fileName =
          upload?.filename ??
          (getFileExtension(artifactName)
            ? artifactName
            : source.title || artifactName);
        const extension =
          parsedFileExtension(source.contentType, fileName) ??
          (source.modality === 'slides'
            ? 'pptx'
            : source.modality === 'ebook'
              ? 'epub'
              : undefined);
        const fileExtension = getFileExtension(fileName);
        const isLocalTabular =
          ['tsv', 'tab', 'ods'].includes(fileExtension) ||
          (!extension &&
            (isTabularFile(source.contentType, fileName) ||
              source.modality === 'dataset'));

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
        } else if (isLocalTextFile(source.contentType, fileName)) {
          await this.versions.markProcessing(sourceId, 'extracting');
          document = await this.acquisitionService.acquireFile(
            buffer,
            source.contentType ?? '',
            fileName,
          );
        } else if (isLocalTabular) {
          qualityGateApplies = false;
          await this.versions.markProcessing(sourceId, 'extracting');
          this.tabularInspector.inspect(
            buffer,
            fileName,
            source.contentType ?? undefined,
          );
          const result = this.tabularParser.parse(buffer, fileName);
          document = this.documentNormalizer.fromTabularResult(result, {
            title: source.title,
          });
        } else if (extension) {
          qualityGateApplies =
            extension !== 'csv' && extension !== 'xls' && extension !== 'xlsx';
          await this.versions.markProcessing(sourceId, 'extracting');
          const parserFileName =
            fileExtension === extension
              ? fileName
              : `${fileName.replace(/\.[^.]+$/, '')}.${extension}`;
          const parsed = await this.crawler.parseFile({
            buffer,
            filename: parserFileName,
            contentType: source.contentType ?? '',
          });
          document = this.documentNormalizer.fromParsedFileResult(parsed, {
            fileName: parserFileName,
            contentType: source.contentType ?? '',
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
        ((error instanceof ParseFileError && !error.retryable) ||
          job.attemptCount >= job.maxAttempts) &&
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
