import { eq } from 'drizzle-orm';
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
import { NotebookFolderService } from '../notebooks/notebook-folder.service';
import { SourceFolderService } from '../sources/folders/source-folder.service';
import { StudyMaterialFolderService } from '../study-materials/study-material-folder.service';
import { StudyMaterialService } from '../study-materials/study-material.service';
import { TrashKind } from './trash-listing';

export interface TrashRestoreServices {
  notebookFolderService: NotebookFolderService;
  sourceFolderService: SourceFolderService;
  studyMaterialFolderService: StudyMaterialFolderService;
  studyMaterialService: StudyMaterialService;
}

export async function findAliveNotebookFolderAncestor(
  db: NodePgDatabase<typeof appSchema>,
  folderId: string,
): Promise<string | null> {
  let currentId: string | null = folderId;
  while (currentId) {
    const [folder] = await db
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

export async function findAliveSourceFolderAncestor(
  db: NodePgDatabase<typeof appSchema>,
  folderId: string,
): Promise<string | null> {
  let currentId: string | null = folderId;
  while (currentId) {
    const [folder] = await db
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

export async function restoreTrashItem(
  db: NodePgDatabase<typeof appSchema>,
  services: TrashRestoreServices,
  kind: TrashKind,
  id: string,
): Promise<{ success: boolean; id: string; kind: TrashKind }> {
  switch (kind) {
    case 'notebook_folder': {
      await services.notebookFolderService.restore(id);
      return { success: true, id, kind };
    }
    case 'source_folder': {
      await services.sourceFolderService.restore(id);
      return { success: true, id, kind };
    }
    case 'study_material_folder': {
      await services.studyMaterialFolderService.restore(id);
      return { success: true, id, kind };
    }
    case 'study_material': {
      await services.studyMaterialService.restore(id);
      return { success: true, id, kind };
    }
    case 'source': {
      const [source] = await db
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
        targetFolderId = await findAliveSourceFolderAncestor(
          db,
          targetFolderId,
        );
      }
      await db
        .update(sources)
        .set({ deletedAt: null, folderId: targetFolderId })
        .where(eq(sources.id, id));
      return { success: true, id, kind };
    }
    case 'notebook': {
      const [nb] = await db
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
        targetFolderId = await findAliveNotebookFolderAncestor(
          db,
          targetFolderId,
        );
      }

      const now = new Date();
      const doRestore = async (executor: typeof db) => {
        await executor
          .update(notebooks)
          .set({ deletedAt: null, folderId: targetFolderId, updatedAt: now })
          .where(eq(notebooks.id, id));
        await executor
          .update(sources)
          .set({ deletedAt: null })
          .where(eq(sources.notebookId, id));
        await executor
          .update(sourceFolders)
          .set({ deletedAt: null, updatedAt: now })
          .where(eq(sourceFolders.notebookId, id));
        await executor
          .update(studyMaterials)
          .set({ deletedAt: null, updatedAt: now })
          .where(eq(studyMaterials.notebookId, id));
        await executor
          .update(studyMaterialFolders)
          .set({ deletedAt: null, updatedAt: now })
          .where(eq(studyMaterialFolders.notebookId, id));
      };

      const maybeTx = (
        db as unknown as {
          transaction?: (cb: (tx: typeof db) => Promise<void>) => Promise<void>;
        }
      ).transaction;

      if (maybeTx) {
        await maybeTx.call(db, async (tx: typeof db) => {
          await doRestore(tx);
        });
      } else {
        await doRestore(db);
      }
      return { success: true, id, kind };
    }
  }
}
