import { Inject, Injectable, Optional } from '@nestjs/common';
import { and, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { notebookFolders, notebooks } from '../../database/schema';
import type { GroundingMode } from '../../database/schema';
import { DEFAULT_GROUNDING_MODE, isGroundingMode } from './grounding-mode';
import { NotFoundError } from '../../common/errors/domain-error';
import { DRIZZLE } from '../database/database.module';
import { JobQueueService } from '../jobs/job-queue.service';
import { StorageService } from '../storage/storage.service';
import { PRESET_BANNER_IDS, PRESET_BANNER_PREFIX } from './preset-banners';
import {
  BannerVariantUpload,
  cleanupStaleBannerStorage,
  deleteNotebookBannerStorage,
  formatNotebookResponse,
  toNotebookResponse,
  uploadBannerWithVariants,
} from './banners/notebook-banners';
import { cascadeDeleteNotebook } from './notebook-deletion';

export type {
  BannerVariantWidth,
  BannerVariantKeys,
  BannerVariantUpload,
  BannerVariantUrls,
  BannerUploadResponse,
  NotebookResponse,
} from './banners/notebook-banners';

export interface CreateNotebookInput {
  title: string;
  description?: string;
  icon?: string;
  folderId?: string | null;
  groundingMode?: GroundingMode;
}

export interface UpdateNotebookInput {
  title?: string;
  description?: string | null;
  icon?: string | null;
  folderId?: string | null;
  bannerFocalPoint?: { x: number; y: number } | null;
  groundingMode?: GroundingMode;
}

@Injectable()
export class NotebooksService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly storageService: StorageService,
    @Optional() private readonly jobQueue?: JobQueueService,
  ) {}

  async assertNotebookOwner(notebookId: string): Promise<void> {
    const [notebook] = await this.db
      .select({ id: notebooks.id })
      .from(notebooks)
      .where(and(eq(notebooks.id, notebookId), isNull(notebooks.deletedAt)))
      .limit(1);
    if (!notebook) {
      throw new NotFoundError('Notebook', {
        messageKey: 'errors.notebooks.notebook.notFound',
      });
    }
  }

  async getGroundingMode(notebookId: string): Promise<GroundingMode> {
    const [notebook] = await this.db
      .select({ groundingMode: notebooks.groundingMode })
      .from(notebooks)
      .where(and(eq(notebooks.id, notebookId), isNull(notebooks.deletedAt)))
      .limit(1);
    if (!notebook) {
      throw new NotFoundError('Notebook', {
        messageKey: 'errors.notebooks.notebook.notFound',
      });
    }
    return isGroundingMode(notebook.groundingMode)
      ? notebook.groundingMode
      : DEFAULT_GROUNDING_MODE;
  }

  async formatNotebook(nb: typeof notebooks.$inferSelect) {
    return formatNotebookResponse(this.storageService, nb);
  }

  async list(filter?: { limit?: number; offset?: number; search?: string }) {
    if (filter?.limit !== undefined || filter?.search !== undefined) {
      const conditions = [
        isNull(notebooks.deletedAt),
        ...(filter.search
          ? [
              or(
                ilike(notebooks.title, `%${filter.search}%`),
                ilike(notebooks.description, `%${filter.search}%`),
              )!,
            ]
          : []),
      ];
      const where = and(...conditions);
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
      .where(isNull(notebooks.deletedAt))
      .orderBy(desc(notebooks.updatedAt));

    return Promise.all(rows.map((nb) => this.formatNotebook(nb)));
  }

  async get(id: string) {
    const [row] = await this.db
      .select()
      .from(notebooks)
      .where(and(eq(notebooks.id, id), isNull(notebooks.deletedAt)));
    if (!row) {
      throw new NotFoundError('Notebook', {
        messageKey: 'errors.notebooks.notebook.notFound',
      });
    }
    return this.formatNotebook(row);
  }

  async create(input: CreateNotebookInput) {
    const folderId = input.folderId ?? null;
    if (folderId) {
      await this.assertFolderExists(folderId);
    }
    const [latestPresetNotebook] = await this.db
      .select({ banner: notebooks.banner })
      .from(notebooks)
      .where(
        inArray(
          notebooks.banner,
          PRESET_BANNER_IDS.map((id) => `${PRESET_BANNER_PREFIX}${id}`),
        ),
      )
      .orderBy(desc(notebooks.createdAt))
      .limit(1);
    const previousIndex = latestPresetNotebook
      ? PRESET_BANNER_IDS.findIndex(
          (id) =>
            `${PRESET_BANNER_PREFIX}${id}` === latestPresetNotebook.banner,
        )
      : -1;
    const bannerId =
      PRESET_BANNER_IDS[(previousIndex + 1) % PRESET_BANNER_IDS.length];
    const [row] = await this.db
      .insert(notebooks)
      .values({
        title: input.title,
        description: input.description?.trim().slice(0, 500) ?? '',
        icon: input.icon?.trim().slice(0, 50) ?? 'notebook',
        folderId,
        groundingMode: input.groundingMode ?? DEFAULT_GROUNDING_MODE,
        banner: `${PRESET_BANNER_PREFIX}${bannerId}`,
      })
      .returning();
    return this.formatNotebook(row);
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
    if (input.folderId !== undefined) {
      if (input.folderId) {
        await this.assertFolderExists(input.folderId);
      }
      updates.folderId = input.folderId;
    }
    if (input.bannerFocalPoint !== undefined) {
      updates.bannerFocalPoint = input.bannerFocalPoint;
    }
    if (input.groundingMode !== undefined) {
      updates.groundingMode = input.groundingMode;
    }
    if (Object.keys(updates).length === 0) {
      return this.get(id);
    }
    const [row] = await this.db
      .update(notebooks)
      .set(updates)
      .where(and(eq(notebooks.id, id), isNull(notebooks.deletedAt)))
      .returning();
    if (!row) {
      throw new NotFoundError('Notebook', {
        messageKey: 'errors.notebooks.notebook.notFound',
      });
    }
    return this.formatNotebook(row);
  }

  async delete(id: string) {
    const deletedRow = await cascadeDeleteNotebook(this.db, this.jobQueue, id);
    return toNotebookResponse(deletedRow);
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

    if (existing) {
      await deleteNotebookBannerStorage(
        this.storageService,
        existing.banner,
        existing.bannerVariants,
      );
    }

    const [row] = await this.db
      .update(notebooks)
      .set({ banner: null, bannerVariants: null, bannerFocalPoint: null })
      .where(eq(notebooks.id, notebookId))
      .returning();

    const res = toNotebookResponse(row);
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

    const { key, variantKeys } = await uploadBannerWithVariants(
      this.storageService,
      fileBuffer,
      fileName,
      fileType,
      variants,
    );

    const [existing] = await this.db
      .select({
        banner: notebooks.banner,
        bannerVariants: notebooks.bannerVariants,
      })
      .from(notebooks)
      .where(eq(notebooks.id, notebookId));

    await cleanupStaleBannerStorage(
      this.storageService,
      existing,
      key,
      variantKeys,
    );

    const [row] = await this.db
      .update(notebooks)
      .set({
        banner: key,
        bannerVariants: variantKeys,
        bannerFocalPoint: focalPoint ?? null,
      })
      .where(eq(notebooks.id, notebookId))
      .returning();

    return this.formatNotebook(row);
  }

  private async assertFolderExists(folderId: string): Promise<void> {
    const [folder] = await this.db
      .select({ id: notebookFolders.id })
      .from(notebookFolders)
      .where(
        and(
          eq(notebookFolders.id, folderId),
          isNull(notebookFolders.deletedAt),
        ),
      )
      .limit(1);
    if (!folder) {
      throw new NotFoundError('Folder', {
        messageKey: 'errors.library.folderNotFound',
      });
    }
  }
}
