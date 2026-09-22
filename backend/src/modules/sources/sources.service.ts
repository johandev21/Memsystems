import { Inject, Injectable, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { asc, and, count, desc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import {
  SourceMetadata,
  SourceQualityAssessment,
  sourceChunks,
  sourceSegments,
  sources,
} from '../../database/schema';
import {
  BadRequestError,
  NotFoundError,
} from '../../common/errors/domain-error';
import { DRIZZLE } from '../database/database.module';
import { NotebooksService } from '../notebooks/notebooks.service';
import { StorageService } from '../storage/storage.service';
import {
  contentHashOf,
  DocumentSection,
  EXTRACTOR_VERSION,
  NormalizedDocument,
  NORMALIZATION_VERSION,
} from './document-normalizer.service';
import { CaptionParserService } from './caption-parser.service';
import { isImageFile, MAX_IMAGE_BYTES } from './image-inspector.service';
import { isAudioFile, MAX_AUDIO_BYTES } from './audio-inspector.service';
import { isVideoFile, MAX_VIDEO_BYTES } from './video-inspector.service';
import { isPptxFile, MAX_PPTX_BYTES } from './pptx-inspector.service';
import { isEpubFile, MAX_EPUB_BYTES } from './epub-inspector.service';
import { isTabularFile, MAX_TABULAR_BYTES } from './tabular-inspector.service';
import { SourceAcquisitionService } from './source-acquisition.service';
import { SourceExtractionService } from './source-extraction.service';
import { SourceJobsService } from './source-jobs.service';
import {
  qualityFailureLifecycle,
  qualityFailureOf,
  SourceQualityService,
} from './source-quality.service';
import { WebScrapeError } from './source-errors';
import { SourceVersionService } from './source-version.service';

export type SourceKind = 'text' | 'url' | 'file';

export interface CreateTextSourceInput {
  title: string;
  rawText: string;
}

export interface CreateUrlSourceInput {
  url: string;
  title?: string;
  minTextLength?: number;
  oauthToken?: string;
  captionText?: string;
  captionFormat?: 'vtt' | 'srt' | 'json3' | 'xml' | 'plain' | 'auto';
  provenance?: {
    addedVia: 'ai_search';
    metadata: SourceMetadata;
  };
}

export interface CreateFileArtifactInput {
  artifactKey: string;
  filename: string;
  contentType: string;
  fileSize: number;
  sha256?: string;
  title?: string;
}

export interface DownloadInfo {
  url: string;
  expiresIn: number;
}

export const SOURCE_LIMIT = 300;

const MAX_RAW_TEXT_BYTES = 5 * 1024 * 1024;
const MAX_FILE_BYTES = 50 * 1024 * 1024;

function lifecycleValues(
  modality:
    | 'document'
    | 'audio'
    | 'video'
    | 'image'
    | 'slides'
    | 'ebook'
    | 'code'
    | 'dataset',
  stage: 'uploading' | 'extracting' | 'indexing',
): Record<string, unknown> {
  return {
    modality,
    processingStatus: 'pending',
    processingStage: stage,
    processingErrorCode: null,
    processingErrorMessage: null,
  };
}

function buildS3Key(
  _notebookId: string,
  sha256: string,
  originalName: string,
): string {
  const ext = pickExtension(originalName);
  return `sources/${sha256}${ext}`;
}

function pickExtension(originalName: string): string {
  const idx = originalName.lastIndexOf('.');
  if (idx === -1 || idx === originalName.length - 1) return '';
  return originalName.slice(idx).toLowerCase();
}

function looksLikeUrlTitle(title: string): boolean {
  // Derived titles look like "en.wikipedia.org/wiki/Philosophy" or "https://..."
  if (/^https?:\/\//i.test(title)) return true;
  return /^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(title);
}

function resolveSourceTitle(
  providedTitle?: string,
  scrapedTitle?: string,
): string {
  const provided = providedTitle?.trim();
  const scraped = scrapedTitle?.trim();

  if (provided && !looksLikeUrlTitle(provided)) return provided.slice(0, 500);
  if (scraped && !looksLikeUrlTitle(scraped)) return scraped.slice(0, 500);
  return (provided || scraped || 'Untitled').slice(0, 500);
}

@Injectable()
export class SourcesService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly notebooksService: NotebooksService,
    private readonly storageService: StorageService,
    private readonly acquisitionService: SourceAcquisitionService,
    private readonly sourceJobsService: SourceJobsService,
    private readonly sourceExtractionService: SourceExtractionService,
    @Optional() private readonly sourceVersionService?: SourceVersionService,
    @Optional() private readonly captionParser?: CaptionParserService,
    @Optional() sourceQualityService?: SourceQualityService,
  ) {
    this.sourceQuality = sourceQualityService ?? new SourceQualityService();
  }

  private readonly sourceQuality: SourceQualityService;

  async list(notebookId: string) {
    await this.notebooksService.assertNotebookOwner(notebookId);
    return this.db
      .select({
        id: sources.id,
        notebookId: sources.notebookId,
        kind: sources.kind,
        title: sources.title,
        url: sources.url,
        contentType: sources.contentType,
        fileSize: sources.fileSize,
        modality: sources.modality,
        processingStatus: sources.processingStatus,
        processingStage: sources.processingStage,
        processingErrorCode: sources.processingErrorCode,
        processingErrorMessage: sources.processingErrorMessage,
        createdAt: sources.createdAt,
      })
      .from(sources)
      .where(eq(sources.notebookId, notebookId))
      .orderBy(desc(sources.createdAt));
  }

  async get(id: string) {
    const source = await this.fetchOwned(id);
    const indexingStatus = await this.sourceJobsService.latestForSource(id);
    let segments: (typeof sourceSegments.$inferSelect)[] = [];
    if (source.currentVersionId) {
      segments = await this.db
        .select()
        .from(sourceSegments)
        .where(eq(sourceSegments.sourceVersionId, source.currentVersionId))
        .orderBy(asc(sourceSegments.ordinal));
    }
    return { ...source, indexingStatus, segments };
  }

  async createText(notebookId: string, input: CreateTextSourceInput) {
    await this.notebooksService.assertNotebookOwner(notebookId);
    const title = input.title.trim();
    const rawText = input.rawText;
    if (rawText.trim().length === 0) {
      throw new BadRequestError('rawText must be non-empty', {
        messageKey: 'errors.sources.create.textEmpty',
      });
    }
    if (Buffer.byteLength(rawText, 'utf8') > MAX_RAW_TEXT_BYTES) {
      throw new BadRequestError(
        `rawText exceeds maximum size of ${MAX_RAW_TEXT_BYTES} bytes`,
        {
          messageKey: 'errors.sources.create.textTooLarge',
          params: { maxBytes: MAX_RAW_TEXT_BYTES },
        },
      );
    }

    const document = this.acquisitionService.fromText(rawText, title);
    const quality = this.assessDocument(document);
    const [row] = await this.db
      .insert(sources)
      .values({
        ...lifecycleValues('document', 'indexing'),
        notebookId,
        kind: 'text',
        title: document.title.slice(0, 500),
        rawText: document.text,
        contentHash: document.contentHash,
        extractionMethod: document.extractionMethod,
        extractorVersion: EXTRACTOR_VERSION,
        normalizationVersion: NORMALIZATION_VERSION,
      })
      .returning();

    return this.persistVersionAndIndex(row, document, quality);
  }

  async createUrl(notebookId: string, input: CreateUrlSourceInput) {
    await this.notebooksService.assertNotebookOwner(notebookId);
    const document = await this.acquisitionService.acquireUrl(input.url, {
      oauthToken: input.oauthToken,
      captionText: input.captionText,
      captionFormat: input.captionFormat,
    });

    const scrapedText = document.text.trim();
    if (input.minTextLength && scrapedText.length < input.minTextLength) {
      throw new WebScrapeError(
        `Page has too little content (${scrapedText.length} chars, need at least ${input.minTextLength})`,
        'not_readerable',
        {
          messageKey: 'errors.sources.create.urlTooLittleContent',
          params: {
            length: scrapedText.length,
            minLength: input.minTextLength,
          },
        },
      );
    }

    const isYouTube = this.sourceExtractionService.isYouTubeUrl(input.url);
    const modality = isYouTube ? 'video' : 'document';
    const title = resolveSourceTitle(input.title, document.title);
    const quality = this.assessDocument(document);
    const [row] = await this.db
      .insert(sources)
      .values({
        ...lifecycleValues(modality, 'indexing'),
        notebookId,
        kind: 'url',
        addedVia: input.provenance?.addedVia ?? 'manual',
        metadata: input.provenance?.metadata ?? null,
        title,
        rawText: document.text,
        url: input.url,
        contentHash: document.contentHash,
        canonicalUrl: document.canonicalUrl ?? null,
        fetchedUrl: document.fetchedUrl ?? null,
        httpStatus: document.status ?? null,
        fetchedAt: new Date(),
        etag: document.etag ?? null,
        lastModified: document.lastModified ?? null,
        contentType: document.httpContentType ?? null,
        extractionMethod: document.extractionMethod,
        extractorVersion: EXTRACTOR_VERSION,
        normalizationVersion: NORMALIZATION_VERSION,
        robotsDecision: document.robotsDecision ?? null,
      })
      .returning();

    return this.persistVersionAndIndex(row, document, quality);
  }

  async countForNotebook(notebookId: string): Promise<number> {
    await this.notebooksService.assertNotebookOwner(notebookId);
    const [row] = await this.db
      .select({ value: count() })
      .from(sources)
      .where(eq(sources.notebookId, notebookId));
    return row?.value ?? 0;
  }

  async listUrlsForNotebook(notebookId: string): Promise<string[]> {
    await this.notebooksService.assertNotebookOwner(notebookId);
    const rows = await this.db
      .select({ url: sources.url })
      .from(sources)
      .where(eq(sources.notebookId, notebookId));
    return rows.map((r) => r.url).filter((url): url is string => url !== null);
  }

  async createFile(
    notebookId: string,
    fileBuffer: Buffer,
    fileName: string,
    fileType: string,
    customTitle?: string,
  ) {
    await this.notebooksService.assertNotebookOwner(notebookId);
    if (fileBuffer.length === 0) {
      throw new BadRequestError('Uploaded file is empty', {
        messageKey: 'errors.sources.create.fileEmpty',
      });
    }
    const isAudio = isAudioFile(fileType, fileName);
    const isImage = isImageFile(fileType, fileName);
    const isVideo = isVideoFile(fileType, fileName);
    const isPptx = isPptxFile(fileType, fileName);
    const isEpub = isEpubFile(fileType, fileName);
    const isTabular = isTabularFile(fileType, fileName);
    const maxBytes = isVideo
      ? MAX_VIDEO_BYTES
      : isAudio
        ? MAX_AUDIO_BYTES
        : isImage
          ? MAX_IMAGE_BYTES
          : isPptx
            ? MAX_PPTX_BYTES
            : isEpub
              ? MAX_EPUB_BYTES
              : isTabular
                ? MAX_TABULAR_BYTES
                : MAX_FILE_BYTES;
    if (fileBuffer.length > maxBytes) {
      throw new BadRequestError(
        `File exceeds maximum size of ${maxBytes} bytes`,
        {
          messageKey: 'errors.sources.create.fileTooLarge',
          params: { maxBytes },
        },
      );
    }
    if (!this.sourceExtractionService.isSupportedFile(fileType, fileName)) {
      throw new BadRequestError(
        `Unsupported file type: ${fileType || 'unknown'} (${fileName})`,
        {
          messageKey: 'errors.sources.upload.unsupportedType',
          params: { contentType: fileType || 'unknown', filename: fileName },
        },
      );
    }

    const sha256 = createHash('sha256').update(fileBuffer).digest('hex');
    const s3Key = buildS3Key(notebookId, sha256, fileName);

    await this.storageService.putObject({
      key: s3Key,
      body: fileBuffer,
      contentType: fileType || 'application/octet-stream',
    });

    const title = (customTitle?.trim() || fileName).slice(0, 500);
    // PPTX -> slides, EPUB -> ebook, CSV/TSV/XLSX -> dataset
    const modality = isVideo
      ? 'video'
      : isAudio
        ? 'audio'
        : isImage
          ? 'image'
          : isPptx
            ? 'slides'
            : isEpub
              ? 'ebook'
              : isTabular
                ? 'dataset'
                : 'document';

    const [row] = await this.db
      .insert(sources)
      .values({
        ...lifecycleValues(modality, 'uploading'),
        notebookId,
        kind: 'file',
        title,
        // File extraction is deliberately deferred to source_processing. Keep
        // this compatibility projection empty until the worker succeeds.
        rawText: '',
        s3Key,
        contentType: fileType || null,
        fileSize: fileBuffer.length,
        sha256,
      })
      .returning();

    if (this.sourceJobsService.enqueueProcessing) {
      await this.sourceJobsService.enqueueProcessing(row.id);
    } else {
      // Characterization-test adapters from the pre-queue contract only know
      // about enqueue(sourceId); retain that seam during migration.
      await this.sourceJobsService.enqueue(row.id);
    }
    return row;
  }

  /** Create a source after a direct upload has already persisted its artifact. */
  async createFileFromArtifact(
    notebookId: string,
    input: CreateFileArtifactInput,
  ) {
    await this.notebooksService.assertNotebookOwner(notebookId);
    if (!input.artifactKey.startsWith('pending-sources/')) {
      throw new BadRequestError('Invalid source artifact key', {
        messageKey: 'errors.sources.artifact.invalidKey',
      });
    }
    if (!Number.isSafeInteger(input.fileSize) || input.fileSize <= 0) {
      throw new BadRequestError('Invalid source artifact size', {
        messageKey: 'errors.sources.artifact.invalidSize',
      });
    }
    const isAudio = isAudioFile(input.contentType, input.filename);
    const isImage = isImageFile(input.contentType, input.filename);
    const isVideo = isVideoFile(input.contentType, input.filename);
    const isPptx = isPptxFile(input.contentType, input.filename);
    const isEpub = isEpubFile(input.contentType, input.filename);
    const isTabular = isTabularFile(input.contentType, input.filename);
    const maxBytes = isVideo
      ? MAX_VIDEO_BYTES
      : isAudio
        ? MAX_AUDIO_BYTES
        : isImage
          ? MAX_IMAGE_BYTES
          : isPptx
            ? MAX_PPTX_BYTES
            : isEpub
              ? MAX_EPUB_BYTES
              : isTabular
                ? MAX_TABULAR_BYTES
                : MAX_FILE_BYTES;
    if (input.fileSize > maxBytes) {
      throw new BadRequestError(
        `File exceeds maximum size of ${maxBytes} bytes`,
        {
          messageKey: 'errors.sources.create.fileTooLarge',
          params: { maxBytes },
        },
      );
    }
    if (
      !this.sourceExtractionService.isSupportedFile(
        input.contentType,
        input.filename,
      )
    ) {
      throw new BadRequestError(
        `Unsupported file type: ${input.contentType || 'unknown'} (${input.filename})`,
        {
          messageKey: 'errors.sources.upload.unsupportedType',
          params: {
            contentType: input.contentType || 'unknown',
            filename: input.filename,
          },
        },
      );
    }
    let storedSize: number;
    try {
      storedSize = (await this.storageService.objectMetadata(input.artifactKey))
        .contentLength;
    } catch {
      throw new BadRequestError('Source artifact is unavailable', {
        messageKey: 'errors.sources.artifact.unavailable',
      });
    }
    if (storedSize !== input.fileSize) {
      throw new BadRequestError(
        'Source artifact size does not match upload metadata',
        { messageKey: 'errors.sources.artifact.sizeMismatch' },
      );
    }

    const modality = isVideo
      ? 'video'
      : isAudio
        ? 'audio'
        : isImage
          ? 'image'
          : isPptx
            ? 'slides'
            : isEpub
              ? 'ebook'
              : isTabular
                ? 'dataset'
                : 'document';

    const [row] = await this.db
      .insert(sources)
      .values({
        ...lifecycleValues(modality, 'uploading'),
        notebookId,
        kind: 'file',
        title: (input.title?.trim() || input.filename).slice(0, 500),
        rawText: '',
        s3Key: input.artifactKey,
        contentType: input.contentType || null,
        fileSize: input.fileSize,
        sha256: input.sha256 ?? null,
      })
      .returning();

    if (this.sourceJobsService.enqueueProcessing) {
      await this.sourceJobsService.enqueueProcessing(row.id);
    } else {
      await this.sourceJobsService.enqueue(row.id);
    }
    return row;
  }

  async delete(id: string) {
    const source = await this.fetchOwned(id);
    if (source.kind === 'file' && source.s3Key) {
      await this.storageService.deleteObject(source.s3Key).catch(() => {});
    }
    await this.sourceJobsService.cancelForSource(id);
    const [deleted] = await this.db
      .delete(sources)
      .where(eq(sources.id, id))
      .returning();
    return deleted;
  }

  /** Explicit operator re-run: enqueues a fresh indexing job for a source. */
  async reindex(id: string) {
    await this.fetchOwned(id);
    const job = await this.sourceJobsService.enqueue(id);
    return job;
  }

  /** Retry extraction for artifacts, or indexing for already-normalized sources. */
  async retry(id: string) {
    const source = await this.fetchOwned(id);
    await this.db
      .update(sources)
      .set({
        processingStatus: 'pending',
        processingStage: source.kind === 'file' ? 'uploading' : 'indexing',
        processingErrorCode: null,
        processingErrorMessage: null,
      })
      .where(eq(sources.id, id));

    if (source.kind === 'file' && source.s3Key) {
      return this.sourceJobsService.enqueueProcessing(id);
    }
    return this.sourceJobsService.enqueue(id);
  }

  async cancel(id: string): Promise<void> {
    await this.fetchOwned(id);
    await this.sourceJobsService.cancelForSource(id);
    await this.db
      .update(sources)
      .set({
        processingStatus: 'cancelled',
        processingStage: null,
      })
      .where(eq(sources.id, id));
  }

  async reindexNotebook(notebookId: string) {
    await this.notebooksService.assertNotebookOwner(notebookId);
    const count = await this.sourceJobsService.reindexNotebook(notebookId);
    return { enqueued: count };
  }

  /**
   * Re-indexes every source, e.g. after an embedding-model switch or a
   * representation version bump. The work fans out per Source through the
   * job queue, so the response reports how many Sources will be rebuilt.
   */
  async reembedAll() {
    return this.sourceJobsService.reembedAll();
  }

  async getDownload(id: string, expiresInSeconds = 300): Promise<DownloadInfo> {
    const source = await this.fetchOwned(id);
    if (source.kind !== 'file' || !source.s3Key) {
      throw new BadRequestError('Source has no downloadable file', {
        messageKey: 'errors.sources.download.noFile',
      });
    }
    const url = await this.storageService.presignDownload(
      source.s3Key,
      expiresInSeconds,
      source.title,
    );
    return { url, expiresIn: expiresInSeconds };
  }

  async updateSpeakerLabels(
    sourceId: string,
    speakerMap: Record<string, string>,
  ) {
    const source = await this.fetchOwned(sourceId);
    if (!source.currentVersionId) {
      throw new BadRequestError('Source has no current version to update', {
        messageKey: 'errors.sources.speaker.noCurrentVersion',
      });
    }
    if (!speakerMap || Object.keys(speakerMap).length === 0) {
      throw new BadRequestError('Speaker map must not be empty', {
        messageKey: 'errors.sources.speaker.emptyMap',
      });
    }

    return this.db.transaction(async (tx) => {
      const segments = await tx
        .select()
        .from(sourceSegments)
        .where(eq(sourceSegments.sourceVersionId, source.currentVersionId!))
        .orderBy(asc(sourceSegments.ordinal));

      for (const segment of segments) {
        const currentSpeaker = segment.locator?.speaker;
        if (currentSpeaker && speakerMap[currentSpeaker] !== undefined) {
          const newSpeaker = speakerMap[currentSpeaker];
          await tx
            .update(sourceSegments)
            .set({
              locator: {
                ...segment.locator,
                speaker: newSpeaker,
              },
            })
            .where(eq(sourceSegments.id, segment.id));
        }
      }

      const chunks = await tx
        .select()
        .from(sourceChunks)
        .where(
          and(
            eq(sourceChunks.sourceId, sourceId),
            eq(sourceChunks.sourceVersionId, source.currentVersionId!),
          ),
        );

      for (const chunk of chunks) {
        const currentSpeaker = chunk.locator?.speaker;
        if (currentSpeaker && speakerMap[currentSpeaker] !== undefined) {
          const newSpeaker = speakerMap[currentSpeaker];
          await tx
            .update(sourceChunks)
            .set({
              locator: {
                ...(chunk.locator ?? {}),
                speaker: newSpeaker,
              },
            })
            .where(eq(sourceChunks.id, chunk.id));
        }
      }

      return tx
        .select()
        .from(sourceSegments)
        .where(eq(sourceSegments.sourceVersionId, source.currentVersionId!))
        .orderBy(asc(sourceSegments.ordinal));
    });
  }

  async addTranscript(sourceId: string, transcriptText: string) {
    const source = await this.fetchOwned(sourceId);
    const trimmed = transcriptText.trim();
    if (!trimmed) {
      throw new BadRequestError('Transcript text must not be empty', {
        messageKey: 'errors.sources.transcript.empty',
      });
    }

    const captionParser = this.captionParser ?? new CaptionParserService();
    const segments = captionParser.parse(trimmed, 'auto');
    if (segments.length === 0) {
      throw new BadRequestError(
        'Failed to parse transcript segments from provided text',
        { messageKey: 'errors.sources.transcript.parseFailed' },
      );
    }

    const isYouTube = source.url
      ? this.sourceExtractionService.isYouTubeUrl(source.url)
      : false;
    const extractionMethod = isYouTube ? 'youtube' : 'transcription';
    const text = segments.map((s) => s.content).join('\n\n');

    const sections: DocumentSection[] = segments.map((seg, idx) => ({
      headingPath: seg.speaker ? [seg.speaker] : [],
      content: seg.content,
      ordinal: idx,
      kind: 'transcript' as const,
      locator: {
        startOffsetMs: seg.startOffsetMs,
        endOffsetMs: seg.endOffsetMs,
        ...(seg.speaker ? { speaker: seg.speaker } : {}),
      },
    }));

    const doc: NormalizedDocument = {
      title: source.title,
      text,
      siteName: isYouTube ? 'YouTube' : undefined,
      extractionMethod,
      contentType: source.contentType ?? 'text/html',
      sourceUrl: source.url ?? undefined,
      canonicalUrl: source.canonicalUrl ?? undefined,
      contentHash: contentHashOf(text),
      sections,
    };

    const quality = this.assessDocument(doc);
    await this.persistVersion(source.id, doc, quality);
    if (quality.status !== 'degraded') {
      await this.sourceJobsService.enqueue(source.id);
    }

    return this.get(source.id);
  }

  private async fetchOwned(id: string) {
    const [source] = await this.db
      .select()
      .from(sources)
      .where(eq(sources.id, id));
    if (!source) {
      throw new NotFoundError('Source', {
        messageKey: 'errors.sources.source.notFound',
      });
    }
    await this.notebooksService.assertNotebookOwner(source.notebookId);
    return source;
  }

  private assessDocument(
    document: NormalizedDocument,
  ): SourceQualityAssessment {
    return this.sourceQuality.assess(document);
  }

  /**
   * Persists the version, marks the source degraded when the assessment says
   * so, and otherwise schedules indexing.
   */
  private async persistVersionAndIndex(
    row: typeof sources.$inferSelect,
    document: NormalizedDocument,
    quality: SourceQualityAssessment,
  ): Promise<typeof sources.$inferSelect> {
    await this.persistVersion(row.id, document, quality);
    if (quality.status === 'degraded') {
      return this.withQualityFailure(row, quality);
    }
    await this.sourceJobsService.enqueue(row.id);
    return row;
  }

  /** Mirrors the persisted degraded lifecycle on the response row. */
  private withQualityFailure(
    row: typeof sources.$inferSelect,
    quality: SourceQualityAssessment,
  ): typeof sources.$inferSelect {
    const failure = qualityFailureOf(quality);
    if (!failure) return row;
    return {
      ...row,
      ...qualityFailureLifecycle(failure),
    };
  }

  private async persistVersion(
    sourceId: string,
    document: NormalizedDocument,
    quality: SourceQualityAssessment | null = null,
  ): Promise<void> {
    // Optional keeps old unit-test adapters and pre-0A deployments usable;
    // the application module always provides this persistence seam.
    if (this.sourceVersionService) {
      await this.sourceVersionService.persist(sourceId, document, { quality });
    }
  }
}
