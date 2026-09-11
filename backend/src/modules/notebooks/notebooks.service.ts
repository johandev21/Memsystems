import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { notebooks } from '../../database/schema';
import {
  BadRequestError,
  NotFoundError,
} from '../../common/errors/domain-error';
import { DRIZZLE } from '../database/database.module';
import { StorageService } from '../storage/storage.service';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BANNER_BYTES = 2 * 1024 * 1024;
const BANNER_PRESIGN_TTL = 86400;

const BANNER_VARIANT_WIDTHS = [480, 960, 1920] as const;
type BannerVariantWidth = (typeof BANNER_VARIANT_WIDTHS)[number];

export interface BannerVariantKeys {
  w480?: string;
  w960?: string;
  w1920?: string;
}

export interface BannerVariantUpload {
  width: BannerVariantWidth;
  buffer: Buffer;
  contentType: string;
}

export interface BannerVariantUrls {
  w480: string | null;
  w960: string | null;
  w1920: string | null;
}

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
  title: string;
  description: string;
  icon: string;
  banner: string | null;
  bannerUrl: string | null;
  bannerVariants: BannerVariantUrls | null;
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
    title: nb.title,
    description: nb.description ?? '',
    icon: nb.icon ?? 'notebook',
    banner: nb.banner,
    bannerUrl: null,
    bannerVariants: null,
    bannerFocalPoint: nb.bannerFocalPoint ?? null,
    createdAt: nb.createdAt,
    updatedAt: nb.updatedAt,
  };
}

