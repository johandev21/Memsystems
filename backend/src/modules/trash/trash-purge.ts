import { eq, inArray, isNotNull, lt } from 'drizzle-orm';
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
import { JobQueueService } from '../jobs/job-queue.service';
import { StorageService } from '../storage/storage.service';
import { RETENTION_DAYS, TrashKind } from './trash-listing';

async function cleanupSources(
  sourcesList: { id: string; s3Key: string | null }[],
  storageService: StorageService,
  jobQueue?: JobQueueService,
): Promise<void> {
  for (const s of sourcesList) {
    if (jobQueue) {
      await jobQueue.cancelByGroup(`source:${s.id}`).catch(() => {});
      await jobQueue.cancelByGroup(`source:${s.id}:processing`).catch(() => {});
    }
    if (s.s3Key) {
      await storageService.deleteObject(s.s3Key).catch(() => {});
    }
  }
}

async function cleanupNotebookBanners(
  bannersList: {
    banner: string | null;
    bannerVariants?: {
      w240?: string;
      w480?: string;
      w960?: string;
      w1920?: string;
    } | null;
  }[],
  storageService: StorageService,
): Promise<void> {
  const bannerKeys = bannersList.flatMap((nb) => [
    nb.banner,
    nb.bannerVariants?.w240,
    nb.bannerVariants?.w480,
    nb.bannerVariants?.w960,
    nb.bannerVariants?.w1920,
  ]);
  await Promise.all(
    bannerKeys
      .filter((key): key is string => Boolean(key))
      .map((key) => storageService.deleteObject(key).catch(() => {})),
  );
}

