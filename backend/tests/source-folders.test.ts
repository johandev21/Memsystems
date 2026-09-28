import { beforeEach, describe, expect, it } from 'vitest';
import { SourceFolderService } from '../src/modules/sources/source-folder.service';
import { NotebooksService } from '../src/modules/notebooks/notebooks.service';
import { StorageService } from '../src/modules/storage/storage.service';
import { seedNotebook, seedSource, seedSourceFolder } from './fixtures';
import { db, resetDatabase } from './db';
import { sourceFolders, sources } from '../src/database/schema';
import { eq, inArray } from 'drizzle-orm';

describe('Source Folders (backend)', () => {
  const mockConfig = {
    get: (key: string) =>
      key === 'DEV_STORAGE_TOKEN_SECRET'
        ? 'dev-storage-secret-test'
        : undefined,
  } as any;
  const storageService = new StorageService(mockConfig);
  const notebooksService = new NotebooksService(db as any, storageService);
  const folderService = new SourceFolderService(db as any, notebooksService);

  beforeEach(async () => {
    await resetDatabase();
  });

  describe('create', () => {
    it('creates root folder with server ID and trimmed name', async () => {
      const notebook = await seedNotebook();

      const folder = await folderService.create(notebook.id, {
        name: '  Lectures  ',
      });

      expect(folder.id).toBeDefined();
      expect(folder.name).toBe('Lectures');
      expect(folder.parentId).toBeNull();
      expect(folder.notebookId).toBe(notebook.id);
    });

    it('creates nested folder under parent', async () => {
      const notebook = await seedNotebook();
      const parent = await folderService.create(notebook.id, {
        name: 'Parent Folder',
      });

      const child = await folderService.create(notebook.id, {
        name: 'Child Folder',
        parentId: parent.id,
      });

      expect(child.parentId).toBe(parent.id);
      expect(child.notebookId).toBe(notebook.id);
    });

    it('rejects blank folder name on create', async () => {
      const notebook = await seedNotebook();

      await expect(
        folderService.create(notebook.id, { name: '   ' }),
      ).rejects.toThrow();
    });

    it('rejects parent belonging to a different notebook on create', async () => {
      const nb1 = await seedNotebook();
      const nb2 = await seedNotebook();
      const parentInNb2 = await folderService.create(nb2.id, {
        name: 'Parent in NB2',
      });

      await expect(
        folderService.create(nb1.id, {
          name: 'Child in NB1',
          parentId: parentInNb2.id,
        }),
      ).rejects.toThrow();
    });
  });

  describe('update & move guards', () => {
    it('renames folder with valid name and persists', async () => {
      const notebook = await seedNotebook();
      const folder = await folderService.create(notebook.id, {
        name: 'Old Name',
      });

      const updated = await folderService.update(folder.id, {
        name: 'New Name',
      });

      expect(updated.name).toBe('New Name');
      const [row] = await db
        .select()
        .from(sourceFolders)
        .where(eq(sourceFolders.id, folder.id));
      expect(row.name).toBe('New Name');
    });

    it('rejects blank folder name on rename', async () => {
      const notebook = await seedNotebook();
      const folder = await folderService.create(notebook.id, {
        name: 'Valid Name',
      });

      await expect(
        folderService.update(folder.id, { name: '   ' }),
      ).rejects.toThrow();
    });

    it('rejects update for non-existent folder', async () => {
      await expect(
        folderService.update('non-existent-folder-id', { name: 'New Name' }),
      ).rejects.toThrow();
    });

    it('moves folder to a different parent or to root', async () => {
      const notebook = await seedNotebook();
      const p1 = await folderService.create(notebook.id, { name: 'P1' });
      const p2 = await folderService.create(notebook.id, { name: 'P2' });
      const child = await folderService.create(notebook.id, {
        name: 'Child',
        parentId: p1.id,
      });

      const movedToP2 = await folderService.update(child.id, {
        parentId: p2.id,
      });
      expect(movedToP2.parentId).toBe(p2.id);

      const movedToRoot = await folderService.update(child.id, {
        parentId: null,
      });
      expect(movedToRoot.parentId).toBeNull();
    });

    it('refuses move when target parent is the folder itself', async () => {
      const notebook = await seedNotebook();
      const folder = await folderService.create(notebook.id, { name: 'Self' });

      await expect(
        folderService.update(folder.id, { parentId: folder.id }),
      ).rejects.toThrow();
    });

    it('refuses move when target parent is already its current parent', async () => {
      const notebook = await seedNotebook();
      const parent = await folderService.create(notebook.id, {
        name: 'Parent',
      });
      const child = await folderService.create(notebook.id, {
        name: 'Child',
        parentId: parent.id,
      });

      await expect(
        folderService.update(child.id, { parentId: parent.id }),
      ).rejects.toThrow();

      // Also for root folder trying to move to root (current parent is null)
      await expect(
        folderService.update(parent.id, { parentId: null }),
      ).rejects.toThrow();
    });

    it('refuses move when target parent is one of its own descendants (cycle prevention)', async () => {
      const notebook = await seedNotebook();
      const f1 = await folderService.create(notebook.id, { name: 'Level 1' });
      const f2 = await folderService.create(notebook.id, {
        name: 'Level 2',
        parentId: f1.id,
      });
      const f3 = await folderService.create(notebook.id, {
        name: 'Level 3',
        parentId: f2.id,
      });

      // Trying to move Level 1 under Level 3 would create a cycle Level 1 -> Level 2 -> Level 3 -> Level 1
      await expect(
        folderService.update(f1.id, { parentId: f3.id }),
      ).rejects.toThrow();
    });

    it('refuses move to parent belonging to another notebook', async () => {
      const nb1 = await seedNotebook();
      const nb2 = await seedNotebook();
      const f1 = await folderService.create(nb1.id, { name: 'Folder NB1' });
      const f2 = await folderService.create(nb2.id, { name: 'Folder NB2' });

      await expect(
        folderService.update(f1.id, { parentId: f2.id }),
      ).rejects.toThrow();
    });
  });

  describe('list', () => {
    it('lists folders in stable creation order', async () => {
      const notebook = await seedNotebook();
      const f1 = await folderService.create(notebook.id, { name: 'Folder 1' });
      const f2 = await folderService.create(notebook.id, { name: 'Folder 2' });
      const f3 = await folderService.create(notebook.id, {
        name: 'Folder 3',
        parentId: f1.id,
      });

      const list = await folderService.list(notebook.id);
      expect(list.map((f) => f.id)).toEqual([f1.id, f2.id, f3.id]);
    });
  });

  describe('delete & reparenting', () => {
    it('deleting a folder reparents direct sources to root and deletes descendant folders', async () => {
      const notebook = await seedNotebook();
      const parent = await folderService.create(notebook.id, {
        name: 'Parent',
      });
      const child = await folderService.create(notebook.id, {
        name: 'Child',
        parentId: parent.id,
      });

      const sourceInParent = await seedSource(notebook.id, {
        title: 'Source in Parent',
        kind: 'text',
        rawText: 'Content 1',
        folderId: parent.id,
      });

      const sourceInChild = await seedSource(notebook.id, {
        title: 'Source in Child',
        kind: 'text',
        rawText: 'Content 2',
        folderId: child.id,
      });

      const sourceAtRoot = await seedSource(notebook.id, {
        title: 'Source at Root',
        kind: 'text',
        rawText: 'Content 3',
        folderId: null,
      });

      await folderService.delete(parent.id);

      // Parent and child folders are deleted
      const remainingFolders = await db
        .select()
        .from(sourceFolders)
        .where(inArray(sourceFolders.id, [parent.id, child.id]));
      expect(remainingFolders).toHaveLength(0);

      // Sources still exist, and direct/descendant sources have folderId: null (reparented to root)
      const [reparentedParentSource] = await db
        .select()
        .from(sources)
        .where(eq(sources.id, sourceInParent.id));
      expect(reparentedParentSource).toBeDefined();
      expect(reparentedParentSource.folderId).toBeNull();

      const [reparentedChildSource] = await db
        .select()
        .from(sources)
        .where(eq(sources.id, sourceInChild.id));
      expect(reparentedChildSource).toBeDefined();
      expect(reparentedChildSource.folderId).toBeNull();

      const [rootSource] = await db
        .select()
        .from(sources)
        .where(eq(sources.id, sourceAtRoot.id));
      expect(rootSource).toBeDefined();
      expect(rootSource.folderId).toBeNull();
    });
  });
});