async function presignBannerVariants(
  storageService: StorageService,
  keys: BannerVariantKeys | null | undefined,
): Promise<BannerVariantUrls | null> {
  if (!keys) return null;
  const presign = (key?: string) =>
    key ? storageService.presignDownload(key, BANNER_PRESIGN_TTL) : null;
  const [w480, w960, w1920] = await Promise.all([
    presign(keys.w480),
    presign(keys.w960),
    presign(keys.w1920),
  ]);
  if (!w480 && !w960 && !w1920) return null;
  return { w480, w960, w1920 };
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

  /**
   * Single-user mode: notebooks have no owner. This only asserts existence.
   * Kept under the historical name so existing call sites read naturally.
   */
  async assertNotebookOwner(notebookId: string): Promise<void> {
    const [notebook] = await this.db
      .select({ id: notebooks.id })
      .from(notebooks)
      .where(eq(notebooks.id, notebookId))
      .limit(1);
    if (!notebook) {
      throw new NotFoundError('Notebook', {
        messageKey: 'errors.notebooks.notebook.notFound',
      });
    }
  }

  async formatNotebook(nb: typeof notebooks.$inferSelect) {
    const res = toResponse(nb);
    res.bannerUrl = nb.banner
      ? await this.storageService.presignDownload(nb.banner, BANNER_PRESIGN_TTL)
      : null;
    res.bannerVariants = await presignBannerVariants(
      this.storageService,
      nb.bannerVariants,
    );
    return res;
  }

  async list(filter?: { limit?: number; offset?: number; search?: string }) {
    if (filter?.limit !== undefined || filter?.search !== undefined) {
      const conditions = [
        ...(filter.search
          ? [
              or(
                ilike(notebooks.title, `%${filter.search}%`),
                ilike(notebooks.description, `%${filter.search}%`),
              )!,
            ]
          : []),
      ];
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const [{ count }] = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(notebooks)
        .where(where);
      const total = Number(count);

      const rows = await this.db
        .select()
        .from(notebooks)
        .where(where)
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
      .orderBy(desc(notebooks.updatedAt));

    return Promise.all(rows.map((nb) => this.formatNotebook(nb)));
  }

  async get(id: string) {
    const [row] = await this.db
      .select()
      .from(notebooks)
      .where(eq(notebooks.id, id));
    if (!row) {
      throw new NotFoundError('Notebook', {
        messageKey: 'errors.notebooks.notebook.notFound',
      });
    }
    return this.formatNotebook(row);
  }

  async create(input: CreateNotebookInput) {
    const [row] = await this.db
      .insert(notebooks)
      .values({
        title: input.title,
        description: input.description?.trim().slice(0, 500) ?? '',
        icon: input.icon?.trim().slice(0, 50) ?? 'notebook',
      })
      .returning();
    return toResponse(row);
  }

  async update(id: string, input: UpdateNotebookInput) {
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
      return this.get(id);
    }
    const [row] = await this.db
      .update(notebooks)
      .set(updates)
      .where(eq(notebooks.id, id))
      .returning();
    if (!row) {
      throw new NotFoundError('Notebook', {
        messageKey: 'errors.notebooks.notebook.notFound',
      });
    }
    const res = toResponse(row);
    res.bannerUrl = row.banner
      ? await this.storageService.presignDownload(
          row.banner,
          BANNER_PRESIGN_TTL,
        )
      : null;
    res.bannerVariants = await presignBannerVariants(
      this.storageService,
      row.bannerVariants,
    );
    return res;
  }

  async delete(id: string) {
    const [row] = await this.db
      .select()
      .from(notebooks)
      .where(eq(notebooks.id, id));
    if (!row) {
      throw new NotFoundError('Notebook', {
        messageKey: 'errors.notebooks.notebook.notFound',
      });
    }
    if (row.banner) {
      await this.storageService.deleteObject(row.banner).catch(() => {});
    }
    await this.deleteBannerVariantObjects(row.bannerVariants);
    await this.db.delete(notebooks).where(eq(notebooks.id, id));
    return toResponse(row);
  }

  async removeBanner(notebookId: string) {
    await this.assertNotebookOwner(notebookId);

    const [existing] = await this.db
      .select({
        banner: notebooks.banner,
        bannerVariants: notebooks.bannerVariants,
      })
      .from(notebooks)
      .where(eq(notebooks.id, notebookId));

    if (existing?.banner) {
      await this.storageService.deleteObject(existing.banner).catch(() => {});
    }
    if (existing) {
      await this.deleteBannerVariantObjects(existing.bannerVariants);
    }

    const [row] = await this.db
      .update(notebooks)
      .set({ banner: null, bannerVariants: null, bannerFocalPoint: null })
      .where(eq(notebooks.id, notebookId))
      .returning();

    const res = toResponse(row);
    res.bannerUrl = null;
    return res;
  }

  async uploadBanner(
    notebookId: string,
    fileBuffer: Buffer,
    fileName: string,
    fileType: string,
    focalPoint?: { x: number; y: number },
    variants: BannerVariantUpload[] = [],
  ) {
    await this.assertNotebookOwner(notebookId);

    if (fileBuffer.length === 0) {
      throw new BadRequestError('Uploaded file is empty', {
        messageKey: 'errors.notebooks.banner.fileEmpty',
      });
    }
    if (fileBuffer.length > MAX_BANNER_BYTES) {
      throw new BadRequestError('Banner image exceeds maximum size of 2 MB', {
        messageKey: 'errors.notebooks.banner.tooLarge',
      });
    }
    if (!ACCEPTED_IMAGE_TYPES.includes(fileType)) {
      throw new BadRequestError(
        `Unsupported file type: ${fileType || 'unknown'}. Accepted: JPEG, PNG, WebP`,
        {
          messageKey: 'errors.notebooks.banner.unsupportedType',
          params: { fileType: fileType || 'unknown' },
        },
      );
    }

    const sha256 = createHash('sha256').update(fileBuffer).digest('hex');
    const ext = pickExtension(fileName);
    const key = `banners/${sha256}${ext}`;

    // Variants are generated by the client from the same source image, so they
    // share the original's hash. Invalid variant parts are skipped: they are a
    // best-effort optimization, never a reason to reject the upload.
    const validVariants = variants.filter(
      (variant) =>
        BANNER_VARIANT_WIDTHS.includes(variant.width) &&
        variant.buffer.length > 0 &&
        variant.buffer.length <= MAX_BANNER_BYTES &&
        variant.contentType === 'image/webp',
    );
    const variantKeys: BannerVariantKeys | null = validVariants.length
      ? Object.fromEntries(
          validVariants.map((variant) => [
            `w${variant.width}`,
            `banners/${sha256}-${variant.width}w.webp`,
          ]),
        )
      : null;
    await this.storageService.putObject({
      key,
      body: fileBuffer,
      contentType: fileType,
    });
    await Promise.all(
      validVariants.map((variant) =>
        this.storageService.putObject({
          key: `banners/${sha256}-${variant.width}w.webp`,
          body: variant.buffer,
          contentType: variant.contentType,
        }),
      ),
    );

    const [existing] = await this.db
      .select({
        banner: notebooks.banner,
        bannerVariants: notebooks.bannerVariants,
      })
      .from(notebooks)
      .where(eq(notebooks.id, notebookId));

    if (existing?.banner && existing.banner !== key) {
      await this.storageService.deleteObject(existing.banner).catch(() => {});
    }
    if (existing) {
      const staleVariantKeys = this.staleVariantKeys(
        existing.bannerVariants,
        variantKeys,
      );
      await this.deleteBannerVariantObjects(staleVariantKeys);
    }

    const [row] = await this.db
      .update(notebooks)
      .set({
        banner: key,
        bannerVariants: variantKeys,
        bannerFocalPoint: focalPoint ?? null,
      })
      .where(eq(notebooks.id, notebookId))
      .returning();

    const res = toResponse(row);
    res.bannerUrl = await this.storageService.presignDownload(
      key,
      BANNER_PRESIGN_TTL,
    );
    res.bannerVariants = await presignBannerVariants(
      this.storageService,
      variantKeys,
    );
    return res;
  }

  private staleVariantKeys(
    previous: BannerVariantKeys | null | undefined,
    next: BannerVariantKeys | null,
  ): BannerVariantKeys | null {
    if (!previous) return null;
    const nextValues = new Set(next ? Object.values(next) : []);
    const stale: BannerVariantKeys = {};
    if (previous.w480 && !nextValues.has(previous.w480))
      stale.w480 = previous.w480;
    if (previous.w960 && !nextValues.has(previous.w960))
      stale.w960 = previous.w960;
    if (previous.w1920 && !nextValues.has(previous.w1920)) {
      stale.w1920 = previous.w1920;
    }
    return Object.keys(stale).length > 0 ? stale : null;
  }

  private async deleteBannerVariantObjects(
    keys: BannerVariantKeys | null | undefined,
  ): Promise<void> {
    if (!keys) return;
    const allKeys = [keys.w480, keys.w960, keys.w1920].filter(
      (key): key is string => Boolean(key),
    );
    await Promise.all(
      allKeys.map((key) =>
        this.storageService.deleteObject(key).catch(() => {}),
      ),
    );
  }
}
