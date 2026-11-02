import { Inject, Injectable, Optional } from '@nestjs/common';
import { asc, and, count, eq, inArray, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import {
  SourceMetadata,
  sourceFolders,
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
import { CaptionParserService } from './extraction/caption-parser.service';
import { SourceAcquisitionService } from './acquisition/source-acquisition.service';
import { SourceExtractionService } from './extraction/source-extraction.service';
import { SourceJobsService } from './jobs/source-jobs.service';
import { SourceQualityService } from './source-quality.service';
import { SourceVersionService } from './source-version.service';
import { SourceCreationCompletion } from './creation/source-creation-completion';
import { SourceDocumentCreation } from './creation/source-document-creation';
import { SourceFileCreation } from './creation/source-file-creation';
import {
  SOURCE_PAGE_DEFAULT,
  SOURCE_PAGE_MAX,
  SourceListPageOptions,
  decodeSourceCursor,
  encodeSourceCursor,
  listByNotebook,
} from './source-listing';
import { SourceSpeakerOperations } from './source-speaker-operations';
import { SourceTranscription } from './source-transcription';

export type { SourceKind } from '../../database/schema';
export {
  SOURCE_PAGE_DEFAULT,
  SOURCE_PAGE_MAX,
  type SourceListPageOptions,
  decodeSourceCursor,
  encodeSourceCursor,
  listByNotebook,
};

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
    this.creationCompletion = new SourceCreationCompletion(
      this.sourceQuality,
      this.sourceJobsService,
      this.sourceVersionService,
    );
    this.documentCreation = new SourceDocumentCreation(
      this.db,
      this.notebooksService,
      this.acquisitionService,
      this.sourceExtractionService,
      this.creationCompletion,
    );
    this.fileCreation = new SourceFileCreation(
      this.db,
      this.notebooksService,
      this.storageService,
      this.sourceExtractionService,
      this.sourceJobsService,
    );
    this.speakerOperations = new SourceSpeakerOperations(this.db);
    this.transcription = new SourceTranscription(
      this.sourceExtractionService,
      this.creationCompletion,
      this.sourceJobsService,
      this.captionParser,
    );
  }

  private readonly sourceQuality: SourceQualityService;
  private readonly creationCompletion: SourceCreationCompletion;
  private readonly documentCreation: SourceDocumentCreation;
  private readonly fileCreation: SourceFileCreation;
  private readonly speakerOperations: SourceSpeakerOperations;
  private readonly transcription: SourceTranscription;

  async list(notebookId: string, options: SourceListPageOptions = {}) {
    await this.notebooksService.assertNotebookOwner(notebookId);
    return listByNotebook(this.db, notebookId, options);
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
    return this.documentCreation.createText(notebookId, input);
  }

  async createUrl(notebookId: string, input: CreateUrlSourceInput) {
    return this.documentCreation.createUrl(notebookId, input);
  }

  async countForNotebook(notebookId: string): Promise<number> {
    await this.notebooksService.assertNotebookOwner(notebookId);
    const [row] = await this.db
      .select({ value: count() })
      .from(sources)
      .where(
        and(eq(sources.notebookId, notebookId), isNull(sources.deletedAt)),
      );
    return row?.value ?? 0;
  }

  async listUrlsForNotebook(
    notebookId: string,
    candidateUrls: string[],
  ): Promise<string[]> {
    await this.notebooksService.assertNotebookOwner(notebookId);
    if (candidateUrls.length === 0) return [];
    const filters = [
      eq(sources.notebookId, notebookId),
      isNull(sources.deletedAt),
    ];
    filters.push(inArray(sources.url, candidateUrls));
    const rows = await this.db
      .select({ url: sources.url })
      .from(sources)
      .where(and(...filters));
    return rows.map((r) => r.url).filter((url): url is string => url !== null);
  }

  async createFile(
    notebookId: string,
    fileBuffer: Buffer,
    fileName: string,
    fileType: string,
    customTitle?: string,
  ) {
    return this.fileCreation.createFile(
      notebookId,
      fileBuffer,
      fileName,
      fileType,
      customTitle,
    );
  }

  async createFileFromArtifact(
    notebookId: string,
    input: CreateFileArtifactInput,
  ) {
    return this.fileCreation.createFileFromArtifact(notebookId, input);
  }

  async delete(id: string) {
    await this.fetchOwned(id);
    await this.sourceJobsService.cancelForSource(id);
    const now = new Date();
    const [deleted] = await this.db
      .update(sources)
      .set({ deletedAt: now })
      .where(eq(sources.id, id))
      .returning();
    return deleted;
  }

  async move(id: string, folderId: string | null) {
    const source = await this.fetchOwned(id);

    if ((source.folderId ?? null) === (folderId ?? null)) {
      throw new BadRequestError('Source is already in this location', {
        messageKey: 'errors.sources.alreadyInLocation',
      });
    }

    if (folderId !== null) {
      const [folder] = await this.db
        .select({
          id: sourceFolders.id,
          notebookId: sourceFolders.notebookId,
          deletedAt: sourceFolders.deletedAt,
        })
        .from(sourceFolders)
        .where(eq(sourceFolders.id, folderId));

      if (
        !folder ||
        folder.deletedAt ||
        folder.notebookId !== source.notebookId
      ) {
        throw new NotFoundError('SourceFolder', {
          messageKey: 'errors.sources.folder.notFound',
        });
      }
    }

    const [updated] = await this.db
      .update(sources)
      .set({
        folderId,
      })
      .where(eq(sources.id, id))
      .returning();

    return updated;
  }

  async update(id: string, input: { title?: string }) {
    await this.fetchOwned(id);

    const updates: Partial<typeof sources.$inferInsert> = {};
    if (input.title !== undefined) {
      const trimmed = input.title.trim();
      if (!trimmed) {
        throw new BadRequestError('Source title cannot be blank', {
          messageKey: 'errors.sources.blankTitle',
        });
      }
      updates.title = trimmed;
    }

    if (Object.keys(updates).length === 0) {
      return this.fetchOwned(id);
    }

    const [updated] = await this.db
      .update(sources)
      .set(updates)
      .where(eq(sources.id, id))
      .returning();

    return updated;
  }

  async reindex(id: string) {
    await this.fetchOwned(id);
    const job = await this.sourceJobsService.enqueue(id);
    return job;
  }

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

    if (
      (source.kind === 'file' && source.s3Key) ||
      (source.kind === 'url' &&
        source.url &&
        this.sourceExtractionService.isYouTubeUrl(source.url))
    ) {
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

  async reembedAll() {
    const { sourcesQueued, jobId } = await this.sourceJobsService.reembedAll();
    return { enqueued: sourcesQueued, jobId };
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
    return this.speakerOperations.updateSpeakerLabels(source, speakerMap);
  }

  async addTranscript(sourceId: string, transcriptText: string) {
    const source = await this.fetchOwned(sourceId);
    await this.transcription.addTranscript(source, transcriptText);
    return this.get(source.id);
  }

  private async fetchOwned(id: string) {
    const [source] = await this.db
      .select()
      .from(sources)
      .where(and(eq(sources.id, id), isNull(sources.deletedAt)));
    if (!source) {
      throw new NotFoundError('Source', {
        messageKey: 'errors.sources.source.notFound',
      });
    }
    await this.notebooksService.assertNotebookOwner(source.notebookId);
    return source;
  }
}
