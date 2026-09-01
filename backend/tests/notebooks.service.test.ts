import { describe, expect, it } from 'vitest';
import { NotebooksService } from '../src/modules/notebooks/notebooks.service';
import { StorageService } from '../src/modules/storage/storage.service';
import { seedNotebook, seedUser } from './fixtures';
import { db } from './db';

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
    const user = await seedUser();
    const created = await notebooksService.create(user.id, {
      title: 'My NestJS Notebook',
      description: 'Testing backend extraction',
    });

    expect(created.id).toBeDefined();
    expect(created.title).toBe('My NestJS Notebook');

    const list = await notebooksService.list(user.id);
    expect(Array.isArray(list)).toBe(true);
    expect((list as any[]).length).toBe(1);
    expect((list as any[])[0].id).toBe(created.id);
  });

  it('should update notebook details', async () => {
    const user = await seedUser();
    const notebook = await seedNotebook(user.id, {
      title: 'Old Title',
      description: 'Initial description',
    });

    const updated = await notebooksService.update(user.id, notebook.id, {
      title: 'New Updated Title',
      description: null,
      icon: null,
    });

    expect(updated.title).toBe('New Updated Title');
    expect(updated.description).toBe('');
    expect(updated.icon).toBe('notebook');
  });

  it('should delete a notebook', async () => {
    const user = await seedUser();
    const notebook = await seedNotebook(user.id, { title: 'To Delete' });

    await notebooksService.delete(user.id, notebook.id);

    await expect(notebooksService.get(user.id, notebook.id)).rejects.toThrow(
      'Notebook not found',
    );
  });
});
