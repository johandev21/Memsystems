import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { studyMaterialFolders, studyMaterials } from '../../database/schema';
import { NotFoundError } from '../../common/errors/domain-error';
import { DRIZZLE } from '../database/database.module';
import { NotebooksService } from '../notebooks/notebooks.service';

export interface TrashItem {
  id: string;
  type: 'study_material' | 'folder';
  deletedAt: Date;
  name?: string;
  kind?: string;
}

@Injectable()
export class TrashService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly notebooksService: NotebooksService,
  ) {}

  async list(notebookId: string) {
    await this.notebooksService.assertNotebookOwner(notebookId);
    const [deletedMaterials, deletedFolders] = await Promise.all([
      this.db
        .select({
          id: studyMaterials.id,
          kind: studyMaterials.kind,
          title: studyMaterials.title,
          deletedAt: studyMaterials.deletedAt,
        })
        .from(studyMaterials)
        .where(
          and(
            eq(studyMaterials.notebookId, notebookId),
            isNotNull(studyMaterials.deletedAt),
          ),
        )
        .orderBy(desc(studyMaterials.deletedAt)),
      this.db
        .select({
          id: studyMaterialFolders.id,
          name: studyMaterialFolders.name,
          deletedAt: studyMaterialFolders.deletedAt,
        })
        .from(studyMaterialFolders)
        .where(
          and(
            eq(studyMaterialFolders.notebookId, notebookId),
            isNotNull(studyMaterialFolders.deletedAt),
          ),
        )
        .orderBy(desc(studyMaterialFolders.deletedAt)),
    ]);

    const items: TrashItem[] = [
      ...deletedMaterials.map((m) => ({
        id: m.id,
        type: 'study_material' as const,
        deletedAt: m.deletedAt!,
        name: m.title,
        kind: m.kind,
      })),
      ...deletedFolders.map((f) => ({
        id: f.id,
        type: 'folder' as const,
        deletedAt: f.deletedAt!,
        name: f.name,
      })),
    ];

    items.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
    return items;
  }

  async hardDeleteStudyMaterial(smId: string) {
    await this.assertStudyMaterialOwned(smId);
    await this.db.delete(studyMaterials).where(eq(studyMaterials.id, smId));
  }

  async hardDeleteFolder(folderId: string) {
    await this.assertFolderOwned(folderId);
    await this.db
      .delete(studyMaterialFolders)
      .where(eq(studyMaterialFolders.id, folderId));
  }

  private async assertStudyMaterialOwned(smId: string) {
    const [sm] = await this.db
      .select({ id: studyMaterials.id, notebookId: studyMaterials.notebookId })
      .from(studyMaterials)
      .where(eq(studyMaterials.id, smId));
    if (!sm) {
      throw new NotFoundError('Study material', {
        messageKey: 'errors.studyMaterials.studyMaterialNotFound',
      });
    }
    await this.notebooksService.assertNotebookOwner(sm.notebookId);
  }

  private async assertFolderOwned(folderId: string) {
    const [folder] = await this.db
      .select({
        id: studyMaterialFolders.id,
        notebookId: studyMaterialFolders.notebookId,
      })
      .from(studyMaterialFolders)
      .where(eq(studyMaterialFolders.id, folderId));
    if (!folder) {
      throw new NotFoundError('Folder', {
        messageKey: 'errors.studyMaterials.folderNotFound',
      });
    }
    await this.notebooksService.assertNotebookOwner(folder.notebookId);
  }
}
