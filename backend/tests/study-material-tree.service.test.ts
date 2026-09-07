import { describe, expect, it } from 'vitest';
import { StudyMaterialFolderService } from '../src/modules/study-materials/study-material-folder.service';
import { StudyMaterialService } from '../src/modules/study-materials/study-material.service';
import { NotebooksService } from '../src/modules/notebooks/notebooks.service';
import { StorageService } from '../src/modules/storage/storage.service';
import { seedNotebook, seedStudyMaterial } from './fixtures';
import { db } from './db';
import { studyMaterialFolders } from '../src/database/schema';
import { eq } from 'drizzle-orm';

describe('Study Materials Tree — folder creation and rename (backend)', () => {
  const mockConfig = {
    get: (key: string) =>
      key === 'DEV_STORAGE_TOKEN_SECRET'
        ? 'dev-storage-secret-test'
        : undefined,
  } as any;
  const storageService = new StorageService(mockConfig);
  const notebooksService = new NotebooksService(db as any, storageService);
  const folderService = new StudyMaterialFolderService(
    db as any,
    notebooksService,
  );
  const materialService = new StudyMaterialService(db as any, notebooksService);

  it('creates root folder with server ID and Untitled folder name', async () => {
    const notebook = await seedNotebook();

    const folder = await folderService.create(notebook.id, {
      name: 'Untitled folder',
    });

    expect(folder.id).toBeDefined();
    expect(folder.name).toBe('Untitled folder');
    expect(folder.parentId).toBeNull();
    expect(folder.notebookId).toBe(notebook.id);
  });

  it('creates nested folder under parent', async () => {
    const notebook = await seedNotebook();
    const parent = await folderService.create(notebook.id, {
      name: 'Parent',
    });

    const child = await folderService.create(notebook.id, {
      name: 'Child',
      parentId: parent.id,
    });

    expect(child.parentId).toBe(parent.id);
    expect(child.notebookId).toBe(notebook.id);
  });

  it('renames folder with valid name and persists', async () => {
    const notebook = await seedNotebook();
    const folder = await folderService.create(notebook.id, {
      name: 'Old',
    });

    const updated = await folderService.update(folder.id, {
      name: 'New Name',
    });

    expect(updated.name).toBe('New Name');
    expect(updated.id).toBe(folder.id);

    const [row] = await db
      .select()
      .from(studyMaterialFolders)
      .where(eq(studyMaterialFolders.id, folder.id));
    expect(row.name).toBe('New Name');
  });

  it('rejects blank folder name on rename', async () => {
    const notebook = await seedNotebook();
    const folder = await folderService.create(notebook.id, {
      name: 'Original',
    });

    await expect(
      folderService.update(folder.id, { name: '   ' }),
    ).rejects.toThrow();
  });

  it('rejects rename for unknown folder', async () => {
    const notebook = await seedNotebook();
    const folder = await folderService.create(notebook.id, {
      name: 'Secret',
    });

    await expect(
      folderService.update('non-existent-folder-id', { name: 'Hacked' }),
    ).rejects.toThrow();
  });

  it('rejects cross-notebook parent on create', async () => {
    const nb1 = await seedNotebook();
    const nb2 = await seedNotebook();
    const parentInNb2 = await folderService.create(nb2.id, {
      name: 'Other',
    });

    await expect(
      folderService.create(nb1.id, {
        name: 'Child',
        parentId: parentInNb2.id,
      }),
    ).rejects.toThrow();
  });

  it('allows non-unique folder names', async () => {
    const notebook = await seedNotebook();
    const f1 = await folderService.create(notebook.id, {
      name: 'Same',
    });
    const f2 = await folderService.create(notebook.id, {
      name: 'Same',
    });

    expect(f1.name).toBe('Same');
    expect(f2.name).toBe('Same');
    expect(f1.id).not.toBe(f2.id);
  });

  it('renames material with valid title and persists', async () => {
    const notebook = await seedNotebook();
    const material = await seedStudyMaterial(notebook.id, {
      kind: 'quiz',
      title: 'Old Title',
    });

    const updated = await materialService.update(material.id, {
      title: 'New Title',
    });

    expect(updated.title).toBe('New Title');
    expect(updated.id).toBe(material.id);
  });

  it('rejects blank material title on rename', async () => {
    const notebook = await seedNotebook();
    const material = await seedStudyMaterial(notebook.id, {
      kind: 'quiz',
      title: 'Original',
    });

    await expect(
      materialService.update(material.id, { title: '   ' }),
    ).rejects.toThrow();
  });

  it('rejects material rename for unknown material', async () => {
    const notebook = await seedNotebook();
    const material = await seedStudyMaterial(notebook.id, {
      kind: 'quiz',
      title: 'Secret',
    });

    await expect(
      materialService.update('non-existent-material-id', { title: 'Hacked' }),
    ).rejects.toThrow();
  });
});
