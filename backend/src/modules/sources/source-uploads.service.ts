import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Request } from 'express';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { sourceUploadIntents } from '../../database/schema';
import { DRIZZLE } from '../database/database.module';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../common/errors/domain-error';
import { NotebooksService } from '../notebooks/notebooks.service';
import { StorageService } from '../storage/storage.service';
import { isImageFile, MAX_IMAGE_BYTES } from './image-inspector.service';
import { isAudioFile, MAX_AUDIO_BYTES } from './audio-inspector.service';
import { isVideoFile, MAX_VIDEO_BYTES } from './video-inspector.service';
import { isPptxFile, MAX_PPTX_BYTES } from './pptx-inspector.service';
import { isEpubFile, MAX_EPUB_BYTES } from './epub-inspector.service';
import { isTabularFile, MAX_TABULAR_BYTES } from './tabular-inspector.service';
import { SourceExtractionService } from './source-extraction.service';
import { SourcesService } from './sources.service';

// Current extractors buffer documents in the worker, so keep this aligned
// with the legacy safe limit until streaming media extractors exist.
export const SOURCE_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;
export {
  MAX_IMAGE_BYTES,
  MAX_AUDIO_BYTES,
  MAX_VIDEO_BYTES,
  MAX_PPTX_BYTES,
  MAX_EPUB_BYTES,
  MAX_TABULAR_BYTES,
};
const TARGET_TTL_MS = 15 * 60 * 1000;

type UploadIntent = typeof sourceUploadIntents.$inferSelect;

interface UploadTarget {
  token: string;
  notebookId: string;
  key: string;
  filename: string;
  contentType: string;
  size: number;
  sha256?: string;
  expiresAt: Date;
  uploaded?: { size: number; sha256: string };
}

export interface CreateUploadTargetInput {
  filename: string;
  contentType: string;
  size: number;
  sha256?: string;
}