export async function getNotebookFolderDescendantFolderIds(
  db: NodePgDatabase<typeof appSchema>,
  folderId: string,
): Promise<string[]> {
  const allFolders = await db
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

export async function getSourceFolderDescendantFolderIds(
  db: NodePgDatabase<typeof appSchema>,
  folder: {
    id: string;
    notebookId: string;
  },
): Promise<string[]> {
  const allFolders = await db
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

export async function getStudyMaterialDescendantFolderIds(
  db: NodePgDatabase<typeof appSchema>,
  folder: {
    id: string;
    notebookId: string;
  },
): Promise<string[]> {
  const allFolders = await db
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

export async function permanentDeleteTrashItem(
  db: NodePgDatabase<typeof appSchema>,
  storageService: StorageService,
  jobQueue: JobQueueService | undefined,
  kind: TrashKind,
  id: string,
): Promise<{ success: boolean; id: string; kind: TrashKind }> {
  switch (kind) {
    case 'study_material': {
      const [sm] = await db
        .select({ id: studyMaterials.id })
        .from(studyMaterials)
        .where(eq(studyMaterials.id, id));
      if (!sm) {
        throw new NotFoundError('Study material', {
          messageKey: 'errors.studyMaterials.studyMaterialNotFound',
        });
      }
      await db.delete(studyMaterials).where(eq(studyMaterials.id, id));
      return { success: true, id, kind };
    }

    case 'study_material_folder': {
      const [folder] = await db
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
      const descendantFolderIds = await getStudyMaterialDescendantFolderIds(
        db,
        folder,
      );
      await db
        .delete(studyMaterials)
        .where(inArray(studyMaterials.folderId, descendantFolderIds));
      await db
        .delete(studyMaterialFolders)
        .where(inArray(studyMaterialFolders.id, descendantFolderIds));
      return { success: true, id, kind };
    }

    case 'source': {
      const [source] = await db
        .select({ id: sources.id, s3Key: sources.s3Key })
        .from(sources)
        .where(eq(sources.id, id));
      if (!source) {
        throw new NotFoundError('Source', {
          messageKey: 'errors.sources.sourceNotFound',
        });
      }
      await cleanupSources([source], storageService, jobQueue);
      await db.delete(sources).where(eq(sources.id, id));
      return { success: true, id, kind };
    }

    case 'source_folder': {
      const [folder] = await db
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
      const descendantFolderIds = await getSourceFolderDescendantFolderIds(
        db,
        folder,
      );
      const folderSources = await db
        .select({ id: sources.id, s3Key: sources.s3Key })
        .from(sources)
        .where(inArray(sources.folderId, descendantFolderIds));

      await cleanupSources(folderSources, storageService, jobQueue);

      if (folderSources.length > 0) {
        await db.delete(sources).where(
          inArray(
            sources.id,
            folderSources.map((s) => s.id),
          ),
        );
      }
      await db
        .delete(sourceFolders)
        .where(inArray(sourceFolders.id, descendantFolderIds));
      return { success: true, id, kind };
    }

    case 'notebook': {
      const [nb] = await db
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
      await cleanupNotebookBanners([nb], storageService);

      const nbSources = await db
        .select({ id: sources.id, s3Key: sources.s3Key })
        .from(sources)
        .where(eq(sources.notebookId, id));

      await cleanupSources(nbSources, storageService, jobQueue);

      await db.delete(notebooks).where(eq(notebooks.id, id));
      return { success: true, id, kind };
    }

    case 'notebook_folder': {
      const [folder] = await db
        .select({ id: notebookFolders.id })
        .from(notebookFolders)
        .where(eq(notebookFolders.id, id));
      if (!folder) {
        throw new NotFoundError('Folder', {
          messageKey: 'errors.library.folderNotFound',
        });
      }
      const descendantFolderIds = await getNotebookFolderDescendantFolderIds(
        db,
        id,
      );
      const folderNotebooks = await db
        .select({
          id: notebooks.id,
          banner: notebooks.banner,
          bannerVariants: notebooks.bannerVariants,
        })
        .from(notebooks)
        .where(inArray(notebooks.folderId, descendantFolderIds));

      await cleanupNotebookBanners(folderNotebooks, storageService);

      for (const nb of folderNotebooks) {
        const nbSources = await db
          .select({ id: sources.id, s3Key: sources.s3Key })
          .from(sources)
          .where(eq(sources.notebookId, nb.id));
        await cleanupSources(nbSources, storageService, jobQueue);
      }

      if (folderNotebooks.length > 0) {
        await db.delete(notebooks).where(
          inArray(
            notebooks.id,
            folderNotebooks.map((nb) => nb.id),
          ),
        );
      }
      await db
        .delete(notebookFolders)
        .where(inArray(notebookFolders.id, descendantFolderIds));
      return { success: true, id, kind };
    }
  }
}

export async function emptyAllTrash(
  db: NodePgDatabase<typeof appSchema>,
  storageService: StorageService,
  jobQueue?: JobQueueService,
): Promise<{ success: boolean; purged: boolean }> {
  const deletedSources = await db
    .select({ id: sources.id, s3Key: sources.s3Key })
    .from(sources)
    .where(isNotNull(sources.deletedAt));

  await cleanupSources(deletedSources, storageService, jobQueue);

  const deletedNotebooks = await db
    .select({
      id: notebooks.id,
      banner: notebooks.banner,
      bannerVariants: notebooks.bannerVariants,
    })
    .from(notebooks)
    .where(isNotNull(notebooks.deletedAt));

  await cleanupNotebookBanners(deletedNotebooks, storageService);

  if (deletedSources.length > 0) {
    await db.delete(sources).where(
      inArray(
        sources.id,
        deletedSources.map((s) => s.id),
      ),
    );
  }

  if (deletedNotebooks.length > 0) {
    await db.delete(notebooks).where(
      inArray(
        notebooks.id,
        deletedNotebooks.map((nb) => nb.id),
      ),
    );
  }

  await db.delete(studyMaterials).where(isNotNull(studyMaterials.deletedAt));
  await db
    .delete(studyMaterialFolders)
    .where(isNotNull(studyMaterialFolders.deletedAt));
  await db.delete(sourceFolders).where(isNotNull(sourceFolders.deletedAt));
  await db.delete(notebookFolders).where(isNotNull(notebookFolders.deletedAt));

  return { success: true, purged: true };
}

export async function purgeExpiredTrash(
  db: NodePgDatabase<typeof appSchema>,
  storageService: StorageService,
  jobQueue?: JobQueueService,
  retentionDays = RETENTION_DAYS,
): Promise<void> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const expiredSources = await db
    .select({ id: sources.id, s3Key: sources.s3Key })
    .from(sources)
    .where(lt(sources.deletedAt, cutoff));

  await cleanupSources(expiredSources, storageService, jobQueue);

  if (expiredSources.length > 0) {
    await db.delete(sources).where(
      inArray(
        sources.id,
        expiredSources.map((s) => s.id),
      ),
    );
  }

  const expiredNotebooks = await db
    .select({
      id: notebooks.id,
      banner: notebooks.banner,
      bannerVariants: notebooks.bannerVariants,
    })
    .from(notebooks)
    .where(lt(notebooks.deletedAt, cutoff));

  await cleanupNotebookBanners(expiredNotebooks, storageService);

  if (expiredNotebooks.length > 0) {
    await db.delete(notebooks).where(
      inArray(
        notebooks.id,
        expiredNotebooks.map((nb) => nb.id),
      ),
    );
  }

  await db.delete(studyMaterials).where(lt(studyMaterials.deletedAt, cutoff));
  await db
    .delete(studyMaterialFolders)
    .where(lt(studyMaterialFolders.deletedAt, cutoff));
  await db.delete(sourceFolders).where(lt(sourceFolders.deletedAt, cutoff));
  await db.delete(notebookFolders).where(lt(notebookFolders.deletedAt, cutoff));
}
