import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { studyMaterialFolders, studyMaterials } from '../../database/schema';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../common/errors/domain-error';
import { DRIZZLE } from '../database/database.module';
import { NotebooksService } from '../notebooks/notebooks.service';

export interface CreateFolderInput {
  name: string;
  parentId?: string;
}

export interface UpdateFolderInput {
  name?: string;
  parentId?: string | null;
}

@Injectable()
export class StudyMaterialFolderService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly notebooksService: NotebooksService,
  ) {}

  async list(userId: string, notebookId: string) {
    await this.notebooksService.assertNotebookOwner(userId, notebookId);
    return this.db
      .select()
      .from(studyMaterialFolders)
      .where(
        and(
          eq(studyMaterialFolders.notebookId, notebookId),
          isNull(studyMaterialFolders.deletedAt),
        ),
      )
      .orderBy(desc(studyMaterialFolders.createdAt));
  }

  async create(userId: string, notebookId: string, input: CreateFolderInput) {
    await this.notebooksService.assertNotebookOwner(userId, notebookId);
    const name = input.name.trim();
    if (name.length === 0) {
      throw new BadRequestError('Folder name cannot be empty');
    }
    if (input.parentId) {
      await this.assertFolderOwned(userId, notebookId, input.parentId);
    }
    const [folder] = await this.db
      .insert(studyMaterialFolders)
      .values({
        notebookId,
        name,
        parentId: input.parentId ?? null,
      })
      .returning();
    return folder;
  }

  async update(userId: string, folderId: string, input: UpdateFolderInput) {
    const folder = await this.fetchOwned(userId, folderId);
    const updates: Partial<typeof studyMaterialFolders.$inferInsert> = {};
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (name.length === 0) {
        throw new BadRequestError('Folder name cannot be empty');
      }
      updates.name = name;
    }
    if (input.parentId !== undefined) {
      if (input.parentId === folderId) {
        throw new BadRequestError('Folder cannot be its own parent');
      }
      if (input.parentId) {
        await this.assertFolderOwned(userId, folder.notebookId, input.parentId);
        const wouldCycle = await this.wouldCreateCycle(
          folderId,
          input.parentId,
        );
        if (wouldCycle) {
          throw new BadRequestError(
            'Cannot reparent folder under one of its descendants',
          );
        }
      }
      updates.parentId = input.parentId;
    }
    if (Object.keys(updates).length === 0) {
      return folder;
    }
    const [updated] = await this.db
      .update(studyMaterialFolders)
      .set(updates)
      .where(eq(studyMaterialFolders.id, folderId))
      .returning();
    return updated;
  }

  async delete(userId: string, folderId: string) {
    const folder = await this.fetchOwned(userId, folderId);
    if (folder.deletedAt) {
      throw new BadRequestError('Folder already deleted');
    }
    const descendantFolderIds = await this.getDescendantFolderIds(folder);

    const activeMaterials = await this.db
      .select({ id: studyMaterials.id })
      .from(studyMaterials)
      .where(
        and(
          inArray(studyMaterials.folderId, descendantFolderIds),
          isNull(studyMaterials.deletedAt),
        ),
      );

    if (activeMaterials.length > 0) {
      throw new BadRequestError(
        'Cannot delete folder: please delete all study materials inside first',
      );
    }

    const now = new Date();
    // Single bulk update is atomic; transaction ensures no partial state if future logic adds steps
    const doDelete = async (executor: typeof this.db) => {
      await executor
        .update(studyMaterialFolders)
        .set({ deletedAt: now })
        .where(inArray(studyMaterialFolders.id, descendantFolderIds));
    };

    // Use transaction when available for strict atomicity
    const maybeTx = (
      this.db as unknown as {
        transaction?: (
          cb: (tx: typeof this.db) => Promise<void>,
        ) => Promise<void>;
      }
    ).transaction;
    if (maybeTx) {
      await maybeTx.call(this.db, async (tx: typeof this.db) => {
        await doDelete(tx);
      });
    } else {
      await doDelete(this.db);
    }
    return { ...folder, deletedAt: now };
  }

  private async getDescendantFolderIds(folder: {
    id: string;
    notebookId: string;
  }): Promise<string[]>;
  private async getDescendantFolderIds(parentId: string): Promise<string[]>;
  private async getDescendantFolderIds(
    arg: string | { id: string; notebookId: string },
  ): Promise<string[]> {
    const folderId = typeof arg === 'string' ? arg : arg.id;
    const notebookId = typeof arg === 'string' ? null : arg.notebookId;

    // Efficient: one query for all active folders of the notebook, then in-memory BFS
    if (notebookId) {
      const allFolders = await this.db
        .select({
          id: studyMaterialFolders.id,
          parentId: studyMaterialFolders.parentId,
        })
        .from(studyMaterialFolders)
        .where(
          and(
            eq(studyMaterialFolders.notebookId, notebookId),
            isNull(studyMaterialFolders.deletedAt),
          ),
        );
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
      while (stack.length) {
        const cur = stack.pop()!;
        for (const child of childMap.get(cur) ?? []) {
          ids.push(child);
          stack.push(child);
        }
      }
      return ids;
    }

    // Fallback recursive for legacy string-only call (N+1) — kept for wouldCreateCycle style callers if ever used
    const ids: string[] = [folderId];
    const children = await this.db
      .select({ id: studyMaterialFolders.id })
      .from(studyMaterialFolders)
      .where(
        and(
          eq(studyMaterialFolders.parentId, folderId),
          isNull(studyMaterialFolders.deletedAt),
        ),
      );
    const descendantIdsArrays = await Promise.all(
      children.map((child) => this.getDescendantFolderIds(child.id)),
    );
    for (const childIds of descendantIdsArrays) {
      ids.push(...childIds);
    }
    return ids;
  }

  async restore(userId: string, folderId: string) {
    const folder = await this.fetchOwned(userId, folderId);
    if (!folder.deletedAt) {
      return folder;
    }
    const [restored] = await this.db
      .update(studyMaterialFolders)
      .set({ deletedAt: null })
      .where(eq(studyMaterialFolders.id, folderId))
      .returning();
    return restored;
  }

  private async softDeleteSubtree(parentId: string, deletedAt: Date) {
    await this.db
      .update(studyMaterialFolders)
      .set({ deletedAt })
      .where(eq(studyMaterialFolders.parentId, parentId));
    await this.db
      .update(studyMaterialFolders)
      .set({ deletedAt })
      .where(eq(studyMaterialFolders.id, parentId));
    const children = await this.db
      .select({ id: studyMaterialFolders.id })
      .from(studyMaterialFolders)
      .where(eq(studyMaterialFolders.parentId, parentId));
    await Promise.all(
      children.map((child) => this.softDeleteSubtree(child.id, deletedAt)),
    );
  }

  private async wouldCreateCycle(
    folderId: string,
    newParentId: string,
  ): Promise<boolean> {
    let currentId: string | null = newParentId;
    while (currentId) {
      if (currentId === folderId) return true;
      const [parent] = await this.db
        .select({ parentId: studyMaterialFolders.parentId })
        .from(studyMaterialFolders)
        .where(eq(studyMaterialFolders.id, currentId));
      if (!parent) break;
      currentId = parent.parentId;
    }
    return false;
  }

  private async assertFolderOwned(
    _userId: string,
    notebookId: string,
    folderId: string,
  ) {
    const [folder] = await this.db
      .select({
        id: studyMaterialFolders.id,
        notebookId: studyMaterialFolders.notebookId,
        deletedAt: studyMaterialFolders.deletedAt,
      })
      .from(studyMaterialFolders)
      .where(eq(studyMaterialFolders.id, folderId));
    if (!folder) {
      throw new NotFoundError('Folder');
    }
    if (folder.notebookId !== notebookId) {
      throw new ForbiddenError('Folder does not belong to this notebook');
    }
    if (folder.deletedAt) {
      throw new BadRequestError('Cannot move to a folder in Trash');
    }
  }

  private async fetchOwned(userId: string, folderId: string) {
    const [folder] = await this.db
      .select()
      .from(studyMaterialFolders)
      .where(eq(studyMaterialFolders.id, folderId));
    if (!folder) {
      throw new NotFoundError('Folder');
    }
    await this.notebooksService.assertNotebookOwner(userId, folder.notebookId);
    return folder;
  }
}
