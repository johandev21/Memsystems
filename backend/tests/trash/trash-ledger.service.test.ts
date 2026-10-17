import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import * as appSchema from '../../src/database/schema';
import { TrashLedgerService } from '../../src/modules/trash/trash-ledger.service';
import {
  seedNotebook,
  seedNotebookFolder,
  seedSource,
  seedSourceFolder,
  seedStudyMaterial,
  seedStudyMaterialFolder,
} from '../fixtures';
import { db } from '../db';

describe('TrashLedgerService Integration Tests', () => {
  const service = new TrashLedgerService(db as any);

  it('aggregates top-level soft-deleted roots across all 6 tables and filters out cascaded children', async () => {
    // 1. Alive notebook with its own contents
    const aliveNb = await seedNotebook({ title: 'Alive Notebook' });
    const aliveSrcFolder = await seedSourceFolder(aliveNb.id, { name: 'Alive Source Folder' });
    const deletedSrcInAliveFolder = await seedSource(aliveNb.id, {
      title: 'Deleted Source in Alive Folder',
      folderId: aliveSrcFolder.id,
    });
    // Soft-delete the source
    await db
      .update(appSchema.sources)
      .set({ deletedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) })
      .where(eq(appSchema.sources.id, deletedSrcInAliveFolder.id));

    // 2. Deleted notebook with cascaded source folder and study material
    const deletedNb = await seedNotebook({ title: 'Deleted Notebook' });
    const childSrcFolder = await seedSourceFolder(deletedNb.id, { name: 'Child Source Folder' });
    const childSm = await seedStudyMaterial(deletedNb.id, { kind: 'quiz', title: 'Child Quiz' });
    const nbDeletedAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

    await db
      .update(appSchema.notebooks)
      .set({ deletedAt: nbDeletedAt })
      .where(eq(appSchema.notebooks.id, deletedNb.id));
    await db
      .update(appSchema.sourceFolders)
      .set({ deletedAt: nbDeletedAt })
      .where(eq(appSchema.sourceFolders.id, childSrcFolder.id));
    await db
      .update(appSchema.studyMaterials)
      .set({ deletedAt: nbDeletedAt })
      .where(eq(appSchema.studyMaterials.id, childSm.id));

    // 3. Deleted notebook folder
    const deletedNbFolder = await seedNotebookFolder({ name: 'Deleted Notebook Folder' });
    const folderDeletedAt = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    await db
      .update(appSchema.notebookFolders)
      .set({ deletedAt: folderDeletedAt })
      .where(eq(appSchema.notebookFolders.id, deletedNbFolder.id));

    // Query global trash
    const res = await service.list();

    // Verify root filtering:
    // Only 3 roots should be present:
    // 1. Deleted Notebook Folder (deleted 1d ago -> 29d left)
    // 2. Deleted Source in Alive Folder (deleted 2d ago -> 28d left)
    // 3. Deleted Notebook (deleted 5d ago -> 25d left)
    // Child Source Folder and Child Quiz must NOT be present!
    expect(res.items).toHaveLength(3);

    const ids = res.items.map((i) => i.id);
    expect(ids).toContain(deletedNbFolder.id);
    expect(ids).toContain(deletedSrcInAliveFolder.id);
    expect(ids).toContain(deletedNb.id);

    expect(ids).not.toContain(childSrcFolder.id);
    expect(ids).not.toContain(childSm.id);

    // Check item attributes
    const srcItem = res.items.find((i) => i.id === deletedSrcInAliveFolder.id)!;
    expect(srcItem.kind).toBe('source');
    expect(srcItem.subtypeLabel).toBe('Text');
    expect(srcItem.notebookId).toBe(aliveNb.id);
    expect(srcItem.notebookTitle).toBe(aliveNb.title);
    expect(srcItem.daysRemaining).toBe(28);

    const nbItem = res.items.find((i) => i.id === deletedNb.id)!;
    expect(nbItem.kind).toBe('notebook');
    expect(nbItem.subtypeLabel).toBe('Notebook');
    expect(nbItem.daysRemaining).toBe(25);
  });

  it('supports cursor-based pagination', async () => {
    // Seed 5 soft-deleted notebook folders with distinct timestamps
    for (let i = 1; i <= 5; i++) {
      const folder = await seedNotebookFolder({ name: `Folder ${i}` });
      await db
        .update(appSchema.notebookFolders)
        .set({ deletedAt: new Date(Date.now() - i * 1000) })
        .where(eq(appSchema.notebookFolders.id, folder.id));
    }

    const page1 = await service.list(undefined, 2);
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).toBeDefined();
    expect(typeof page1.nextCursor).toBe('string');

    const page2 = await service.list(page1.nextCursor!, 2);
    expect(page2.items).toHaveLength(2);
    expect(page2.nextCursor).toBeDefined();

    // Ensure items are distinct between pages
    const page1Ids = page1.items.map((i) => i.id);
    const page2Ids = page2.items.map((i) => i.id);
    for (const id of page2Ids) {
      expect(page1Ids).not.toContain(id);
    }
  });
});
