import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { notebooks } from '../../database/schema';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../common/errors/domain-error';
import { DRIZZLE } from '../database/database.module';
import { StorageService } from '../storage/storage.service';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BANNER_BYTES = 2 * 1024 * 1024;
const BANNER_PRESIGN_TTL = 86400;

export interface CreateNotebookInput {
  title: string;
  description?: string;
  icon?: string;
}

export interface UpdateNotebookInput {
  title?: string;
  description?: string | null;
  icon?: string | null;
  bannerFocalPoint?: { x: number; y: number } | null;
}

export interface NotebookResponse {
  id: string;
  userId: string;
  title: string;
  description: string;
  icon: string;
  banner: string | null;
  bannerUrl: string | null;
  bannerFocalPoint: { x: number; y: number } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BannerUploadResponse {
  s3Key: string;
  uploadUrl: string;
  bannerUrl: string;
}

function toResponse(nb: typeof notebooks.$inferSelect): NotebookResponse {
  return {
    id: nb.id,
    userId: nb.userId,
    title: nb.title,
    description: nb.description ?? '',
    icon: nb.icon ?? 'notebook',
    banner: nb.banner,
    bannerUrl: null,
    bannerFocalPoint: nb.bannerFocalPoint ?? null,
    createdAt: nb.createdAt,
    updatedAt: nb.updatedAt,
  };
}

function pickExtension(originalName: string): string {
  const idx = originalName.lastIndexOf('.');
  if (idx === -1 || idx === originalName.length - 1) return '';
  return originalName.slice(idx).toLowerCase();
}

@Injectable()
export class NotebooksService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly storageService: StorageService,
  ) {}

  async assertNotebookOwner(userId: string, notebookId: string): Promise<void> {
    const [notebook] = await this.db
      .select({ id: notebooks.id, userId: notebooks.userId })
      .from(notebooks)
      .where(eq(notebooks.id, notebookId))
      .limit(1);
    if (!notebook) {
      throw new NotFoundError('Notebook');
    }
    if (notebook.userId !== userId) {
      throw new ForbiddenError('Notebook does not belong to user');
    }
  }

  async formatNotebook(nb: typeof notebooks.$inferSelect) {
    const res = toResponse(nb);
    res.bannerUrl = nb.banner
      ? await this.storageService.presignDownload(nb.banner, BANNER_PRESIGN_TTL)
      : null;
    return res;
  }

  async list(
    userId: string,
    filter?: { limit?: number; offset?: number; search?: string },
  ) {
    if (filter?.limit !== undefined || filter?.search !== undefined) {
      const conditions = [
        eq(notebooks.userId, userId),
        ...(filter.search
          ? [
              or(
                ilike(notebooks.title, `%${filter.search}%`),
                ilike(notebooks.description, `%${filter.search}%`),
              )!,
            ]
          : []),
      ];
      const [{ count }] = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(notebooks)
        .where(and(...conditions));
      const total = Number(count);

      const rows = await this.db
        .select()
        .from(notebooks)
        .where(and(...conditions))
        .orderBy(desc(notebooks.updatedAt))
        .limit(filter.limit ?? 100)
        .offset(filter.offset ?? 0);

      const notebooksRes = await Promise.all(
        rows.map((row) => this.formatNotebook(row)),
      );

      return { notebooks: notebooksRes, total };
    }

    const rows = await this.db
      .select()
      .from(notebooks)
      .where(eq(notebooks.userId, userId))
      .orderBy(desc(notebooks.updatedAt));

    return Promise.all(rows.map((nb) => this.formatNotebook(nb)));
  }

  async get(userId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(notebooks)
      .where(and(eq(notebooks.id, id), eq(notebooks.userId, userId)));
    if (!row) {
      throw new NotFoundError('Notebook');
    }
    return this.formatNotebook(row);
  }

  async create(userId: string, input: CreateNotebookInput) {
    const [row] = await this.db
      .insert(notebooks)
      .values({
        userId,
        title: input.title,
        description: input.description?.trim().slice(0, 500) ?? '',
        icon: input.icon?.trim().slice(0, 50) ?? 'notebook',
      })
      .returning();
    return toResponse(row);
  }

  async update(userId: string, id: string, input: UpdateNotebookInput) {
    const updates: Partial<typeof notebooks.$inferInsert> = {};
    if (input.title !== undefined) {
      updates.title = input.title;
    }
    if (input.description !== undefined) {
      updates.description = input.description
        ? input.description.trim().slice(0, 500)
        : '';
    }
    if (input.icon !== undefined) {
      updates.icon = input.icon ? input.icon.trim().slice(0, 50) : 'notebook';
    }
    if (input.bannerFocalPoint !== undefined) {
      updates.bannerFocalPoint = input.bannerFocalPoint;
    }
    if (Object.keys(updates).length === 0) {
      return this.get(userId, id);
    }
    const [row] = await this.db
      .update(notebooks)
      .set(updates)
      .where(and(eq(notebooks.id, id), eq(notebooks.userId, userId)))
      .returning();
    if (!row) {
      throw new NotFoundError('Notebook');
    }
    const res = toResponse(row);
    res.bannerUrl = row.banner
      ? await this.storageService.presignDownload(
          row.banner,
          BANNER_PRESIGN_TTL,
        )
      : null;
    return res;
  }

  async delete(userId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(notebooks)
      .where(and(eq(notebooks.id, id), eq(notebooks.userId, userId)));
    if (!row) {
      throw new NotFoundError('Notebook');
    }
    if (row.banner) {
      await this.storageService.deleteObject(row.banner).catch(() => {});
    }
    await this.db
      .delete(notebooks)
      .where(and(eq(notebooks.id, id), eq(notebooks.userId, userId)));
    return toResponse(row);
  }

  async removeBanner(userId: string, notebookId: string) {
    await this.assertNotebookOwner(userId, notebookId);

    const [existing] = await this.db
      .select({ banner: notebooks.banner })
      .from(notebooks)
      .where(eq(notebooks.id, notebookId));

    if (existing?.banner) {
      await this.storageService.deleteObject(existing.banner).catch(() => {});
    }

    const [row] = await this.db
      .update(notebooks)
      .set({ banner: null, bannerFocalPoint: null })
      .where(eq(notebooks.id, notebookId))
      .returning();

    const res = toResponse(row);
    res.bannerUrl = null;
    return res;
  }

  async uploadBanner(
    userId: string,
    notebookId: string,
    fileBuffer: Buffer,
    fileName: string,
    fileType: string,
    focalPoint?: { x: number; y: number },
  ) {
    await this.assertNotebookOwner(userId, notebookId);

    if (fileBuffer.length === 0) {
      throw new BadRequestError('Uploaded file is empty');
    }
    if (fileBuffer.length > MAX_BANNER_BYTES) {
      throw new BadRequestError('Banner image exceeds maximum size of 2 MB');
    }
    if (!ACCEPTED_IMAGE_TYPES.includes(fileType)) {
      throw new BadRequestError(
        `Unsupported file type: ${fileType || 'unknown'}. Accepted: JPEG, PNG, WebP`,
      );
    }

    const sha256 = createHash('sha256').update(fileBuffer).digest('hex');
    const ext = pickExtension(fileName);
    const key = `banners/${sha256}${ext}`;

    await this.storageService.putObject({
      key,
      body: fileBuffer,
      contentType: fileType,
    });

    const [existing] = await this.db
      .select({ banner: notebooks.banner })
      .from(notebooks)
      .where(eq(notebooks.id, notebookId));

    if (existing?.banner && existing.banner !== key) {
      await this.storageService.deleteObject(existing.banner).catch(() => {});
    }

    const [row] = await this.db
      .update(notebooks)
      .set({ banner: key, bannerFocalPoint: focalPoint ?? null })
      .where(eq(notebooks.id, notebookId))
      .returning();

    const res = toResponse(row);
    res.bannerUrl = await this.storageService.presignDownload(
      key,
      BANNER_PRESIGN_TTL,
    );
    return res;
  }
}
