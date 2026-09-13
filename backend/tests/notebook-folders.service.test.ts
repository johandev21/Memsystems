import { describe, expect, it } from 'vitest';
import { NotebookFolderService } from '../src/modules/notebooks/notebook-folder.service';
import { NotebooksService } from '../src/modules/notebooks/notebooks.service';
import { StorageService } from '../src/modules/storage/storage.service';
import { seedNotebook } from './fixtures';
import { db } from './db';
import { notebooks } from '../src/database/schema';
import { eq } from 'drizzle-orm';

describe('NotebookFolderService (library folders)', () => {
  const mockConfig = {
    get: (key: string) =>
      key === 'DEV_STORAGE_TOKEN_SECRET'
        ? 'dev-storage-secret-test'
        : undefined,
  } as any;
  const storageService = new StorageService(mockConfig);
  const notebooksService = new NotebooksService(db as any, storageService);
  const folderService = new NotebookFolderService(db as any);

  it('creates root and nested folders', async () => {
    const root = await folderService.create({ name: 'Classical Philosophy' });
    const child = await folderService.create({
      name: 'Aristotle',
      parentId: root.id,
    });

    expect(root.parentId).toBeNull();
    expect(child.parentId).toBe(root.id);
    expect(child.name).toBe('Aristotle');
  });

  it('rejects blank folder names and unknown parents', async () => {
    await expect(folderService.create({ name: '   ' })).rejects.toThrow(
      'Folder name cannot be empty',
    );
    await expect(
      folderService.create({ name: 'Orphan', parentId: 'missing-folder' }),
    ).rejects.toThrow('Folder not found');
  });

  it('renames a folder', async () => {
    const folder = await folderService.create({ name: 'Old' });
    const updated = await folderService.update(folder.id, { name: 'New' });
    expect(updated.name).toBe('New');
  });

  it('rejects moving a folder into itself or its descendants', async () => {
    const root = await folderService.create({ name: 'Root' });
    const child = await folderService.create({
      name: 'Child',
      parentId: root.id,
    });
    const grandchild = await folderService.create({
      name: 'Grandchild',
      parentId: child.id,
    });

    await expect(
      folderService.update(root.id, { parentId: root.id }),
    ).rejects.toThrow('Folder cannot be its own parent');
    await expect(
      folderService.update(root.id, { parentId: grandchild.id }),
    ).rejects.toThrow('Cannot move a folder inside one of its descendants');
  });

  it('moves a folder under another branch', async () => {
    const classical = await folderService.create({ name: 'Classical' });
    const modern = await folderService.create({ name: 'Modern' });
    const moved = await folderService.create({
      name: 'Kant',
      parentId: classical.id,
    });

    const updated = await folderService.update(moved.id, {
      parentId: modern.id,
    });
    expect(updated.parentId).toBe(modern.id);
  });

  it('deletes a folder and re-parents its child folders and notebooks', async () => {
    const parent = await folderService.create({ name: 'Parent' });
    const target = await folderService.create({
      name: 'Target',
      parentId: parent.id,
    });
    const childFolder = await folderService.create({
      name: 'Child Folder',
      parentId: target.id,
    });
    const notebook = await notebooksService.create({
      title: 'Filed notebook',
      folderId: target.id,
    });

    await folderService.delete(target.id);

    const listed = await folderService.list();
    expect(listed.some((folder) => folder.id === target.id)).toBe(false);
    expect(
      listed.find((folder) => folder.id === childFolder.id)?.parentId,
    ).toBe(parent.id);

    const [row] = await db
      .select({ folderId: notebooks.folderId })
      .from(notebooks)
      .where(eq(notebooks.id, notebook.id));
    expect(row.folderId).toBe(parent.id);
  });

  it('files notebooks and moves them between folders', async () => {
    const first = await folderService.create({ name: 'First' });
    const second = await folderService.create({ name: 'Second' });
    const notebook = await notebooksService.create({
      title: 'Filed',
      folderId: first.id,
    });
    expect(notebook.folderId).toBe(first.id);

    const moved = await notebooksService.update(notebook.id, {
      folderId: second.id,
    });
    expect(moved.folderId).toBe(second.id);

    const unfiled = await notebooksService.update(notebook.id, {
      folderId: null,
    });
    expect(unfiled.folderId).toBeNull();

    await expect(
      notebooksService.update(notebook.id, { folderId: 'missing-folder' }),
    ).rejects.toThrow('Folder not found');
  });

  it('keeps seeded notebooks at the root when no folder is given', async () => {
    const notebook = await seedNotebook();

    const [row] = await db
      .select({ folderId: notebooks.folderId })
      .from(notebooks)
      .where(eq(notebooks.id, notebook.id));
    expect(row.folderId).toBeNull();
  });
});