@Injectable()
export class SourceUploadsService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly notebooksService: NotebooksService,
    private readonly storageService: StorageService,
    private readonly extractionService: SourceExtractionService,
    private readonly sourcesService: SourcesService,
  ) {}

  async createTarget(notebookId: string, input: CreateUploadTargetInput) {
    await this.notebooksService.assertNotebookOwner(notebookId);
    const filename = input.filename.trim();
    const contentType = input.contentType.split(';')[0].trim().toLowerCase();
    if (!filename || filename.length > 500) {
      throw new BadRequestError('A filename up to 500 characters is required', {
        messageKey: 'errors.sources.upload.filenameRequired',
      });
    }
    if (!Number.isSafeInteger(input.size) || input.size <= 0) {
      throw new BadRequestError('Upload size must be a positive integer', {
        messageKey: 'errors.sources.upload.sizePositive',
      });
    }
    const isAudio = isAudioFile(contentType, filename);
    const isImage = isImageFile(contentType, filename);
    const isVideo = isVideoFile(contentType, filename);
    const isPptx = isPptxFile(contentType, filename);
    const isEpub = isEpubFile(contentType, filename);
    const isTabular = isTabularFile(contentType, filename);
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
                : SOURCE_UPLOAD_MAX_BYTES;
    if (input.size > maxBytes) {
      throw new BadRequestError(
        `Upload exceeds maximum size of ${maxBytes} bytes`,
        {
          messageKey: 'errors.sources.upload.tooLarge',
          params: { maxBytes },
        },
      );
    }
    if (!this.extractionService.isSupportedFile(contentType, filename)) {
      throw new BadRequestError(
        `Unsupported file type: ${contentType || 'unknown'} (${filename})`,
        {
          messageKey: 'errors.sources.upload.unsupportedType',
          params: { contentType: contentType || 'unknown', filename },
        },
      );
    }
    if (input.sha256 && !/^[0-9a-f]{64}$/i.test(input.sha256)) {
      throw new BadRequestError(
        'sha256 must be a 64-character hexadecimal digest',
        { messageKey: 'errors.sources.upload.sha256Invalid' },
      );
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + TARGET_TTL_MS);
    const key = `pending-sources/${token}`;
    const sha256 = input.sha256?.toLowerCase();
    await this.db.insert(sourceUploadIntents).values({
      id: token,
      notebookId,
      storageKey: key,
      filename,
      contentType,
      expectedBytes: input.size,
      expectedSha256: sha256,
      expiresAt,
    });

    const uploadUrl = this.storageService.isLocalStorage()
      ? `/api/source-uploads/${encodeURIComponent(token)}`
      : await this.storageService.presignUpload(
          key,
          Math.ceil(TARGET_TTL_MS / 1000),
          contentType,
          input.size,
          sha256,
        );

    return {
      uploadId: token,
      uploadUrl,
      method: 'PUT' as const,
      headers: {
        'Content-Type': contentType,
        ...(sha256 ? { 'x-amz-meta-sha256': sha256 } : {}),
      },
      expiresAt: expiresAt.toISOString(),
      maxBytes,
    };
  }

  async uploadLocal(token: string, request: Request) {
    const target = await this.getTarget(token);
    if (!this.storageService.isLocalStorage()) {
      throw new BadRequestError(
        'This upload target requires its presigned URL',
        { messageKey: 'errors.sources.upload.presignedRequired' },
      );
    }
    const declaredLength = request.headers['content-length'];
    const contentLength = declaredLength ? Number(declaredLength) : undefined;
    if (contentLength !== undefined && contentLength !== target.size) {
      throw new BadRequestError('Upload size does not match the upload target', {
        messageKey: 'errors.sources.upload.sizeMismatch',
      });
    }
    const isAudio = isAudioFile(target.contentType, target.filename);
    const isImage = isImageFile(target.contentType, target.filename);
    const isVideo = isVideoFile(target.contentType, target.filename);
    const isPptx = isPptxFile(target.contentType, target.filename);
    const isEpub = isEpubFile(target.contentType, target.filename);
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
              : SOURCE_UPLOAD_MAX_BYTES;
    if (contentLength !== undefined && contentLength > maxBytes) {
      throw new BadRequestError(
        `Upload exceeds maximum size of ${maxBytes} bytes`,
        {
          messageKey: 'errors.sources.upload.tooLarge',
          params: { maxBytes },
        },
      );
    }
    let uploaded: { size: number; sha256: string };
    try {
      const stored = await this.storageService.putObjectStream({
        key: target.key,
        body: request,
        contentType: target.contentType,
        expectedLength: target.size,
        maxBytes,
      });
      uploaded = { size: stored.contentLength, sha256: stored.sha256 };
    } catch (error) {
      if (error instanceof BadRequestError) throw error;
      const message = error instanceof Error ? error.message : 'Upload failed';
      if (message.includes('maximum size')) {
        throw new BadRequestError(message, {
          messageKey: 'errors.sources.upload.tooLargeGeneric',
        });
      }
      throw new BadRequestError('Upload could not be stored', {
        messageKey: 'errors.sources.upload.storeFailed',
      });
    }

    try {
      this.assertIntegrity(target, uploaded);
    } catch (error) {
      await this.storageService.deleteObject(target.key).catch(() => {});
      throw error;
    }

    const [updated] = await this.db
      .update(sourceUploadIntents)
      .set({
        status: 'uploaded',
        uploadedBytes: uploaded.size,
        uploadedSha256: uploaded.sha256,
      })
      .where(
        and(
          eq(sourceUploadIntents.id, token),
          inArray(sourceUploadIntents.status, ['pending', 'uploaded']),
        ),
      )
      .returning({ status: sourceUploadIntents.status });
    if (!updated) {
      const current = await this.getTarget(token);
      if (!current.uploaded) {
        await this.storageService.deleteObject(target.key).catch(() => {});
        throw new BadRequestError('Upload target is no longer available', {
          messageKey: 'errors.sources.upload.targetUnavailable',
        });
      }
    }
    return { uploaded: true, size: uploaded.size };
  }

  async finalize(notebookId: string, token: string, title?: string) {
    const target = await this.getTarget(token);
    if (target.notebookId !== notebookId) {
      throw new ForbiddenError(
        'Upload target does not belong to this notebook',
        { messageKey: 'errors.sources.upload.notebookMismatch' },
      );
    }

    let uploaded = target.uploaded;
    if (!uploaded) {
      let metadata: Awaited<ReturnType<StorageService['objectMetadata']>>;
      try {
        metadata = await this.storageService.objectMetadata(target.key);
      } catch {
        throw new BadRequestError(
          'Upload is incomplete or no longer available',
          { messageKey: 'errors.sources.upload.incomplete' },
        );
      }
      if (metadata.contentLength !== target.size) {
        throw new BadRequestError(
          'Upload size does not match the upload target',
        );
      }
      const digest = metadata.metadata.sha256?.toLowerCase();
      if (target.sha256 && digest && digest !== target.sha256) {
        throw new BadRequestError('Upload integrity check failed', {
        messageKey: 'errors.sources.upload.integrityFailed',
      });
      }
      // S3 metadata does not expose a provider-independent object digest. The
      // exact byte count remains mandatory; clients may additionally provide
      // a SHA-256 metadata value, which is checked above.
      uploaded = { size: metadata.contentLength, sha256: digest ?? '' };
      await this.db
        .update(sourceUploadIntents)
        .set({
          status: 'uploaded',
          uploadedBytes: uploaded.size,
          uploadedSha256: uploaded.sha256 || null,
        })
        .where(
          and(
            eq(sourceUploadIntents.id, token),
            eq(sourceUploadIntents.status, 'pending'),
          ),
        );
    }
    this.assertIntegrity(target, uploaded);

    const claim = await this.claimForFinalize(notebookId, token);
    if (claim.expired) {
      await this.storageService.deleteObject(target.key).catch(() => {});
      throw new BadRequestError('Upload target has expired', {
        messageKey: 'errors.sources.upload.expired',
      });
    }

    const claimedTarget = this.toTarget(claim.row);
    const claimedUpload = claimedTarget.uploaded ?? uploaded;
    if (!claimedUpload) {
      throw new BadRequestError('Upload is incomplete or no longer available', {
        messageKey: 'errors.sources.upload.incomplete',
      });
    }
    try {
      this.assertIntegrity(claimedTarget, claimedUpload);
      const source = await this.sourcesService.createFileFromArtifact(
        notebookId,
        {
          artifactKey: claimedTarget.key,
          filename: claimedTarget.filename,
          contentType: claimedTarget.contentType,
          fileSize: claimedUpload.size,
          sha256: claimedUpload.sha256 || claimedTarget.sha256,
          title,
        },
      );
      await this.db
        .update(sourceUploadIntents)
        .set({ status: 'consumed', consumedAt: new Date() })
        .where(
          and(
            eq(sourceUploadIntents.id, token),
            eq(sourceUploadIntents.status, 'consuming'),
          ),
        );
      return source;
    } catch (error) {
      // Let a transient source-creation error be retried while preserving the
      // one-consumer claim against concurrent finalizers.
      await this.db
        .update(sourceUploadIntents)
        .set({ status: 'uploaded' })
        .where(
          and(
            eq(sourceUploadIntents.id, token),
            eq(sourceUploadIntents.status, 'consuming'),
          ),
        );
      throw error;
    }
  }

  private async getTarget(token: string): Promise<UploadTarget> {
    const [row] = await this.db
      .select()
      .from(sourceUploadIntents)
      .where(eq(sourceUploadIntents.id, token))
      .limit(1);
    if (!row)
      throw new NotFoundError('Upload target', {
        messageKey: 'errors.sources.upload.notFound',
      });
    if (row.status === 'consumed') {
      throw new BadRequestError('Upload target has already been finalized', {
        messageKey: 'errors.sources.upload.alreadyFinalized',
      });
    }
    if (row.status === 'expired' || row.expiresAt.getTime() <= Date.now()) {
      await this.expire(row);
      throw new BadRequestError('Upload target has expired', {
        messageKey: 'errors.sources.upload.expired',
      });
    }
    if (row.status === 'consuming') {
      throw new BadRequestError('Upload target is already being finalized', {
        messageKey: 'errors.sources.upload.alreadyFinalizing',
      });
    }
    return this.toTarget(row);
  }

  private async expire(row: UploadIntent): Promise<void> {
    await this.db
      .update(sourceUploadIntents)
      .set({ status: 'expired' })
      .where(
        and(
          eq(sourceUploadIntents.id, row.id),
          ne(sourceUploadIntents.status, 'consumed'),
        ),
      );
    await this.storageService.deleteObject(row.storageKey).catch(() => {});
  }

  private async claimForFinalize(
    notebookId: string,
    token: string,
  ): Promise<{ row: UploadIntent; expired?: false } | { expired: true }> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(sourceUploadIntents)
        .where(eq(sourceUploadIntents.id, token))
        .for('update');
      if (!row)
      throw new NotFoundError('Upload target', {
        messageKey: 'errors.sources.upload.notFound',
      });
      if (row.notebookId !== notebookId) {
        throw new ForbiddenError(
          'Upload target does not belong to this notebook',
        );
      }
      if (row.status === 'consumed') {
        throw new BadRequestError('Upload target has already been finalized', {
        messageKey: 'errors.sources.upload.alreadyFinalized',
      });
      }
      if (row.status === 'expired' || row.expiresAt.getTime() <= Date.now()) {
        await tx
          .update(sourceUploadIntents)
          .set({ status: 'expired' })
          .where(
            and(
              eq(sourceUploadIntents.id, token),
              ne(sourceUploadIntents.status, 'consumed'),
            ),
          );
        return { expired: true as const };
      }
      if (row.status === 'consuming') {
        throw new BadRequestError('Upload target is already being finalized', {
        messageKey: 'errors.sources.upload.alreadyFinalizing',
      });
      }
      if (!row.uploadedBytes || row.uploadedBytes !== row.expectedBytes) {
        throw new BadRequestError(
          'Upload is incomplete or no longer available',
          { messageKey: 'errors.sources.upload.incomplete' },
        );
      }
      const [claimed] = await tx
        .update(sourceUploadIntents)
        .set({ status: 'consuming' })
        .where(
          and(
            eq(sourceUploadIntents.id, token),
            inArray(sourceUploadIntents.status, ['pending', 'uploaded']),
          ),
        )
        .returning();
      if (!claimed) {
        throw new BadRequestError('Upload target is already being finalized', {
        messageKey: 'errors.sources.upload.alreadyFinalizing',
      });
      }
      return { row: claimed };
    });
  }

  private toTarget(row: UploadIntent): UploadTarget {
    return {
      token: row.id,
      notebookId: row.notebookId,
      key: row.storageKey,
      filename: row.filename,
      contentType: row.contentType,
      size: row.expectedBytes,
      sha256: row.expectedSha256 ?? undefined,
      expiresAt: row.expiresAt,
      uploaded:
        row.uploadedBytes === null
          ? undefined
          : {
              size: row.uploadedBytes,
              sha256: row.uploadedSha256 ?? '',
            },
    };
  }

  private assertIntegrity(
    target: UploadTarget,
    uploaded: { size: number; sha256: string },
  ): void {
    if (uploaded.size !== target.size) {
      throw new BadRequestError('Upload size does not match the upload target', {
        messageKey: 'errors.sources.upload.sizeMismatch',
      });
    }
    if (target.sha256 && uploaded.sha256 && target.sha256 !== uploaded.sha256) {
      throw new BadRequestError('Upload integrity check failed', {
        messageKey: 'errors.sources.upload.integrityFailed',
      });
    }
  }
}
