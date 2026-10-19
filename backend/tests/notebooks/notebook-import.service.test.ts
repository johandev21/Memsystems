import { describe, expect, it } from 'vitest';
import { PassThrough } from 'node:stream';
import { eq } from 'drizzle-orm';
import JSZip from 'jszip';
import { createId } from '@paralleldrive/cuid2';
import { NotebookExportService } from '../../src/modules/notebooks/notebook-export.service';
import { NotebookImportService } from '../../src/modules/notebooks/notebook-import.service';
import { NotebooksService } from '../../src/modules/notebooks/notebooks.service';
import { StorageService } from '../../src/modules/storage/storage.service';
import * as appSchema from '../../src/database/schema';
import {
  seedNotebook,
  seedNotebookFolder,
  seedSource,
  seedSourceFolder,
  seedStudyMaterial,
  seedStudyMaterialFolder,
} from '../fixtures';
import { db } from '../db';

function createMockResponse() {
  const headers: Record<string, string> = {};
  const passThrough = new PassThrough();
  const chunks: Buffer[] = [];

  passThrough.on('data', (chunk) => {
    chunks.push(Buffer.from(chunk));
  });

  const res: any = passThrough;
  res.setHeader = (name: string, value: string) => {
    headers[name.toLowerCase()] = value;
  };
  res.getHeader = (name: string) => headers[name.toLowerCase()];
  res.headersSent = false;
  res.status = () => res;
  res.json = () => res;

  const getBuffer = () =>
    new Promise<Buffer>((resolve, reject) => {
      passThrough.on('finish', () => resolve(Buffer.concat(chunks)));
      passThrough.on('error', reject);
    });

  return { res, headers, getBuffer };
}

