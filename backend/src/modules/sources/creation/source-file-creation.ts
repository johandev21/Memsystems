import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../../database/schema';
import { sources } from '../../../database/schema';
import { BadRequestError } from '../../../common/errors/domain-error';
import { NotebooksService } from '../../notebooks/notebooks.service';
import { StorageService } from '../../storage/storage.service';
import { SourceExtractionService } from '../extraction/source-extraction.service';
import { SourceJobsService } from '../jobs/source-jobs.service';
import { classifySourceFile } from '../file-classification';
import type { CreateFileArtifactInput } from '../sources.service';
import {
  lifecycleValues,
  MAX_FILE_BYTES,
  buildS3Key,
} from './source-creation-policy';

@Injectable()
export class SourceFileCreation {
  constructor(
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly notebooksService: NotebooksService,
    private readonly storageService: StorageService,
    private readonly sourceExtractionService: SourceExtractionService,
    private readonly sourceJobsService: SourceJobsService,
  ) {}

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
    const classification = classifySourceFile(
      fileType,
      fileName,
      MAX_FILE_BYTES,
    );
    const { modality, maxBytes } = classification;
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
    const [row] = await this.db
      .insert(sources)
      .values({
        ...lifecycleValues(modality, 'uploading'),
        notebookId,
        kind: 'file',
        title,
        rawText: '',
        s3Key,
        contentType: fileType || null,
        fileSize: fileBuffer.length,
        sha256,
      })
      .returning();

    await this.enqueueFileProcessing(row.id);
    return row;
  }

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
    const classification = classifySourceFile(
      input.contentType,
      input.filename,
      MAX_FILE_BYTES,
    );
    const { modality, maxBytes } = classification;
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

    await this.enqueueFileProcessing(row.id);
    return row;
  }

  private async enqueueFileProcessing(sourceId: string): Promise<void> {
    if (this.sourceJobsService.enqueueProcessing) {
      await this.sourceJobsService.enqueueProcessing(sourceId);
    } else {
      await this.sourceJobsService.enqueue(sourceId);
    }
  }
}
