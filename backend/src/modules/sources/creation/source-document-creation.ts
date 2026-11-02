import { Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../../database/schema';
import { sources } from '../../../database/schema';
import { BadRequestError } from '../../../common/errors/domain-error';
import { NotebooksService } from '../../notebooks/notebooks.service';
import { SourceAcquisitionService } from '../acquisition/source-acquisition.service';
import {
  EXTRACTOR_VERSION,
  NORMALIZATION_VERSION,
} from '../extraction/document-normalizer.service';
import { SourceExtractionService } from '../extraction/source-extraction.service';
import { WebScrapeError } from '../source-errors';
import type {
  CreateTextSourceInput,
  CreateUrlSourceInput,
} from '../sources.service';
import { SourceCreationCompletion } from './source-creation-completion';
import {
  lifecycleValues,
  MAX_RAW_TEXT_BYTES,
  resolveSourceTitle,
} from './source-creation-policy';

@Injectable()
export class SourceDocumentCreation {
  constructor(
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly notebooksService: NotebooksService,
    private readonly acquisitionService: SourceAcquisitionService,
    private readonly sourceExtractionService: SourceExtractionService,
    private readonly completion: SourceCreationCompletion,
  ) {}

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
    const quality = this.completion.assessDocument(document);
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

    return this.completion.persistVersionAndIndex(row, document, quality);
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
    const quality = this.completion.assessDocument(document);
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

    return this.completion.persistVersionAndIndex(row, document, quality);
  }
}
