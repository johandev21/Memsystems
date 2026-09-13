import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
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

  /**
   * Removes a folder without losing content: its direct child folders and
   * notebooks are re-parented to the removed folder's parent, mirroring the
   * notebook library prototype. The whole operation is atomic.
   */
  async delete(folderId: string): Promise<NotebookFolderResponse> {
    const folder = await this.fetchFolder(folderId);
    await this.db.transaction(async (tx) => {
      await tx
        .update(notebookFolders)
        .set({ parentId: folder.parentId })
        .where(eq(notebookFolders.parentId, folderId));
      await tx
        .update(notebooks)
        .set({ folderId: folder.parentId })
        .where(eq(notebooks.folderId, folderId));
      await tx.delete(notebookFolders).where(eq(notebookFolders.id, folderId));
    });
    return folder;
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

  private async fetchFolder(folderId: string): Promise<NotebookFolderResponse> {
    const [folder] = await this.db
      .select()
      .from(notebookFolders)
      .where(eq(notebookFolders.id, folderId))
      .limit(1);
    if (!folder) {
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
      .where(eq(notebookFolders.id, folderId))
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
      .from(notebookFolders);
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
