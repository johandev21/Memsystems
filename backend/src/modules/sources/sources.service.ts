import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { count, desc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { SourceMetadata, sources } from '../../database/schema';
import {
  BadRequestError,
  NotFoundError,
} from '../../common/errors/domain-error';
import { DRIZZLE } from '../database/database.module';
import { NotebooksService } from '../notebooks/notebooks.service';
import { StorageService } from '../storage/storage.service';
import {
  EXTRACTOR_VERSION,
  NormalizedDocument,
  NORMALIZATION_VERSION,
} from './document-normalizer.service';
import { SourceAcquisitionService } from './source-acquisition.service';
import { SourceExtractionService } from './source-extraction.service';
import { SourceJobsService } from './source-jobs.service';
import { WebScrapeError } from './source-errors';

export type SourceKind = 'text' | 'url' | 'file';

export interface CreateTextSourceInput {
  title: string;
  rawText: string;
}

export interface CreateUrlSourceInput {
  url: string;
  title?: string;
  minTextLength?: number;
  provenance?: {
    addedVia: 'ai_search';
    metadata: SourceMetadata;
  };
}

export interface DownloadInfo {
  url: string;
  expiresIn: number;
}

export const SOURCE_LIMIT = 300;

const MAX_RAW_TEXT_BYTES = 5 * 1024 * 1024;
const MAX_FILE_BYTES = 50 * 1024 * 1024;

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
  ) {}

  async list(userId: string, notebookId: string) {
    await this.notebooksService.assertNotebookOwner(userId, notebookId);
    return this.db
      .select({
        id: sources.id,
        notebookId: sources.notebookId,
        kind: sources.kind,
        title: sources.title,
        url: sources.url,
        contentType: sources.contentType,
        fileSize: sources.fileSize,
        createdAt: sources.createdAt,
      })
      .from(sources)
      .where(eq(sources.notebookId, notebookId))
      .orderBy(desc(sources.createdAt));
  }

  async get(userId: string, id: string) {
    const source = await this.fetchOwned(userId, id);
    const indexingStatus = await this.sourceJobsService.latestForSource(id);
    return { ...source, indexingStatus };
  }

  async createText(
    userId: string,
    notebookId: string,
    input: CreateTextSourceInput,
  ) {
    await this.notebooksService.assertNotebookOwner(userId, notebookId);
    const title = input.title.trim();
    const rawText = input.rawText;
    if (rawText.trim().length === 0) {
      throw new BadRequestError('rawText must be non-empty');
    }
    if (Buffer.byteLength(rawText, 'utf8') > MAX_RAW_TEXT_BYTES) {
      throw new BadRequestError(
        `rawText exceeds maximum size of ${MAX_RAW_TEXT_BYTES} bytes`,
      );
    }

    const document = this.acquisitionService.fromText(rawText, title);
    const [row] = await this.db
      .insert(sources)
      .values({
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

    await this.sourceJobsService.enqueue(row.id);
    return row;
  }

  async createUrl(
    userId: string,
    notebookId: string,
    input: CreateUrlSourceInput,
  ) {
    await this.notebooksService.assertNotebookOwner(userId, notebookId);
    const document = await this.acquisitionService.acquireUrl(input.url);

    const scrapedText = document.text.trim();
    if (input.minTextLength && scrapedText.length < input.minTextLength) {
      throw new WebScrapeError(
        `Page has too little content (${scrapedText.length} chars, need at least ${input.minTextLength})`,
        'not_readerable',
      );
    }

    const title = resolveSourceTitle(input.title, document.title);
    const [row] = await this.db
      .insert(sources)
      .values({
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

    await this.sourceJobsService.enqueue(row.id);
    return row;
  }

  async countForNotebook(userId: string, notebookId: string): Promise<number> {
    await this.notebooksService.assertNotebookOwner(userId, notebookId);
    const [row] = await this.db
      .select({ value: count() })
      .from(sources)
      .where(eq(sources.notebookId, notebookId));
    return row?.value ?? 0;
  }

  async listUrlsForNotebook(
    userId: string,
    notebookId: string,
  ): Promise<string[]> {
    await this.notebooksService.assertNotebookOwner(userId, notebookId);
    const rows = await this.db
      .select({ url: sources.url })
      .from(sources)
      .where(eq(sources.notebookId, notebookId));
    return rows.map((r) => r.url).filter((url): url is string => url !== null);
  }

  async createFile(
    userId: string,
    notebookId: string,
    fileBuffer: Buffer,
    fileName: string,
    fileType: string,
    customTitle?: string,
  ) {
    await this.notebooksService.assertNotebookOwner(userId, notebookId);
    if (fileBuffer.length === 0) {
      throw new BadRequestError('Uploaded file is empty');
    }
    if (fileBuffer.length > MAX_FILE_BYTES) {
      throw new BadRequestError(
        `File exceeds maximum size of ${MAX_FILE_BYTES} bytes`,
      );
    }
    if (!this.sourceExtractionService.isSupportedFile(fileType, fileName)) {
      throw new BadRequestError(
        `Unsupported file type: ${fileType || 'unknown'} (${fileName})`,
      );
    }

    const sha256 = createHash('sha256').update(fileBuffer).digest('hex');
    const s3Key = buildS3Key(notebookId, sha256, fileName);

    await this.storageService.putObject({
      key: s3Key,
      body: fileBuffer,
      contentType: fileType || 'application/octet-stream',
    });

    let document: NormalizedDocument;
    try {
      document = await this.acquisitionService.acquireFile(
        fileBuffer,
        fileType,
        fileName,
      );
    } catch (err) {
      await this.storageService.deleteObject(s3Key).catch(() => {});
      throw err;
    }

    const title = (customTitle?.trim() || fileName).slice(0, 500);

    const [row] = await this.db
      .insert(sources)
      .values({
        notebookId,
        kind: 'file',
        title,
        rawText: document.text,
        s3Key,
        contentType: fileType || null,
        fileSize: fileBuffer.length,
        sha256,
        contentHash: document.contentHash,
        extractionMethod: document.extractionMethod,
        extractorVersion: EXTRACTOR_VERSION,
        normalizationVersion: NORMALIZATION_VERSION,
      })
      .returning();

    await this.sourceJobsService.enqueue(row.id);
    return row;
  }

  async delete(userId: string, id: string) {
    const source = await this.fetchOwned(userId, id);
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
  async reindex(userId: string, id: string) {
    await this.fetchOwned(userId, id);
    const job = await this.sourceJobsService.enqueue(id);
    return job;
  }

  async reindexNotebook(userId: string, notebookId: string) {
    await this.notebooksService.assertNotebookOwner(userId, notebookId);
    const count = await this.sourceJobsService.reindexNotebook(notebookId);
    return { enqueued: count };
  }

  async getDownload(
    userId: string,
    id: string,
    expiresInSeconds = 300,
  ): Promise<DownloadInfo> {
    const source = await this.fetchOwned(userId, id);
    if (source.kind !== 'file' || !source.s3Key) {
      throw new BadRequestError('Source has no downloadable file');
    }
    const url = await this.storageService.presignDownload(
      source.s3Key,
      expiresInSeconds,
      source.title,
    );
    return { url, expiresIn: expiresInSeconds };
  }

  private async fetchOwned(userId: string, id: string) {
    const [source] = await this.db
      .select()
      .from(sources)
      .where(eq(sources.id, id));
    if (!source) {
      throw new NotFoundError('Source');
    }
    await this.notebooksService.assertNotebookOwner(userId, source.notebookId);
    return source;
  }
}
