import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import * as appSchema from '../../src/database/schema';
import { NotebooksService } from '../../src/modules/notebooks/notebooks.service';
import { StorageService } from '../../src/modules/storage/storage.service';
import {
  seedNotebook,
  seedSource,
  seedSourceFolder,
  seedStudyMaterial,
  seedStudyMaterialFolder,
} from '../fixtures';
import { db } from '../db';

describe('NotebooksService Integration Tests', () => {
  const mockConfigService = {
    get: (key: string) => {
      if (key === 'DEV_STORAGE_TOKEN_SECRET') return 'dev-storage-secret-test';
      return undefined;
    },
  } as any;
  const storageService = new StorageService(mockConfigService);
  const notebooksService = new NotebooksService(db as any, storageService);

  it('should create and list notebooks for a user', async () => {
    const created = await notebooksService.create({
      title: 'My NestJS Notebook',
      description: 'Testing backend extraction',
    });

    expect(created.id).toBeDefined();
    expect(created.title).toBe('My NestJS Notebook');

    const list = await notebooksService.list();
    expect(Array.isArray(list)).toBe(true);
    expect((list as any[]).length).toBe(1);
    expect((list as any[])[0].id).toBe(created.id);
  });

  it('should update notebook details', async () => {
    const notebook = await seedNotebook({
      title: 'Old Title',
      description: 'Initial description',
    });

    const updated = await notebooksService.update(notebook.id, {
      title: 'New Updated Title',
      description: null,
      icon: null,
    });

    expect(updated.title).toBe('New Updated Title');
    expect(updated.description).toBe('');
    expect(updated.icon).toBe('notebook');
  });

  it('should soft-delete a notebook and cascade to its folders and contents', async () => {
    const notebook = await seedNotebook({ title: 'To Soft Delete' });

    // Seed child source folder & source
    const srcFolder = await seedSourceFolder(notebook.id, {
      name: 'Source Folder',
    });
    const src = await seedSource(notebook.id, {
      title: 'Source Item',
      folderId: srcFolder.id,
    });

    // Seed child study material folder & study material
    const smFolder = await seedStudyMaterialFolder(notebook.id, {
      name: 'SM Folder',
    });
    const sm = await seedStudyMaterial(notebook.id, {
      kind: 'quiz',
      title: 'Quiz Item',
      folderId: smFolder.id,
    });

    // Delete notebook
    const deletedRes = await notebooksService.delete(notebook.id);
    expect(deletedRes.id).toBe(notebook.id);

    // Notebook get and list should exclude it
    await expect(notebooksService.get(notebook.id)).rejects.toThrow(
      'Notebook not found',
    );
    const list = await notebooksService.list();
    expect(list).toEqual([]);

    // Check database rows for soft-delete timestamps
    const [nbRow] = await db
      .select()
      .from(appSchema.notebooks)
      .where(eq(appSchema.notebooks.id, notebook.id));
    expect(nbRow.deletedAt).toBeInstanceOf(Date);

    const [srcFolderRow] = await db
      .select()
      .from(appSchema.sourceFolders)
      .where(eq(appSchema.sourceFolders.id, srcFolder.id));
    expect(srcFolderRow.deletedAt).toBeInstanceOf(Date);

    const [srcRow] = await db
      .select()
      .from(appSchema.sources)
      .where(eq(appSchema.sources.id, src.id));
    expect(srcRow.deletedAt).toBeInstanceOf(Date);

    const [smFolderRow] = await db
      .select()
      .from(appSchema.studyMaterialFolders)
      .where(eq(appSchema.studyMaterialFolders.id, smFolder.id));
    expect(smFolderRow.deletedAt).toBeInstanceOf(Date);

    const [smRow] = await db
      .select()
      .from(appSchema.studyMaterials)
      .where(eq(appSchema.studyMaterials.id, sm.id));
    expect(smRow.deletedAt).toBeInstanceOf(Date);
  });
});
