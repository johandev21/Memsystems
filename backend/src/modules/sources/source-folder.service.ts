import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { sourceFolders, sources } from '../../database/schema';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../common/errors/domain-error';
import { DRIZZLE } from '../database/database.module';
import { NotebooksService } from '../notebooks/notebooks.service';

export interface CreateSourceFolderInput {
  name: string;
  parentId?: string | null;
}

export interface UpdateSourceFolderInput {
  name?: string;
  parentId?: string | null;
}

@Injectable()
export class SourceFolderService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly notebooksService: NotebooksService,
  ) {}

  async list(notebookId: string) {
    await this.notebooksService.assertNotebookOwner(notebookId);
    return this.db
      .select()
      .from(sourceFolders)
      .where(eq(sourceFolders.notebookId, notebookId))
      .orderBy(asc(sourceFolders.createdAt), asc(sourceFolders.id));
  }

  async create(notebookId: string, input: CreateSourceFolderInput) {
    await this.notebooksService.assertNotebookOwner(notebookId);
    const name = input.name.trim();
    if (name.length === 0) {
      throw new BadRequestError('Folder name cannot be empty', {
        messageKey: 'errors.sources.folderNameEmpty',
      });
    }
    if (input.parentId) {
      await this.assertFolderOwned(notebookId, input.parentId);
    }
    const [folder] = await this.db
      .insert(sourceFolders)
      .values({
        notebookId,
        name,
        parentId: input.parentId ?? null,
      })
      .returning();
    return folder;
  }

  async update(folderId: string, input: UpdateSourceFolderInput) {
    const folder = await this.fetchOwned(folderId);
    const updates: Partial<typeof sourceFolders.$inferInsert> = {};

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (name.length === 0) {
        throw new BadRequestError('Folder name cannot be empty', {
          messageKey: 'errors.sources.folderNameEmpty',
        });
      }
      updates.name = name;
    }

    if (input.parentId !== undefined) {
      if (input.parentId === folderId) {
        throw new BadRequestError('Folder cannot be its own parent', {
          messageKey: 'errors.sources.folderOwnParent',
        });
      }
      if ((input.parentId ?? null) === (folder.parentId ?? null)) {
        throw new BadRequestError('Folder is already in this location', {
          messageKey: 'errors.sources.folderSameParent',
        });
      }
      if (input.parentId) {
        await this.assertFolderOwned(folder.notebookId, input.parentId);
        const wouldCycle = await this.wouldCreateCycle(
          folderId,
          input.parentId,
        );
        if (wouldCycle) {
          throw new BadRequestError(
            'Cannot reparent folder under one of its descendants',
            { messageKey: 'errors.sources.folderReparentCycle' },
          );
        }
      }
      updates.parentId = input.parentId ?? null;
    }

    if (Object.keys(updates).length === 0) {
      return folder;
    }

    const [updated] = await this.db
      .update(sourceFolders)
      .set(updates)
      .where(eq(sourceFolders.id, folderId))
      .returning();
    return updated;
  }

  async delete(folderId: string) {
    const folder = await this.fetchOwned(folderId);
    const descendantFolderIds = await this.getDescendantFolderIds(folder);

    const doDelete = async (executor: typeof this.db) => {
      // Reparent direct and indirect sources in the subtree to root
      await executor
        .update(sources)
        .set({ folderId: null })
        .where(inArray(sources.folderId, descendantFolderIds));

      // Delete all folders in the subtree
      await executor
        .delete(sourceFolders)
        .where(inArray(sourceFolders.id, descendantFolderIds));
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
        await doDelete(tx);
      });
    } else {
      await doDelete(this.db);
    }

    return {
      id: folder.id,
      notebookId: folder.notebookId,
      name: folder.name,
      deleted: true,
    };
  }

  private async getDescendantFolderIds(folder: {
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

  private async wouldCreateCycle(
    folderId: string,
    newParentId: string,
  ): Promise<boolean> {
    let currentId: string | null = newParentId;
    while (currentId) {
      if (currentId === folderId) return true;
      const [parent] = await this.db
        .select({ parentId: sourceFolders.parentId })
        .from(sourceFolders)
        .where(eq(sourceFolders.id, currentId));
      if (!parent) break;
      currentId = parent.parentId;
    }
    return false;
  }

  private async assertFolderOwned(notebookId: string, folderId: string) {
    const [folder] = await this.db
      .select({
        id: sourceFolders.id,
        notebookId: sourceFolders.notebookId,
      })
      .from(sourceFolders)
      .where(eq(sourceFolders.id, folderId));
    if (!folder) {
      throw new NotFoundError('Source Folder', {
        messageKey: 'errors.sources.folderNotFound',
      });
    }
    if (folder.notebookId !== notebookId) {
      throw new ForbiddenError('Folder does not belong to this notebook', {
        messageKey: 'errors.sources.folderNotInNotebook',
      });
    }
  }

  private async fetchOwned(folderId: string) {
    const [folder] = await this.db
      .select()
      .from(sourceFolders)
      .where(eq(sourceFolders.id, folderId));
    if (!folder) {
      throw new NotFoundError('Source Folder', {
        messageKey: 'errors.sources.folderNotFound',
      });
    }
    await this.notebooksService.assertNotebookOwner(folder.notebookId);
    return folder;
  }
}
