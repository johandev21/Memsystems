import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { notebookFolders, notebooks } from '../../database/schema';
import {
  BadRequestError,
  NotFoundError,
} from '../../common/errors/domain-error';
import { DRIZZLE } from '../database/database.module';

export const MAX_FOLDER_NAME_LENGTH = 200;

export interface CreateNotebookFolderInput {
  name: string;
  parentId?: string | null;
}

export interface UpdateNotebookFolderInput {
  name?: string;
  parentId?: string | null;
}

export interface NotebookFolderResponse {
  id: string;
  name: string;
  parentId: string | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class NotebookFolderService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
  ) {}

  async list(): Promise<NotebookFolderResponse[]> {
    return this.db
      .select()
      .from(notebookFolders)
      .where(isNull(notebookFolders.deletedAt))
      .orderBy(asc(notebookFolders.name));
  }

  async create(
    input: CreateNotebookFolderInput,
  ): Promise<NotebookFolderResponse> {
    const name = this.normalizeName(input.name);
    const parentId = input.parentId ?? null;
    if (parentId) {
      await this.assertFolderExists(parentId);
    }
    const [folder] = await this.db
      .insert(notebookFolders)
      .values({ name, parentId })
      .returning();
    return folder;
  }

  async update(
    folderId: string,
    input: UpdateNotebookFolderInput,
  ): Promise<NotebookFolderResponse> {
    const folder = await this.fetchFolder(folderId);
    const updates: Partial<typeof notebookFolders.$inferInsert> = {};

    if (input.name !== undefined) {
      updates.name = this.normalizeName(input.name);
    }

    if (input.parentId !== undefined) {
      const parentId = input.parentId;
      if (parentId === folderId) {
        throw new BadRequestError('Folder cannot be its own parent', {
          messageKey: 'errors.library.folderOwnParent',
        });
      }
      if (parentId) {
        await this.assertFolderExists(parentId);
        if (await this.wouldCreateCycle(folderId, parentId)) {
          throw new BadRequestError(
            'Cannot move a folder inside one of its descendants',
            { messageKey: 'errors.library.folderMoveCycle' },
          );
        }
      }
      updates.parentId = parentId;
    }

    if (Object.keys(updates).length === 0) {
      return folder;
    }

    const [updated] = await this.db
      .update(notebookFolders)
      .set(updates)
      .where(eq(notebookFolders.id, folderId))
      .returning();
    return updated;
  }

  async delete(folderId: string): Promise<NotebookFolderResponse> {
    const folder = await this.fetchFolder(folderId);
    const descendantFolderIds = await this.getDescendantFolderIds(folderId);
    const now = new Date();
    const doDelete = async (executor: typeof this.db) => {
      await executor
        .update(notebooks)
        .set({ deletedAt: now })
        .where(
          and(
            inArray(notebooks.folderId, descendantFolderIds),
            isNull(notebooks.deletedAt),
          ),
        );
      await executor
        .update(notebookFolders)
        .set({ deletedAt: now })
        .where(inArray(notebookFolders.id, descendantFolderIds));
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

    return { ...folder, deletedAt: now };
  }

  async restore(folderId: string): Promise<NotebookFolderResponse> {
    const folder = await this.fetchFolder(folderId, true);
    if (!folder.deletedAt) {
      return folder;
    }
    const descendantFolderIds = await this.getDescendantFolderIds(
      folderId,
      true,
    );
    let targetParentId = folder.parentId;
    if (targetParentId) {
      targetParentId = await this.findAliveAncestor(targetParentId);
    }
    const now = new Date();
    await this.db
      .update(notebooks)
      .set({ deletedAt: null, updatedAt: now })
      .where(inArray(notebooks.folderId, descendantFolderIds));
    await this.db
      .update(notebookFolders)
      .set({ deletedAt: null, updatedAt: now })
      .where(inArray(notebookFolders.id, descendantFolderIds));
    const [restored] = await this.db
      .update(notebookFolders)
      .set({ deletedAt: null, parentId: targetParentId, updatedAt: now })
      .where(eq(notebookFolders.id, folderId))
      .returning();
    return restored;
  }

  private async findAliveAncestor(folderId: string): Promise<string | null> {
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

  private async getDescendantFolderIds(
    folderId: string,
    includeDeleted = false,
  ): Promise<string[]> {
    const allFolders = await this.db
      .select({
        id: notebookFolders.id,
        parentId: notebookFolders.parentId,
      })
      .from(notebookFolders)
      .where(includeDeleted ? undefined : isNull(notebookFolders.deletedAt));

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

  private normalizeName(rawName: string): string {
    const name = rawName.trim();
    if (name.length === 0) {
      throw new BadRequestError('Folder name cannot be empty', {
        messageKey: 'errors.library.folderNameEmpty',
      });
    }
    return name.slice(0, MAX_FOLDER_NAME_LENGTH);
  }

  private async fetchFolder(
    folderId: string,
    allowDeleted = false,
  ): Promise<NotebookFolderResponse> {
    const [folder] = await this.db
      .select()
      .from(notebookFolders)
      .where(eq(notebookFolders.id, folderId))
      .limit(1);
    if (!folder || (!allowDeleted && folder.deletedAt)) {
      throw new NotFoundError('Folder', {
        messageKey: 'errors.library.folderNotFound',
      });
    }
    return folder;
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

  private async wouldCreateCycle(
    folderId: string,
    newParentId: string,
  ): Promise<boolean> {
    const allFolders = await this.db
      .select({
        id: notebookFolders.id,
        parentId: notebookFolders.parentId,
      })
      .from(notebookFolders)
      .where(isNull(notebookFolders.deletedAt));
    const parentById = new Map(
      allFolders.map((folder) => [folder.id, folder.parentId]),
    );
    let currentId: string | null = newParentId;
    const seen = new Set<string>();
    while (currentId) {
      if (currentId === folderId) return true;
      if (seen.has(currentId)) break;
      seen.add(currentId);
      currentId = parentById.get(currentId) ?? null;
    }
    return false;
  }
}
