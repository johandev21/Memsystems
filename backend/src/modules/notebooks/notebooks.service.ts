import { Inject, Injectable, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import {
  notebookFolders,
  notebooks,
  sourceFolders,
  sources,
  studyMaterialFolders,
  studyMaterials,
} from '../../database/schema';
import type { AgentAccessLevel, GroundingMode } from '../../database/schema';
import {
  AgentSettingsService,
  DEFAULT_AGENT_ACCESS_SETTINGS,
} from '../agent-access/agent-settings.service';
import { resolveAgentAccess } from './agent-access';
import { DEFAULT_GROUNDING_MODE, isGroundingMode } from './grounding-mode';
import {
  BadRequestError,
  NotFoundError,
} from '../../common/errors/domain-error';
import { DRIZZLE } from '../database/database.module';
import { JobQueueService } from '../jobs/job-queue.service';
import { StorageService } from '../storage/storage.service';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BANNER_BYTES = 2 * 1024 * 1024;
const BANNER_PRESIGN_TTL = 86400;

const BANNER_VARIANT_WIDTHS = [240, 480, 960, 1920] as const;
type BannerVariantWidth = (typeof BANNER_VARIANT_WIDTHS)[number];

export interface BannerVariantKeys {
  w240?: string;
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
  w240: string | null;
  w480: string | null;
  w960: string | null;
  w1920: string | null;
}

export interface CreateNotebookInput {
  title: string;
  description?: string;
  icon?: string;
  folderId?: string | null;
  groundingMode?: GroundingMode;
  agentAccess?: AgentAccessLevel | null;
}

export interface UpdateNotebookInput {
  title?: string;
  description?: string | null;
  icon?: string | null;
  folderId?: string | null;
  bannerFocalPoint?: { x: number; y: number } | null;
  groundingMode?: GroundingMode;
  agentAccess?: AgentAccessLevel | null;
}

export interface NotebookResponse {
  id: string;
  title: string;
  description: string;
  icon: string;
  folderId: string | null;
  banner: string | null;
  bannerUrl: string | null;
  bannerVariants: BannerVariantUrls | null;
  bannerFocalPoint: { x: number; y: number } | null;
  groundingMode: GroundingMode;
  /** Resolved access level: the Notebook override or the workspace default. */
  agentAccess: AgentAccessLevel;
  /** The Notebook-level override, or null when it inherits the default. */
  agentAccessOverride: AgentAccessLevel | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BannerUploadResponse {
  s3Key: string;
  uploadUrl: string;
  bannerUrl: string;
}

function toResponse(
  nb: typeof notebooks.$inferSelect,
  notebookDefault: AgentAccessLevel,
): NotebookResponse {
  const agentAccessOverride = nb.agentAccess ?? null;
  return {
    id: nb.id,
    title: nb.title,
    description: nb.description ?? '',
    icon: nb.icon ?? 'notebook',
    folderId: nb.folderId ?? null,
    banner: nb.banner,
    bannerUrl: null,
    bannerVariants: null,
    bannerFocalPoint: nb.bannerFocalPoint ?? null,
    groundingMode: isGroundingMode(nb.groundingMode)
      ? nb.groundingMode
      : DEFAULT_GROUNDING_MODE,
    agentAccess: resolveAgentAccess(agentAccessOverride, notebookDefault),
    agentAccessOverride,
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
  const [w240, w480, w960, w1920] = await Promise.all([
    presign(keys.w240),
    presign(keys.w480),
    presign(keys.w960),
    presign(keys.w1920),
  ]);
  if (!w240 && !w480 && !w960 && !w1920) return null;
  return { w240, w480, w960, w1920 };
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
    @Optional() private readonly jobQueue?: JobQueueService,
    @Optional() private readonly agentSettings?: AgentSettingsService,
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

  /**
   * Resolves the access level MCP tools must enforce for one Notebook.
   * A Notebook override wins; otherwise the workspace default applies.
   */
  async getAgentAccess(notebookId: string): Promise<AgentAccessLevel> {
    const [notebook] = await this.db
      .select({ agentAccess: notebooks.agentAccess })
      .from(notebooks)
      .where(and(eq(notebooks.id, notebookId), isNull(notebooks.deletedAt)))
      .limit(1);
    if (!notebook) {
      throw new NotFoundError('Notebook', {
        messageKey: 'errors.notebooks.notebook.notFound',
      });
    }
    return resolveAgentAccess(
      notebook.agentAccess,
      await this.getAgentAccessDefault(),
    );
  }

  async formatNotebook(
    nb: typeof notebooks.$inferSelect,
    notebookDefault?: AgentAccessLevel,
  ) {
    const resolvedDefault =
      notebookDefault ?? (await this.getAgentAccessDefault());
    const res = toResponse(nb, resolvedDefault);
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
    const notebookDefault = await this.getAgentAccessDefault();
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
        rows.map((row) => this.formatNotebook(row, notebookDefault)),
      );

      return { notebooks: notebooksRes, total };
    }

    const rows = await this.db
      .select()
      .from(notebooks)
      .where(isNull(notebooks.deletedAt))
      .orderBy(desc(notebooks.updatedAt));

    return Promise.all(
      rows.map((nb) => this.formatNotebook(nb, notebookDefault)),
    );
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
    const [row] = await this.db
      .insert(notebooks)
      .values({
        title: input.title,
        description: input.description?.trim().slice(0, 500) ?? '',
        icon: input.icon?.trim().slice(0, 50) ?? 'notebook',
        folderId,
        groundingMode: input.groundingMode ?? DEFAULT_GROUNDING_MODE,
        agentAccess: input.agentAccess ?? null,
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
    if (input.agentAccess !== undefined) {
      updates.agentAccess = input.agentAccess;
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
    const [row] = await this.db
      .select()
      .from(notebooks)
      .where(and(eq(notebooks.id, id), isNull(notebooks.deletedAt)));
    if (!row) {
      throw new NotFoundError('Notebook', {
        messageKey: 'errors.notebooks.notebook.notFound',
      });
    }

    const now = new Date();

    // Find sources to cancel their jobs
    const notebookSources = await this.db
      .select({ id: sources.id })
      .from(sources)
      .where(and(eq(sources.notebookId, id), isNull(sources.deletedAt)));

    if (this.jobQueue) {
      for (const s of notebookSources) {
        await this.jobQueue.cancelByGroup(`source:${s.id}`).catch(() => {});
        await this.jobQueue
          .cancelByGroup(`source:${s.id}:processing`)
          .catch(() => {});
      }
    }

    const doSoftDelete = async (executor: typeof this.db) => {
      // 1. Soft-delete study materials
      await executor
        .update(studyMaterials)
        .set({ deletedAt: now })
        .where(
          and(
            eq(studyMaterials.notebookId, id),
            isNull(studyMaterials.deletedAt),
          ),
        );

      // 2. Soft-delete study material folders
      await executor
        .update(studyMaterialFolders)
        .set({ deletedAt: now })
        .where(
          and(
            eq(studyMaterialFolders.notebookId, id),
            isNull(studyMaterialFolders.deletedAt),
          ),
        );

      // 3. Soft-delete sources
      await executor
        .update(sources)
        .set({ deletedAt: now })
        .where(and(eq(sources.notebookId, id), isNull(sources.deletedAt)));

      // 4. Soft-delete source folders
      await executor
        .update(sourceFolders)
        .set({ deletedAt: now })
        .where(
          and(
            eq(sourceFolders.notebookId, id),
            isNull(sourceFolders.deletedAt),
          ),
        );

      // 5. Soft-delete notebook itself
      await executor
        .update(notebooks)
        .set({ deletedAt: now })
        .where(eq(notebooks.id, id));
    };

    const maybeTx = (
      this.db as unknown as {
        transaction?: (
          cb: (tx: typeof this.db) => Promise<void>,
        ) => Promise<void>;
      }
    ).transaction;

    if (maybeTx) {
      await maybeTx.call(this.db, async (tx: typeof this.db) => {
        await doSoftDelete(tx);
      });
    } else {
      await doSoftDelete(this.db);
    }

    return toResponse(
      { ...row, deletedAt: now },
      await this.getAgentAccessDefault(),
    );
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

    const res = toResponse(row, await this.getAgentAccessDefault());
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

    const res = toResponse(row, await this.getAgentAccessDefault());
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

  private async getAgentAccessDefault(): Promise<AgentAccessLevel> {
    if (!this.agentSettings) {
      return DEFAULT_AGENT_ACCESS_SETTINGS.notebookDefault;
    }
    const settings = await this.agentSettings.get();
    return settings.notebookDefault;
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

  private staleVariantKeys(
    previous: BannerVariantKeys | null | undefined,
    next: BannerVariantKeys | null,
  ): BannerVariantKeys | null {
    if (!previous) return null;
    const nextValues = new Set(next ? Object.values(next) : []);
    const stale: BannerVariantKeys = {};
    if (previous.w240 && !nextValues.has(previous.w240))
      stale.w240 = previous.w240;
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
    const allKeys = [keys.w240, keys.w480, keys.w960, keys.w1920].filter(
      (key): key is string => Boolean(key),
    );
    await Promise.all(
      allKeys.map((key) =>
        this.storageService.deleteObject(key).catch(() => {}),
      ),
    );
  }
}
