import { describe, expect, it } from 'vitest';
import { PassThrough } from 'node:stream';
import { eq } from 'drizzle-orm';
import JSZip from 'jszip';
import { NotebookExportService } from '../../src/modules/notebooks/notebook-export.service';
import { NotebookImportService } from '../../src/modules/notebooks/notebook-import.service';
import { NotebooksService } from '../../src/modules/notebooks/notebooks.service';
import { NotebooksController } from '../../src/modules/notebooks/notebooks.controller';
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

function createMulterFile(
  buffer: Buffer,
  filename = 'test.memsys',
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: filename,
    encoding: '7bit',
    mimetype: 'application/octet-stream',
    size: buffer.length,
    buffer,
    stream: new PassThrough(),
    destination: '',
    filename,
    path: '',
  };
}

describe('Notebook Export & Import End-to-End Suite', () => {
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
  const controller = new NotebooksController(
    notebooksService,
    exportService,
    importService,
  );

  describe('Full Round-Trip: Populated Notebook', () => {
    it('exports a rich notebook to .memsys, verifies archive integrity and chat exclusion, then imports it back with completely fresh IDs and preserved relations', async () => {
      // 1. Arrange: Create destination folder for imported notebook
      const targetFolder = await seedNotebookFolder({
        name: 'Target Archive Folder',
      });

      // 2. Arrange: Create populated notebook with metadata, focal point, and banner
      const bannerKey = 'banners/original-banner-test.webp';
      const bannerContent = Buffer.from('FAKE-WEBP-BANNER-BINARY-DATA');
      await storageService.putObject({
        key: bannerKey,
        body: bannerContent,
        contentType: 'image/webp',
      });

      const originalNotebook = await seedNotebook({
        title: 'Quantum Field Theory',
        description: 'Comprehensive study notes on quantum electrodynamics',
        banner: bannerKey,
      });

      // Update bannerFocalPoint and groundingMode
      await db
        .update(appSchema.notebooks)
        .set({
          icon: 'atom',
          groundingMode: 'moderate',
          bannerFocalPoint: { x: 0.42, y: 0.88 },
        })
        .where(eq(appSchema.notebooks.id, originalNotebook.id));

      // 3. Arrange: Nested source folder hierarchy (Root -> Child)
      const physicsFolder = await seedSourceFolder(originalNotebook.id, {
        name: 'Physics Basics',
        parentId: null,
      });
      const opticsFolder = await seedSourceFolder(originalNotebook.id, {
        name: 'Quantum Optics',
        parentId: physicsFolder.id,
      });

      // 4. Arrange: Sources of different kinds (file, text, link)
      // File source with blob in storage
      const pdfKey = `sources/bell-inequality-${originalNotebook.id}.pdf`;
      const pdfContent = Buffer.from('%PDF-1.4 Bell Inequality Test Document');
      await storageService.putObject({
        key: pdfKey,
        body: pdfContent,
        contentType: 'application/pdf',
      });

      const fileSource = await seedSource(originalNotebook.id, {
        title: 'Bell Inequality Paper.pdf',
        kind: 'file',
        s3Key: pdfKey,
        contentType: 'application/pdf',
        fileSize: pdfContent.length,
        processingStatus: 'ready',
        folderId: opticsFolder.id,
        rawText: 'Bell theorem proves that no local hidden-variable theories can reproduce quantum predictions.',
      });

      // Add version, segment, and chunk for file source
      const [fileVersion] = await db
        .insert(appSchema.sourceVersions)
        .values({
          sourceId: fileSource.id,
          contentHash: 'hash-bell-1234',
          extractorId: 'pdf-extractor',
          extractorVersion: '1.0.0',
          normalizationVersion: 1,
          status: 'ready',
        })
        .returning();

      const [fileSegment] = await db
        .insert(appSchema.sourceSegments)
        .values({
          sourceVersionId: fileVersion.id,
          ordinal: 0,
          kind: 'text',
          content: 'Bell theorem proves non-locality.',
        })
        .returning();

      const embeddingVector = new Array(1024).fill(0.042);
      await db.insert(appSchema.sourceChunks).values({
        sourceId: fileSource.id,
        notebookId: originalNotebook.id,
        chunkIndex: 0,
        sourceVersionId: fileVersion.id,
        segmentIds: [fileSegment.id],
        content: 'Bell theorem proves non-locality.',
        searchableText: 'bell theorem non-locality quantum physics',
        sourceKind: 'file',
        embedding: embeddingVector,
      });

      // Text source
      const textSource = await seedSource(originalNotebook.id, {
        title: 'Schrodinger Notes',
        kind: 'text',
        folderId: physicsFolder.id,
        rawText: 'Superposition describes the linear combination of states.',
        processingStatus: 'ready',
      });

      // URL source (unfiled root)
      const urlSource = await seedSource(originalNotebook.id, {
        title: 'Quantum Portal',
        kind: 'url',
        folderId: null,
        url: 'https://quantum.example.com/entanglement',
        rawText: 'Online portal for quantum phenomena.',
        processingStatus: 'ready',
      });

      // 5. Arrange: Study material folder and items (flashcards, quiz, mind map)
      const smFolder = await seedStudyMaterialFolder(originalNotebook.id, {
        name: 'Unit 1 Assessments',
      });

      const flashcards = await seedStudyMaterial(originalNotebook.id, {
        title: 'QED Flashcards',
        kind: 'simple_flashcard',
        folderId: smFolder.id,
        content: {
          cards: [
            { front: 'What is a positron?', back: 'The antimatter counterpart of an electron' },
            { front: 'What is fine-structure constant?', back: 'Approximately 1/137' },
          ],
        },
      });

      const quiz = await seedStudyMaterial(originalNotebook.id, {
        title: 'Photon Polarization Quiz',
        kind: 'quiz',
        folderId: smFolder.id,
        content: {
          questions: [
            {
              question: 'Can entangled photons communicate faster than light?',
              options: ['No, no information can be sent', 'Yes, instantly', 'Only in vacuum'],
              correctIndex: 0,
            },
          ],
        },
      });

      const mindMap = await seedStudyMaterial(originalNotebook.id, {
        title: 'Quantum Theory Map',
        kind: 'mind_map',
        folderId: null,
        content: {
          nodes: [
            { id: 'n1', label: 'Quantum Mechanics' },
            { id: 'n2', label: 'Entanglement' },
          ],
          edges: [{ from: 'n1', to: 'n2' }],
        },
      });

      // 6. Arrange: Chat messages on original notebook (CRITICAL: MUST NOT BE EXPORTED)
      await db.insert(appSchema.notebookChatMessages).values([
        {
          notebookId: originalNotebook.id,
          role: 'user',
          content: 'Can you summarize Bell inequalities for me?',
        },
        {
          notebookId: originalNotebook.id,
          role: 'assistant',
          content: 'Bell inequalities provide a mathematical threshold to test quantum entanglement.',
        },
      ]);

      // -------------------------------------------------------------
      // 7. Act: Export through Controller
      // -------------------------------------------------------------
      const { res, headers, getBuffer } = createMockResponse();
      const exportPromise = controller.export(originalNotebook.id, res);
      const [exportBuffer] = await Promise.all([getBuffer(), exportPromise]);

      // Assert export headers
      expect(headers['content-type']).toBe('application/octet-stream');
      expect(headers['content-disposition']).toContain('Quantum-Field-Theory.memsys');
      expect(exportBuffer.length).toBeGreaterThan(0);

      // -------------------------------------------------------------
      // 8. Assert: Inspect .memsys Zip Structure & Chat State Omission
      // -------------------------------------------------------------
      const zip = await JSZip.loadAsync(exportBuffer);

      // Verify manifest
      const manifestFile = zip.file('manifest.json');
      expect(manifestFile).not.toBeNull();
      const manifest = JSON.parse(await manifestFile!.async('string'));
      expect(manifest.format).toBe('memsys');
      expect(manifest.version).toBe(1);
      expect(manifest.title).toBe('Quantum Field Theory');
      expect(manifest.stats).toEqual({
        sourceFoldersCount: 2,
        sourcesCount: 3,
        sourceVersionsCount: 1,
        sourceSegmentsCount: 1,
        sourceChunksCount: 1,
        studyMaterialFoldersCount: 1,
        studyMaterialsCount: 3,
        blobsCount: 2, // banner + file source blob
      });

      // Verify notebook.json
      const notebookFile = zip.file('notebook.json');
      expect(notebookFile).not.toBeNull();
      const notebookJson = JSON.parse(await notebookFile!.async('string'));
      expect(notebookJson.title).toBe('Quantum Field Theory');
      expect(notebookJson.description).toBe('Comprehensive study notes on quantum electrodynamics');
      expect(notebookJson.icon).toBe('atom');
      expect(notebookJson.groundingMode).toBe('moderate');
      expect(notebookJson.bannerFocalPoint).toEqual({ x: 0.42, y: 0.88 });
      expect(notebookJson.bannerFile).toBe('blobs/banner.webp');

      // Verify blobs in zip
      const bannerZipEntry = zip.file('blobs/banner.webp');
      expect(bannerZipEntry).not.toBeNull();
      const extractedBannerBuffer = await bannerZipEntry!.async('nodebuffer');
      expect(extractedBannerBuffer.equals(bannerContent)).toBe(true);

      const sourceZipEntry = zip.file(`blobs/source-${fileSource.id}.pdf`);
      expect(sourceZipEntry).not.toBeNull();
      const extractedPdfBuffer = await sourceZipEntry!.async('nodebuffer');
      expect(extractedPdfBuffer.equals(pdfContent)).toBe(true);

      // Strict chat exclusion check: No chat files in the zip archive
      const allZipPaths = Object.keys(zip.files);
      const chatRelatedFiles = allZipPaths.filter(
        (p) => p.toLowerCase().includes('chat') || p.toLowerCase().includes('message'),
      );
      expect(chatRelatedFiles).toEqual([]);

      // -------------------------------------------------------------
      // 9. Act: Import into Target Folder through Controller
      // -------------------------------------------------------------
      const multerFile = createMulterFile(exportBuffer, 'Quantum-Field-Theory.memsys');
      const imported = await controller.import(multerFile, targetFolder.id);

      // -------------------------------------------------------------
      // 10. Assert: Complete Database Verification of Imported Notebook
      // -------------------------------------------------------------
      // Fresh notebook entity
      expect(imported.id).toBeDefined();
      expect(imported.id).not.toBe(originalNotebook.id);
      expect(imported.title).toBe('Quantum Field Theory');
      expect(imported.folderId).toBe(targetFolder.id);

      const [importedRow] = await db
        .select()
        .from(appSchema.notebooks)
        .where(eq(appSchema.notebooks.id, imported.id));
      expect(importedRow).toBeDefined();
      expect(importedRow.description).toBe('Comprehensive study notes on quantum electrodynamics');
      expect(importedRow.icon).toBe('atom');
      expect(importedRow.groundingMode).toBe('moderate');
      expect(importedRow.bannerFocalPoint).toEqual({ x: 0.42, y: 0.88 });

      // Restored banner blob with fresh storage key
      expect(importedRow.banner).not.toBeNull();
      expect(importedRow.banner).not.toBe(bannerKey);
      expect(await storageService.objectExists(importedRow.banner!)).toBe(true);
      const restoredBannerStream = await storageService.getObjectStream(importedRow.banner!);
      const bannerChunks: Buffer[] = [];
      for await (const chunk of restoredBannerStream) {
        bannerChunks.push(Buffer.from(chunk));
      }
      expect(Buffer.concat(bannerChunks).equals(bannerContent)).toBe(true);

      // Source Folders (hierarchy preserved: Child -> Parent)
      const importedSourceFolders = await db
        .select()
        .from(appSchema.sourceFolders)
        .where(eq(appSchema.sourceFolders.notebookId, imported.id));
      expect(importedSourceFolders).toHaveLength(2);

      const importedPhysics = importedSourceFolders.find((f) => f.name === 'Physics Basics')!;
      const importedOptics = importedSourceFolders.find((f) => f.name === 'Quantum Optics')!;
      expect(importedPhysics).toBeDefined();
      expect(importedOptics).toBeDefined();
      expect(importedPhysics.id).not.toBe(physicsFolder.id);
      expect(importedOptics.id).not.toBe(opticsFolder.id);
      expect(importedPhysics.parentId).toBeNull();
      expect(importedOptics.parentId).toBe(importedPhysics.id); // Parent relationship remapped correctly

      // Sources
      const importedSources = await db
        .select()
        .from(appSchema.sources)
        .where(eq(appSchema.sources.notebookId, imported.id));
      expect(importedSources).toHaveLength(3);

      const importedFileSrc = importedSources.find((s) => s.kind === 'file')!;
      const importedTextSrc = importedSources.find((s) => s.kind === 'text')!;
      const importedUrlSrc = importedSources.find((s) => s.kind === 'url')!;

      expect(importedFileSrc).toBeDefined();
      expect(importedFileSrc.id).not.toBe(fileSource.id);
      expect(importedFileSrc.folderId).toBe(importedOptics.id); // Re-linked to imported child folder
      expect(importedFileSrc.s3Key).not.toBeNull();
      expect(importedFileSrc.s3Key).not.toBe(pdfKey); // Fresh storage key
      expect(await storageService.objectExists(importedFileSrc.s3Key!)).toBe(true);

      // Source blob buffer verification
      const restoredPdfStream = await storageService.getObjectStream(importedFileSrc.s3Key!);
      const pdfChunks: Buffer[] = [];
      for await (const chunk of restoredPdfStream) {
        pdfChunks.push(Buffer.from(chunk));
      }
      expect(Buffer.concat(pdfChunks).equals(pdfContent)).toBe(true);

      expect(importedTextSrc).toBeDefined();
      expect(importedTextSrc.id).not.toBe(textSource.id);
      expect(importedTextSrc.folderId).toBe(importedPhysics.id); // Re-linked to imported parent folder
      expect(importedTextSrc.rawText).toBe('Superposition describes the linear combination of states.');

      expect(importedUrlSrc).toBeDefined();
      expect(importedUrlSrc.id).not.toBe(urlSource.id);
      expect(importedUrlSrc.folderId).toBeNull();
      expect(importedUrlSrc.url).toBe('https://quantum.example.com/entanglement');

      // Source Versions, Segments & Chunks
      const importedVersions = await db
        .select()
        .from(appSchema.sourceVersions)
        .where(eq(appSchema.sourceVersions.sourceId, importedFileSrc.id));
      expect(importedVersions).toHaveLength(1);
      const importedVersion = importedVersions[0];
      expect(importedVersion.id).not.toBe(fileVersion.id);
      expect(importedVersion.contentHash).toBe('hash-bell-1234');

      const importedSegments = await db
        .select()
        .from(appSchema.sourceSegments)
        .where(eq(appSchema.sourceSegments.sourceVersionId, importedVersion.id));
      expect(importedSegments).toHaveLength(1);
      const importedSegment = importedSegments[0];
      expect(importedSegment.id).not.toBe(fileSegment.id);
      expect(importedSegment.content).toBe('Bell theorem proves non-locality.');

      const importedChunks = await db
        .select()
        .from(appSchema.sourceChunks)
        .where(eq(appSchema.sourceChunks.notebookId, imported.id));
      expect(importedChunks).toHaveLength(1);
      const importedChunk = importedChunks[0];
      expect(importedChunk.sourceId).toBe(importedFileSrc.id);
      expect(importedChunk.sourceVersionId).toBe(importedVersion.id);
      expect(importedChunk.segmentIds).toEqual([importedSegment.id]); // Remapped to fresh segment ID
      expect(importedChunk.content).toBe('Bell theorem proves non-locality.');
      expect(importedChunk.searchableText).toBe('bell theorem non-locality quantum physics');
      expect(importedChunk.embedding).toBeDefined();
      expect(importedChunk.embedding).toHaveLength(1024);

      // Study Material Folders & Items
      const importedSmFolders = await db
        .select()
        .from(appSchema.studyMaterialFolders)
        .where(eq(appSchema.studyMaterialFolders.notebookId, imported.id));
      expect(importedSmFolders).toHaveLength(1);
      const importedSmFolder = importedSmFolders[0];
      expect(importedSmFolder.id).not.toBe(smFolder.id);
      expect(importedSmFolder.name).toBe('Unit 1 Assessments');

      const importedMaterials = await db
        .select()
        .from(appSchema.studyMaterials)
        .where(eq(appSchema.studyMaterials.notebookId, imported.id));
      expect(importedMaterials).toHaveLength(3);

      const importedFlashcard = importedMaterials.find((m) => m.kind === 'simple_flashcard')!;
      const importedQuiz = importedMaterials.find((m) => m.kind === 'quiz')!;
      const importedMindMap = importedMaterials.find((m) => m.kind === 'mind_map')!;

      expect(importedFlashcard).toBeDefined();
      expect(importedFlashcard.id).not.toBe(flashcards.id);
      expect(importedFlashcard.folderId).toBe(importedSmFolder.id);
      expect(importedFlashcard.content).toEqual({
        cards: [
          { front: 'What is a positron?', back: 'The antimatter counterpart of an electron' },
          { front: 'What is fine-structure constant?', back: 'Approximately 1/137' },
        ],
      });

      expect(importedQuiz).toBeDefined();
      expect(importedQuiz.id).not.toBe(quiz.id);
      expect(importedQuiz.folderId).toBe(importedSmFolder.id);
      expect(importedQuiz.content).toEqual({
        questions: [
          {
            question: 'Can entangled photons communicate faster than light?',
            options: ['No, no information can be sent', 'Yes, instantly', 'Only in vacuum'],
            correctIndex: 0,
          },
        ],
      });

      expect(importedMindMap).toBeDefined();
      expect(importedMindMap.id).not.toBe(mindMap.id);
      expect(importedMindMap.folderId).toBeNull();
      expect(importedMindMap.content).toEqual({
        nodes: [
          { id: 'n1', label: 'Quantum Mechanics' },
          { id: 'n2', label: 'Entanglement' },
        ],
        edges: [{ from: 'n1', to: 'n2' }],
      });

      // Strict Chat Verification in Database:
      // Absolutely ZERO chat messages should exist for the imported notebook!
      const importedChatMessages = await db
        .select()
        .from(appSchema.notebookChatMessages)
        .where(eq(appSchema.notebookChatMessages.notebookId, imported.id));
      expect(importedChatMessages).toHaveLength(0);
    });
  });

  describe('Edge Cases & Resiliency', () => {
    it('handles minimal notebooks with missing optional fields (no banner, no description, no icon, empty collections)', async () => {
      // Create minimal notebook
      const minimalNotebook = await seedNotebook({
        title: 'Bare Minimum Notebook',
        description: '',
        banner: null,
      });

      // Export
      const { res, getBuffer } = createMockResponse();
      const exportPromise = controller.export(minimalNotebook.id, res);
      const [minimalBuffer] = await Promise.all([getBuffer(), exportPromise]);

      // Verify manifest stats are all zeros
      const zip = await JSZip.loadAsync(minimalBuffer);
      const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
      expect(manifest.stats).toEqual({
        sourceFoldersCount: 0,
        sourcesCount: 0,
        sourceVersionsCount: 0,
        sourceSegmentsCount: 0,
        sourceChunksCount: 0,
        studyMaterialFoldersCount: 0,
        studyMaterialsCount: 0,
        blobsCount: 0,
      });

      // Import into root
      const multerFile = createMulterFile(minimalBuffer, 'Bare-Minimum.memsys');
      const importedMinimal = await controller.import(multerFile);

      expect(importedMinimal.id).toBeDefined();
      expect(importedMinimal.title).toBe('Bare Minimum Notebook');
      expect(importedMinimal.description).toBe('');
      expect(importedMinimal.banner).toBeNull();
      expect(importedMinimal.folderId).toBeNull();

      // Verify DB counts are 0
      const sourcesCount = await db
        .select()
        .from(appSchema.sources)
        .where(eq(appSchema.sources.notebookId, importedMinimal.id));
      expect(sourcesCount).toHaveLength(0);

      const materialsCount = await db
        .select()
        .from(appSchema.studyMaterials)
        .where(eq(appSchema.studyMaterials.notebookId, importedMinimal.id));
      expect(materialsCount).toHaveLength(0);
    });

    it('rejects corrupt non-zip file uploads with BadRequestError', async () => {
      const corruptFile = createMulterFile(
        Buffer.from('This is clearly plain text and not a zip archive'),
        'corrupt.memsys',
      );
      await expect(controller.import(corruptFile)).rejects.toThrow(
        /not a valid zip archive/i,
      );
    });

    it('rejects zip archives missing manifest.json', async () => {
      const zip = new JSZip();
      zip.file('notebook.json', JSON.stringify({ title: 'Orphan Notebook' }));
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const missingManifestFile = createMulterFile(buffer, 'no-manifest.memsys');
      await expect(controller.import(missingManifestFile)).rejects.toThrow(
        /missing manifest\.json/i,
      );
    });

    it('rejects zip archives with unsupported archive format', async () => {
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({ version: 1, format: 'unknown_format' }));
      zip.file('notebook.json', JSON.stringify({ title: 'Test' }));
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const invalidFormatFile = createMulterFile(buffer, 'wrong-format.memsys');
      await expect(controller.import(invalidFormatFile)).rejects.toThrow(
        /unsupported archive format/i,
      );
    });

    it('rejects zip archives missing notebook.json', async () => {
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({ version: 1, format: 'memsys' }));
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const missingNotebookFile = createMulterFile(buffer, 'no-notebook.memsys');
      await expect(controller.import(missingNotebookFile)).rejects.toThrow(
        /missing notebook\.json/i,
      );
    });

    it('rejects zip archives with malformed/corrupt notebook.json', async () => {
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({ version: 1, format: 'memsys' }));
      zip.file('notebook.json', '{ this is not valid JSON }');
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const corruptJsonFile = createMulterFile(buffer, 'bad-json.memsys');
      await expect(controller.import(corruptJsonFile)).rejects.toThrow(
        /corrupt notebook\.json/i,
      );
    });

    it('rejects archives where notebook.json has an empty or missing title', async () => {
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({ version: 1, format: 'memsys' }));
      zip.file('notebook.json', JSON.stringify({ description: 'No title provided' }));
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const noTitleFile = createMulterFile(buffer, 'no-title.memsys');
      await expect(controller.import(noTitleFile)).rejects.toThrow(
        /missing or invalid title/i,
      );
    });

    it('gracefully recovers when a declared blob file is missing from the archive', async () => {
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({ version: 1, format: 'memsys' }));
      zip.file(
        'notebook.json',
        JSON.stringify({
          title: 'Missing Blob Test',
          bannerFile: 'blobs/missing-banner.webp',
        }),
      );
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const missingBlobFile = createMulterFile(buffer, 'missing-blob.memsys');
      const imported = await controller.import(missingBlobFile);

      expect(imported.id).toBeDefined();
      expect(imported.title).toBe('Missing Blob Test');
      expect(imported.banner).toBeNull(); // Gracefully fell back to null banner
    });

    it('falls back to default grounding mode when an unrecognized mode is in notebook.json', async () => {
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({ version: 1, format: 'memsys' }));
      zip.file(
        'notebook.json',
        JSON.stringify({
          title: 'Invalid Grounding Mode Notebook',
          groundingMode: 'super_extra_strict_nonexistent_mode',
        }),
      );
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const invalidModeFile = createMulterFile(buffer, 'invalid-mode.memsys');
      const imported = await controller.import(invalidModeFile);

      expect(imported.groundingMode).toBe('strict'); // Safely fell back to default
    });

    it('falls back to root when target folderId does not exist', async () => {
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({ version: 1, format: 'memsys' }));
      zip.file('notebook.json', JSON.stringify({ title: 'Unparented Notebook' }));
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const file = createMulterFile(buffer, 'unparented.memsys');
      const imported = await controller.import(file, 'non-existent-folder-cuid');

      expect(imported.folderId).toBeNull();
    });

    it('throws BadRequestError when no file is uploaded to the import controller endpoint', async () => {
      await expect(controller.import(undefined)).rejects.toThrow(
        /file is required/i,
      );
    });
  });
});