describe('NotebookImportService Integration Tests', () => {
  const mockConfigService = {
    get: (key: string) => {
      if (key === 'DEV_STORAGE_TOKEN_SECRET') return 'dev-storage-secret-test';
      return undefined;
    },
  } as any;
  const storageService = new StorageService(mockConfigService);
  const notebooksService = new NotebooksService(db as any, storageService);
  const exportService = new NotebookExportService(db as any, storageService);
  const importService = new NotebookImportService(
    db as any,
    storageService,
    notebooksService,
  );

  it('throws BadRequestError when buffer is not a valid zip archive', async () => {
    const corruptBuffer = Buffer.from('not a zip file');
    await expect(
      importService.importNotebook(corruptBuffer),
    ).rejects.toThrow('Invalid .memsys file: not a valid zip archive');
  });

  it('throws BadRequestError when manifest.json is missing', async () => {
    const zip = new JSZip();
    zip.file('notebook.json', JSON.stringify({ title: 'Test' }));
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });

    await expect(
      importService.importNotebook(buffer),
    ).rejects.toThrow('Invalid .memsys file: missing manifest.json');
  });

  it('throws BadRequestError when archive format is not memsys', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify({ version: 1, format: 'unknown' }));
    zip.file('notebook.json', JSON.stringify({ title: 'Test' }));
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });

    await expect(
      importService.importNotebook(buffer),
    ).rejects.toThrow('Unsupported archive format');
  });

  it('throws BadRequestError when notebook.json is missing', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify({ version: 1, format: 'memsys' }));
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });

    await expect(
      importService.importNotebook(buffer),
    ).rejects.toThrow('Invalid .memsys file: missing notebook.json');
  });

  it('successfully imports a complete .memsys archive exported from another notebook', async () => {
    // 1. Setup original notebook
    const originalNotebook = await seedNotebook({
      title: 'Distributed Systems',
      description: 'Consensus protocols and replication',
    });

    // Store banner blob in storage
    const bannerKey = `banners/${originalNotebook.id}.png`;
    await storageService.putObject({
      key: bannerKey,
      body: Buffer.from('fake-banner-png-content'),
      contentType: 'image/png',
    });
    await db
      .update(appSchema.notebooks)
      .set({ banner: bannerKey, groundingMode: 'strict' })
      .where(eq(appSchema.notebooks.id, originalNotebook.id));

    // Seed source folders (with hierarchy)
    const rootFolder = await seedSourceFolder(originalNotebook.id, {
      name: 'Consensus',
    });
    const [childFolder] = await db
      .insert(appSchema.sourceFolders)
      .values({
        id: createId(),
        notebookId: originalNotebook.id,
        parentId: rootFolder.id,
        name: 'Raft & Paxos',
      })
      .returning();

    // Store source file blob in storage
    const sourceS3Key = `sources/paxos-paper.pdf`;
    await storageService.putObject({
      key: sourceS3Key,
      body: Buffer.from('%PDF-1.4 simulated pdf paper'),
      contentType: 'application/pdf',
    });

    // Seed source
    const [source] = await db
      .insert(appSchema.sources)
      .values({
        id: createId(),
        notebookId: originalNotebook.id,
        folderId: childFolder.id,
        kind: 'file',
        modality: 'document',
        processingStatus: 'ready',
        title: 'Paxos Made Simple',
        rawText: 'The Paxos algorithm for consensus in asynchronous systems.',
        s3Key: sourceS3Key,
        contentType: 'application/pdf',
        fileSize: 1234,
        sha256: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        contentHash: 'hash123',
      })
      .returning();

    // Seed version
    const [version] = await db
      .insert(appSchema.sourceVersions)
      .values({
        id: createId(),
        sourceId: source.id,
        contentHash: 'hash123',
        extractorId: 'pdf-parser',
        extractorVersion: '1.0',
        normalizationVersion: 1,
        status: 'ready',
      })
      .returning();

    await db
      .update(appSchema.sources)
      .set({ currentVersionId: version.id })
      .where(eq(appSchema.sources.id, source.id));

    // Seed segment
    const [segment] = await db
      .insert(appSchema.sourceSegments)
      .values({
        id: createId(),
        sourceVersionId: version.id,
        ordinal: 0,
        kind: 'heading',
        content: 'Section 1: The Consensus Problem',
        locator: { pageNumber: 1 },
      })
      .returning();

    // Seed chunk with embedding vector
    const embedding1024 = new Array(1024).fill(0.05);
    await db.insert(appSchema.sourceChunks).values({
      id: createId(),
      sourceId: source.id,
      notebookId: originalNotebook.id,
      chunkIndex: 0,
      sourceVersionId: version.id,
      segmentIds: [segment.id],
      locator: { pageNumber: 1 },
      content: 'Section 1: The Consensus Problem',
      headingPath: ['Introduction'],
      sourceKind: 'file',
      searchableText: 'Section 1: The Consensus Problem',
      embedding: embedding1024,
    });

    // Seed study material folder & study material
    const smFolder = await seedStudyMaterialFolder(originalNotebook.id, {
      name: 'Exams',
    });
    const sm = await seedStudyMaterial(originalNotebook.id, {
      title: 'Midterm Flashcards',
      kind: 'simple_flashcard',
      folderId: smFolder.id,
    });

    // Seed chat message in original notebook (should NOT be exported or imported)
    await db.insert(appSchema.notebookChatMessages).values({
      id: createId(),
      notebookId: originalNotebook.id,
      role: 'user',
      content: 'Explain Paxos simply please.',
    });

    // Target folder to import into
    const libraryFolder = await seedNotebookFolder({ name: 'Computer Science' });

    // 2. Export original notebook to memory buffer
    const { res, getBuffer } = createMockResponse();
    const exportPromise = exportService.exportNotebook(originalNotebook.id, res);
    const [memsysBuffer] = await Promise.all([getBuffer(), exportPromise]);
    expect(memsysBuffer.length).toBeGreaterThan(0);

    // 3. Import buffer as a new notebook into target folder
    const importedNotebook = await importService.importNotebook(
      memsysBuffer,
      libraryFolder.id,
    );

    // 4. Assert new notebook properties
    expect(importedNotebook.id).toBeDefined();
    expect(importedNotebook.id).not.toBe(originalNotebook.id);
    expect(importedNotebook.title).toBe('Distributed Systems');
    expect(importedNotebook.description).toBe('Consensus protocols and replication');
    expect(importedNotebook.folderId).toBe(libraryFolder.id);
    expect(importedNotebook.groundingMode).toBe('strict');
    expect(importedNotebook.banner).toBeDefined();
    expect(importedNotebook.banner).toContain(`banners/${importedNotebook.id}`);

    // Verify banner blob was stored in storage under new key
    const bannerStored = await storageService.objectExists(importedNotebook.banner!);
    expect(bannerStored).toBe(true);

    // 5. Assert source folders hierarchy in DB
    const importedFolders = await db
      .select()
      .from(appSchema.sourceFolders)
      .where(eq(appSchema.sourceFolders.notebookId, importedNotebook.id));

    expect(importedFolders).toHaveLength(2);
    const impRoot = importedFolders.find((f) => f.name === 'Consensus');
    const impChild = importedFolders.find((f) => f.name === 'Raft & Paxos');
    expect(impRoot).toBeDefined();
    expect(impChild).toBeDefined();
    expect(impRoot!.parentId).toBeNull();
    expect(impChild!.parentId).toBe(impRoot!.id);
    expect(impRoot!.id).not.toBe(rootFolder.id);

    // 6. Assert source and blob in DB
    const importedSources = await db
      .select()
      .from(appSchema.sources)
      .where(eq(appSchema.sources.notebookId, importedNotebook.id));

    expect(importedSources).toHaveLength(1);
    const impSrc = importedSources[0];
    expect(impSrc.id).not.toBe(source.id);
    expect(impSrc.folderId).toBe(impChild!.id);
    expect(impSrc.title).toBe('Paxos Made Simple');
    expect(impSrc.s3Key).toBeDefined();
    expect(impSrc.s3Key).toContain(`sources/${impSrc.id}`);

    const sourceBlobStored = await storageService.objectExists(impSrc.s3Key!);
    expect(sourceBlobStored).toBe(true);

    // 7. Assert source version, segments, chunks
    const importedVersions = await db
      .select()
      .from(appSchema.sourceVersions)
      .where(eq(appSchema.sourceVersions.sourceId, impSrc.id));
    expect(importedVersions).toHaveLength(1);
    expect(impSrc.currentVersionId).toBe(importedVersions[0].id);

    const importedSegments = await db
      .select()
      .from(appSchema.sourceSegments)
      .where(eq(appSchema.sourceSegments.sourceVersionId, importedVersions[0].id));
    expect(importedSegments).toHaveLength(1);
    expect(importedSegments[0].content).toBe('Section 1: The Consensus Problem');

    const importedChunks = await db
      .select()
      .from(appSchema.sourceChunks)
      .where(eq(appSchema.sourceChunks.notebookId, importedNotebook.id));
    expect(importedChunks).toHaveLength(1);
    expect(importedChunks[0].sourceId).toBe(impSrc.id);
    expect(importedChunks[0].segmentIds).toEqual([importedSegments[0].id]);
    expect(importedChunks[0].embedding).toBeDefined();

    // 8. Assert study materials & folders
    const importedSmFolders = await db
      .select()
      .from(appSchema.studyMaterialFolders)
      .where(eq(appSchema.studyMaterialFolders.notebookId, importedNotebook.id));
    expect(importedSmFolders).toHaveLength(1);
    expect(importedSmFolders[0].name).toBe('Exams');

    const importedSm = await db
      .select()
      .from(appSchema.studyMaterials)
      .where(eq(appSchema.studyMaterials.notebookId, importedNotebook.id));
    expect(importedSm).toHaveLength(1);
    expect(importedSm[0].title).toBe('Midterm Flashcards');
    expect(importedSm[0].folderId).toBe(importedSmFolders[0].id);
    expect(importedSm[0].id).not.toBe(sm.id);

    // 9. Assert chat messages are completely empty
    const importedChatMessages = await db
      .select()
      .from(appSchema.notebookChatMessages)
      .where(eq(appSchema.notebookChatMessages.notebookId, importedNotebook.id));
    expect(importedChatMessages).toHaveLength(0);
  });
});
