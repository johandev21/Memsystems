import { Inject, Injectable, Optional } from '@nestjs/common';
import { eq, inArray, isNotNull } from 'drizzle-orm';
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
import { NotFoundError } from '../../common/errors/domain-error';
import { DRIZZLE } from '../database/database.module';
import { JobQueueService } from '../jobs/job-queue.service';
import { NotebookFolderService } from '../notebooks/notebook-folder.service';
import { SourceFolderService } from '../sources/folders/source-folder.service';
import { StorageService } from '../storage/storage.service';
import { StudyMaterialFolderService } from '../study-materials/study-material-folder.service';
import { StudyMaterialService } from '../study-materials/study-material.service';

export type TrashKind =
  | 'notebook_folder'
  | 'notebook'
  | 'source_folder'
  | 'source'
  | 'study_material_folder'
  | 'study_material';

export interface TrashItemDto {
  id: string;
  name: string;
  kind: TrashKind;
  subtypeLabel?: string;
  notebookId?: string;
  notebookTitle?: string;
  deletedAt: Date;
  daysRemaining: number;
}

export interface TrashListResponse {
  items: TrashItemDto[];
  nextCursor: string | null;
}

const RETENTION_DAYS = 30;

function calculateDaysRemaining(deletedAt: Date): number {
  const elapsedMs = Date.now() - deletedAt.getTime();
  const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
  return Math.max(1, RETENTION_DAYS - elapsedDays);
}

function mapSubtypeLabel(item: {
  kind: TrashKind;
  rawKind?: string;
  contentType?: string | null;
  modality?: string | null;
}): string {
  if (
    item.kind === 'notebook_folder' ||
    item.kind === 'source_folder' ||
    item.kind === 'study_material_folder'
  ) {
    return 'Folder';
  }
  if (item.kind === 'notebook') {
    return 'Notebook';
  }
  if (item.kind === 'study_material') {
    switch (item.rawKind) {
      case 'quiz':
        return 'Quiz';
      case 'simple_flashcard':
        return 'Flashcards';
      case 'mind_map':
        return 'Mind Map';
      case 'roadmap':
        return 'Roadmap';
      case 'study_guide':
        return 'Study Guide';
      case 'cheat_sheet':
        return 'Cheat Sheet';
      default:
        return 'Study Material';
    }
  }
  if (item.kind === 'source') {
    if (item.modality === 'video') return 'Video';
    if (item.modality === 'audio') return 'Audio';
    if (item.modality === 'slides') return 'Slides';
    if (item.modality === 'ebook') return 'Ebook';
    if (item.modality === 'image') return 'Image';
    if (item.modality === 'dataset') return 'Dataset';
    if (item.contentType?.includes('pdf')) return 'PDF';
    if (item.rawKind === 'url') return 'URL';
    if (item.rawKind === 'file') return 'File';
    return 'Text';
  }
  return 'Item';
}

@Injectable()
export class TrashLedgerService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly notebookFolderService: NotebookFolderService,
    private readonly sourceFolderService: SourceFolderService,
    private readonly studyMaterialFolderService: StudyMaterialFolderService,
    private readonly studyMaterialService: StudyMaterialService,
    private readonly storageService: StorageService,
    @Optional() private readonly jobQueue?: JobQueueService,
  ) {}

  async restore(
    kind: TrashKind,
    id: string,
  ): Promise<{ success: boolean; id: string; kind: TrashKind }> {
    switch (kind) {
      case 'notebook_folder': {
        await this.notebookFolderService.restore(id);
        return { success: true, id, kind };
      }
      case 'source_folder': {
        await this.sourceFolderService.restore(id);
        return { success: true, id, kind };
      }
      case 'study_material_folder': {
        await this.studyMaterialFolderService.restore(id);
        return { success: true, id, kind };
      }
      case 'study_material': {
        await this.studyMaterialService.restore(id);
        return { success: true, id, kind };
      }
      case 'source': {
        const [source] = await this.db
          .select({
            id: sources.id,
            folderId: sources.folderId,
            deletedAt: sources.deletedAt,
          })
          .from(sources)
          .where(eq(sources.id, id));
        if (!source) {
          throw new NotFoundError('Source', {
            messageKey: 'errors.sources.sourceNotFound',
          });
        }
        if (!source.deletedAt) {
          return { success: true, id, kind };
        }
        let targetFolderId = source.folderId;
        if (targetFolderId) {
          targetFolderId =
            await this.findAliveSourceFolderAncestor(targetFolderId);
        }
        await this.db
          .update(sources)
          .set({ deletedAt: null, folderId: targetFolderId })
          .where(eq(sources.id, id));
        return { success: true, id, kind };
      }
      case 'notebook': {
        const [nb] = await this.db
          .select({
            id: notebooks.id,
            folderId: notebooks.folderId,
            deletedAt: notebooks.deletedAt,
          })
          .from(notebooks)
          .where(eq(notebooks.id, id));
        if (!nb) {
          throw new NotFoundError('Notebook', {
            messageKey: 'errors.notebooks.notebook.notFound',
          });
        }
        if (!nb.deletedAt) {
          return { success: true, id, kind };
        }
        let targetFolderId = nb.folderId;
        if (targetFolderId) {
          targetFolderId =
            await this.findAliveNotebookFolderAncestor(targetFolderId);
        }

        const doRestore = async (executor: typeof this.db) => {
          // Restore notebook
          await executor
            .update(notebooks)
            .set({ deletedAt: null, folderId: targetFolderId })
            .where(eq(notebooks.id, id));
          // Restore child sources
          await executor
            .update(sources)
            .set({ deletedAt: null })
            .where(eq(sources.notebookId, id));
          // Restore child source folders
          await executor
            .update(sourceFolders)
            .set({ deletedAt: null })
            .where(eq(sourceFolders.notebookId, id));
          // Restore child study materials
          await executor
            .update(studyMaterials)
            .set({ deletedAt: null })
            .where(eq(studyMaterials.notebookId, id));
          // Restore child study material folders
          await executor
            .update(studyMaterialFolders)
            .set({ deletedAt: null })
            .where(eq(studyMaterialFolders.notebookId, id));
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
            await doRestore(tx);
          });
        } else {
          await doRestore(this.db);
        }
        return { success: true, id, kind };
      }
    }
  }

  async deleteForever(
    kind: TrashKind,
    id: string,
  ): Promise<{ success: boolean; id: string; kind: TrashKind }> {
    switch (kind) {
      case 'study_material': {
        const [sm] = await this.db
          .select({ id: studyMaterials.id })
          .from(studyMaterials)
          .where(eq(studyMaterials.id, id));
        if (!sm) {
          throw new NotFoundError('Study material', {
            messageKey: 'errors.studyMaterials.studyMaterialNotFound',
          });
        }
        await this.db.delete(studyMaterials).where(eq(studyMaterials.id, id));
        return { success: true, id, kind };
      }

      case 'study_material_folder': {
        const [folder] = await this.db
          .select({
            id: studyMaterialFolders.id,
            notebookId: studyMaterialFolders.notebookId,
          })
          .from(studyMaterialFolders)
          .where(eq(studyMaterialFolders.id, id));
        if (!folder) {
          throw new NotFoundError('Folder', {
            messageKey: 'errors.studyMaterials.folderNotFound',
          });
        }
        const descendantFolderIds =
          await this.getStudyMaterialDescendantFolderIds(folder);
        // Cascade delete all study materials in these folders, then the folders themselves
        await this.db
          .delete(studyMaterials)
          .where(inArray(studyMaterials.folderId, descendantFolderIds));
        await this.db
          .delete(studyMaterialFolders)
          .where(inArray(studyMaterialFolders.id, descendantFolderIds));
        return { success: true, id, kind };
      }

      case 'source': {
        const [source] = await this.db
          .select({ id: sources.id, s3Key: sources.s3Key })
          .from(sources)
          .where(eq(sources.id, id));
        if (!source) {
          throw new NotFoundError('Source', {
            messageKey: 'errors.sources.sourceNotFound',
          });
        }
        // Cancel jobs
        if (this.jobQueue) {
          await this.jobQueue.cancelByGroup(`source:${id}`).catch(() => {});
          await this.jobQueue
            .cancelByGroup(`source:${id}:processing`)
            .catch(() => {});
        }
        // Delete S3 artifact
        if (source.s3Key) {
          await this.storageService.deleteObject(source.s3Key).catch(() => {});
        }
        // Delete row
        await this.db.delete(sources).where(eq(sources.id, id));
        return { success: true, id, kind };
      }

      case 'source_folder': {
        const [folder] = await this.db
          .select({
            id: sourceFolders.id,
            notebookId: sourceFolders.notebookId,
          })
          .from(sourceFolders)
          .where(eq(sourceFolders.id, id));
        if (!folder) {
          throw new NotFoundError('Folder', {
            messageKey: 'errors.sources.folder.notFound',
          });
        }
        const descendantFolderIds =
          await this.getSourceFolderDescendantFolderIds(folder);
        const folderSources = await this.db
          .select({ id: sources.id, s3Key: sources.s3Key })
          .from(sources)
          .where(inArray(sources.folderId, descendantFolderIds));

        for (const s of folderSources) {
          if (this.jobQueue) {
            await this.jobQueue.cancelByGroup(`source:${s.id}`).catch(() => {});
            await this.jobQueue
              .cancelByGroup(`source:${s.id}:processing`)
              .catch(() => {});
          }
          if (s.s3Key) {
            await this.storageService.deleteObject(s.s3Key).catch(() => {});
          }
        }

        await this.db.delete(sources).where(
          inArray(
            sources.id,
            folderSources.map((s) => s.id),
          ),
        );
        await this.db
          .delete(sourceFolders)
          .where(inArray(sourceFolders.id, descendantFolderIds));
        return { success: true, id, kind };
      }

      case 'notebook': {
        const [nb] = await this.db
          .select({
            id: notebooks.id,
            banner: notebooks.banner,
            bannerVariants: notebooks.bannerVariants,
          })
          .from(notebooks)
          .where(eq(notebooks.id, id));
        if (!nb) {
          throw new NotFoundError('Notebook', {
            messageKey: 'errors.notebooks.notebook.notFound',
          });
        }
        // Delete banner objects
        const bannerKeys = [
          nb.banner,
          nb.bannerVariants?.w240,
          nb.bannerVariants?.w480,
          nb.bannerVariants?.w960,
          nb.bannerVariants?.w1920,
        ].filter((key): key is string => Boolean(key));
        await Promise.all(
          bannerKeys.map((key) =>
            this.storageService.deleteObject(key).catch(() => {}),
          ),
        );

        // Delete all notebook sources & cancel jobs
        const nbSources = await this.db
          .select({ id: sources.id, s3Key: sources.s3Key })
          .from(sources)
          .where(eq(sources.notebookId, id));

        for (const s of nbSources) {
          if (this.jobQueue) {
            await this.jobQueue.cancelByGroup(`source:${s.id}`).catch(() => {});
            await this.jobQueue
              .cancelByGroup(`source:${s.id}:processing`)
              .catch(() => {});
          }
          if (s.s3Key) {
            await this.storageService.deleteObject(s.s3Key).catch(() => {});
          }
        }

        // Delete notebook (PostgreSQL cascades to child tables)
        await this.db.delete(notebooks).where(eq(notebooks.id, id));
        return { success: true, id, kind };
      }

      case 'notebook_folder': {
        const [folder] = await this.db
          .select({ id: notebookFolders.id })
          .from(notebookFolders)
          .where(eq(notebookFolders.id, id));
        if (!folder) {
          throw new NotFoundError('Folder', {
            messageKey: 'errors.library.folderNotFound',
          });
        }
        const descendantFolderIds =
          await this.getNotebookFolderDescendantFolderIds(id);
        const folderNotebooks = await this.db
          .select({
            id: notebooks.id,
            banner: notebooks.banner,
            bannerVariants: notebooks.bannerVariants,
          })
          .from(notebooks)
          .where(inArray(notebooks.folderId, descendantFolderIds));

        for (const nb of folderNotebooks) {
          const bannerKeys = [
            nb.banner,
            nb.bannerVariants?.w240,
            nb.bannerVariants?.w480,
            nb.bannerVariants?.w960,
            nb.bannerVariants?.w1920,
          ].filter((key): key is string => Boolean(key));
          await Promise.all(
            bannerKeys.map((key) =>
              this.storageService.deleteObject(key).catch(() => {}),
            ),
          );

          const nbSources = await this.db
            .select({ id: sources.id, s3Key: sources.s3Key })
            .from(sources)
            .where(eq(sources.notebookId, nb.id));

          for (const s of nbSources) {
            if (this.jobQueue) {
              await this.jobQueue
                .cancelByGroup(`source:${s.id}`)
                .catch(() => {});
              await this.jobQueue
                .cancelByGroup(`source:${s.id}:processing`)
                .catch(() => {});
            }
            if (s.s3Key) {
              await this.storageService.deleteObject(s.s3Key).catch(() => {});
            }
          }
        }

        // Deleting notebook folders will set null on notebooks due to onDelete: 'set null',
        // but we want to permanently delete both the folders and the notebooks inside them!
        if (folderNotebooks.length > 0) {
          await this.db.delete(notebooks).where(
            inArray(
              notebooks.id,
              folderNotebooks.map((nb) => nb.id),
            ),
          );
        }
        await this.db
          .delete(notebookFolders)
          .where(inArray(notebookFolders.id, descendantFolderIds));
        return { success: true, id, kind };
      }
    }
  }

  async emptyTrash(): Promise<{ success: boolean; purged: boolean }> {
    // 1. Purge S3 objects for all soft-deleted sources
    const deletedSources = await this.db
      .select({ id: sources.id, s3Key: sources.s3Key })
      .from(sources)
      .where(isNotNull(sources.deletedAt));

    for (const s of deletedSources) {
      if (this.jobQueue) {
        await this.jobQueue.cancelByGroup(`source:${s.id}`).catch(() => {});
        await this.jobQueue
          .cancelByGroup(`source:${s.id}:processing`)
          .catch(() => {});
      }
      if (s.s3Key) {
        await this.storageService.deleteObject(s.s3Key).catch(() => {});
      }
    }

    // 2. Purge S3 objects for all soft-deleted notebooks
    const deletedNotebooks = await this.db
      .select({
        id: notebooks.id,
        banner: notebooks.banner,
        bannerVariants: notebooks.bannerVariants,
      })
      .from(notebooks)
      .where(isNotNull(notebooks.deletedAt));

    const bannerKeys = deletedNotebooks.flatMap((nb) => [
      nb.banner,
      nb.bannerVariants?.w240,
      nb.bannerVariants?.w480,
      nb.bannerVariants?.w960,
      nb.bannerVariants?.w1920,
    ]);
    await Promise.all(
      bannerKeys
        .filter((key): key is string => Boolean(key))
        .map((key) => this.storageService.deleteObject(key).catch(() => {})),
    );

    // 3. Delete DB rows in safe cascade order
    if (deletedSources.length > 0) {
      await this.db.delete(sources).where(
        inArray(
          sources.id,
          deletedSources.map((s) => s.id),
        ),
      );
    }

    if (deletedNotebooks.length > 0) {
      await this.db.delete(notebooks).where(
        inArray(
          notebooks.id,
          deletedNotebooks.map((nb) => nb.id),
        ),
      );
    }

    await this.db
      .delete(studyMaterials)
      .where(isNotNull(studyMaterials.deletedAt));
    await this.db
      .delete(studyMaterialFolders)
      .where(isNotNull(studyMaterialFolders.deletedAt));
    await this.db
      .delete(sourceFolders)
      .where(isNotNull(sourceFolders.deletedAt));
    await this.db
      .delete(notebookFolders)
      .where(isNotNull(notebookFolders.deletedAt));

    return { success: true, purged: true };
  }

  private async findAliveNotebookFolderAncestor(
    folderId: string,
  ): Promise<string | null> {
    let currentId: string | null = folderId;
    while (currentId) {
      const [folder] = await this.db
        .select({
          id: notebookFolders.id,
          parentId: notebookFolders.parentId,
          deletedAt: notebookFolders.deletedAt,
        })
        .from(notebookFolders)
        .where(eq(notebookFolders.id, currentId));
      if (!folder) return null;
      if (!folder.deletedAt) return folder.id;
      currentId = folder.parentId;
    }
    return null;
  }

  private async findAliveSourceFolderAncestor(
    folderId: string,
  ): Promise<string | null> {
    let currentId: string | null = folderId;
    while (currentId) {
      const [folder] = await this.db
        .select({
          id: sourceFolders.id,
          parentId: sourceFolders.parentId,
          deletedAt: sourceFolders.deletedAt,
        })
        .from(sourceFolders)
        .where(eq(sourceFolders.id, currentId));
      if (!folder) return null;
      if (!folder.deletedAt) return folder.id;
      currentId = folder.parentId;
    }
    return null;
  }

  private async getNotebookFolderDescendantFolderIds(
    folderId: string,
  ): Promise<string[]> {
    const allFolders = await this.db
      .select({
        id: notebookFolders.id,
        parentId: notebookFolders.parentId,
      })
      .from(notebookFolders);

    const childMap = new Map<string, string[]>();
    for (const f of allFolders) {
      if (f.parentId) {
        const arr = childMap.get(f.parentId) ?? [];
        arr.push(f.id);
        childMap.set(f.parentId, arr);
      }
    }
    const ids: string[] = [folderId];
    const stack = [folderId];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      for (const child of childMap.get(cur) ?? []) {
        ids.push(child);
        stack.push(child);
      }
    }
    return ids;
  }

  private async getSourceFolderDescendantFolderIds(folder: {
    id: string;
    notebookId: string;
  }): Promise<string[]> {
    const allFolders = await this.db
      .select({
        id: sourceFolders.id,
        parentId: sourceFolders.parentId,
      })
      .from(sourceFolders)
      .where(eq(sourceFolders.notebookId, folder.notebookId));

    const childMap = new Map<string, string[]>();
    for (const f of allFolders) {
      if (f.parentId) {
        const arr = childMap.get(f.parentId) ?? [];
        arr.push(f.id);
        childMap.set(f.parentId, arr);
      }
    }
    const ids: string[] = [folder.id];
    const stack = [folder.id];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      for (const child of childMap.get(cur) ?? []) {
        ids.push(child);
        stack.push(child);
      }
    }
    return ids;
  }

  private async getStudyMaterialDescendantFolderIds(folder: {
    id: string;
    notebookId: string;
  }): Promise<string[]> {
    const allFolders = await this.db
      .select({
        id: studyMaterialFolders.id,
        parentId: studyMaterialFolders.parentId,
      })
      .from(studyMaterialFolders)
      .where(eq(studyMaterialFolders.notebookId, folder.notebookId));

    const childMap = new Map<string, string[]>();
    for (const f of allFolders) {
      if (f.parentId) {
        const arr = childMap.get(f.parentId) ?? [];
        arr.push(f.id);
        childMap.set(f.parentId, arr);
      }
    }
    const ids: string[] = [folder.id];
    const stack = [folder.id];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      for (const child of childMap.get(cur) ?? []) {
        ids.push(child);
        stack.push(child);
      }
    }
    return ids;
  }

  async list(cursor?: string, limit = 30): Promise<TrashListResponse> {
    // 1. Fetch deleted notebook_folders whose parent is not deleted
    // To ensure it's a top-level root in trash:
    // Either parent_id is null OR parent notebook_folder is NOT deleted
    const deletedNotebookFolders = await this.db
      .select({
        id: notebookFolders.id,
        name: notebookFolders.name,
        parentId: notebookFolders.parentId,
        deletedAt: notebookFolders.deletedAt,
      })
      .from(notebookFolders)
      .where(isNotNull(notebookFolders.deletedAt));

    const deletedNbFolderIds = new Set(deletedNotebookFolders.map((f) => f.id));
    const rootDeletedNbFolders: TrashItemDto[] = deletedNotebookFolders
      .filter((f) => !f.parentId || !deletedNbFolderIds.has(f.parentId))
      .map((f) => ({
        id: f.id,
        name: f.name,
        kind: 'notebook_folder' as const,
        subtypeLabel: 'Folder',
        deletedAt: f.deletedAt!,
        daysRemaining: calculateDaysRemaining(f.deletedAt!),
      }));

    // 2. Fetch deleted notebooks whose parent notebook_folder (if any) is NOT deleted
    const deletedNotebooks = await this.db
      .select({
        id: notebooks.id,
        title: notebooks.title,
        folderId: notebooks.folderId,
        deletedAt: notebooks.deletedAt,
      })
      .from(notebooks)
      .where(isNotNull(notebooks.deletedAt));

    const rootDeletedNotebooks: TrashItemDto[] = deletedNotebooks
      .filter((nb) => !nb.folderId || !deletedNbFolderIds.has(nb.folderId))
      .map((nb) => ({
        id: nb.id,
        name: nb.title,
        kind: 'notebook' as const,
        subtypeLabel: 'Notebook',
        deletedAt: nb.deletedAt!,
        daysRemaining: calculateDaysRemaining(nb.deletedAt!),
      }));

    const deletedNotebookIds = new Set(deletedNotebooks.map((nb) => nb.id));

    // Helper map of all notebook titles (including alive ones for notebookTitle context)
    const allNotebooks = await this.db
      .select({ id: notebooks.id, title: notebooks.title })
      .from(notebooks);
    const notebookTitleMap = new Map(
      allNotebooks.map((nb) => [nb.id, nb.title]),
    );

    // 3. Fetch deleted source_folders
    // Root in trash if:
    // - parent notebook is NOT deleted (not in deletedNotebookIds)
    // - AND (parentId is null OR parent source_folder is NOT deleted)
    const deletedSourceFolders = await this.db
      .select({
        id: sourceFolders.id,
        name: sourceFolders.name,
        notebookId: sourceFolders.notebookId,
        parentId: sourceFolders.parentId,
        deletedAt: sourceFolders.deletedAt,
      })
      .from(sourceFolders)
      .where(isNotNull(sourceFolders.deletedAt));

    const deletedSrcFolderIds = new Set(deletedSourceFolders.map((f) => f.id));
    const rootDeletedSourceFolders: TrashItemDto[] = deletedSourceFolders
      .filter(
        (f) =>
          !deletedNotebookIds.has(f.notebookId) &&
          (!f.parentId || !deletedSrcFolderIds.has(f.parentId)),
      )
      .map((f) => ({
        id: f.id,
        name: f.name,
        kind: 'source_folder' as const,
        subtypeLabel: 'Folder',
        notebookId: f.notebookId,
        notebookTitle: notebookTitleMap.get(f.notebookId),
        deletedAt: f.deletedAt!,
        daysRemaining: calculateDaysRemaining(f.deletedAt!),
      }));

    // 4. Fetch deleted sources
    // Root in trash if:
    // - parent notebook is NOT deleted
    // - AND (folderId is null OR parent source_folder is NOT deleted)
    const deletedSources = await this.db
      .select({
        id: sources.id,
        title: sources.title,
        kind: sources.kind,
        contentType: sources.contentType,
        modality: sources.modality,
        notebookId: sources.notebookId,
        folderId: sources.folderId,
        deletedAt: sources.deletedAt,
      })
      .from(sources)
      .where(isNotNull(sources.deletedAt));

    const rootDeletedSources: TrashItemDto[] = deletedSources
      .filter(
        (s) =>
          !deletedNotebookIds.has(s.notebookId) &&
          (!s.folderId || !deletedSrcFolderIds.has(s.folderId)),
      )
      .map((s) => ({
        id: s.id,
        name: s.title,
        kind: 'source' as const,
        subtypeLabel: mapSubtypeLabel({
          kind: 'source',
          rawKind: s.kind,
          contentType: s.contentType,
          modality: s.modality,
        }),
        notebookId: s.notebookId,
        notebookTitle: notebookTitleMap.get(s.notebookId),
        deletedAt: s.deletedAt!,
        daysRemaining: calculateDaysRemaining(s.deletedAt!),
      }));

    // 5. Fetch deleted study_material_folders
    // Root in trash if:
    // - parent notebook is NOT deleted
    // - AND (parentId is null OR parent study_material_folder is NOT deleted)
    const deletedSmFolders = await this.db
      .select({
        id: studyMaterialFolders.id,
        name: studyMaterialFolders.name,
        notebookId: studyMaterialFolders.notebookId,
        parentId: studyMaterialFolders.parentId,
        deletedAt: studyMaterialFolders.deletedAt,
      })
      .from(studyMaterialFolders)
      .where(isNotNull(studyMaterialFolders.deletedAt));

    const deletedSmFolderIds = new Set(deletedSmFolders.map((f) => f.id));
    const rootDeletedSmFolders: TrashItemDto[] = deletedSmFolders
      .filter(
        (f) =>
          !deletedNotebookIds.has(f.notebookId) &&
          (!f.parentId || !deletedSmFolderIds.has(f.parentId)),
      )
      .map((f) => ({
        id: f.id,
        name: f.name,
        kind: 'study_material_folder' as const,
        subtypeLabel: 'Folder',
        notebookId: f.notebookId,
        notebookTitle: notebookTitleMap.get(f.notebookId),
        deletedAt: f.deletedAt!,
        daysRemaining: calculateDaysRemaining(f.deletedAt!),
      }));

    // 6. Fetch deleted study_materials
    // Root in trash if:
    // - parent notebook is NOT deleted
    // - AND (folderId is null OR parent study_material_folder is NOT deleted)
    const deletedStudyMaterials = await this.db
      .select({
        id: studyMaterials.id,
        title: studyMaterials.title,
        kind: studyMaterials.kind,
        notebookId: studyMaterials.notebookId,
        folderId: studyMaterials.folderId,
        deletedAt: studyMaterials.deletedAt,
      })
      .from(studyMaterials)
      .where(isNotNull(studyMaterials.deletedAt));

    const rootDeletedStudyMaterials: TrashItemDto[] = deletedStudyMaterials
      .filter(
        (sm) =>
          !deletedNotebookIds.has(sm.notebookId) &&
          (!sm.folderId || !deletedSmFolderIds.has(sm.folderId)),
      )
      .map((sm) => ({
        id: sm.id,
        name: sm.title,
        kind: 'study_material' as const,
        subtypeLabel: mapSubtypeLabel({
          kind: 'study_material',
          rawKind: sm.kind,
        }),
        notebookId: sm.notebookId,
        notebookTitle: notebookTitleMap.get(sm.notebookId),
        deletedAt: sm.deletedAt!,
        daysRemaining: calculateDaysRemaining(sm.deletedAt!),
      }));

    // Combine all top-level roots
    const allRoots: TrashItemDto[] = [
      ...rootDeletedNbFolders,
      ...rootDeletedNotebooks,
      ...rootDeletedSourceFolders,
      ...rootDeletedSources,
      ...rootDeletedSmFolders,
      ...rootDeletedStudyMaterials,
    ];

    // Sort descending by deletedAt, secondary tiebreaker id
    allRoots.sort((a, b) => {
      const diff = b.deletedAt.getTime() - a.deletedAt.getTime();
      if (diff !== 0) return diff;
      return a.id.localeCompare(b.id);
    });

    // Pagination using cursor format: `${timestamp}_${id}`
    let startIndex = 0;
    if (cursor) {
      const idx = allRoots.findIndex(
        (item) => `${item.deletedAt.getTime()}_${item.id}` === cursor,
      );
      if (idx !== -1) {
        startIndex = idx + 1;
      }
    }

    const pageItems = allRoots.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < allRoots.length;
    const lastItem = pageItems[pageItems.length - 1];
    const nextCursor =
      hasMore && lastItem
        ? `${lastItem.deletedAt.getTime()}_${lastItem.id}`
        : null;

    return {
      items: pageItems,
      nextCursor,
    };
  }
}
