import { describe, expect, it } from 'vitest';
import { PassThrough } from 'node:stream';
import JSZip from 'jszip';
import { NotebookExportService } from '../../src/modules/notebooks/notebook-export.service';
import { StorageService } from '../../src/modules/storage/storage.service';
import {
  seedNotebook,
  seedSource,
  seedSourceFolder,
  seedStudyMaterial,
  seedStudyMaterialFolder,
} from '../fixtures';
import { db } from '../db';
import { notebookChatMessages } from '../../src/database/schema';

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

describe('NotebookExportService Integration Tests', () => {
  const mockConfigService = {
    get: (key: string) => {
      if (key === 'DEV_STORAGE_TOKEN_SECRET') return 'dev-storage-secret-test';
      return undefined;
    },
  } as any;
  const storageService = new StorageService(mockConfigService);
  const exportService = new NotebookExportService(db as any, storageService);

  it('throws NotFoundError for non-existent notebook', async () => {
    const { res } = createMockResponse();
    await expect(
      exportService.exportNotebook('non-existent-id', res),
    ).rejects.toThrow('Notebook');
  });

  it('streams a valid .memsys zip archive containing sources, materials, and layout, but NO chat messages', async () => {
    const notebook = await seedNotebook({
      title: 'Quantum Computing 101',
      description: 'Introductory notes on qubits and superposition',
    });

    // Seed source folder & source
    const sFolder = await seedSourceFolder(notebook.id, {
      name: 'Foundations',
    });
    await seedSource(notebook.id, {
      title: 'Qubit Intro',
      kind: 'text',
      rawText: 'A qubit is the basic unit of quantum information.',
      folderId: sFolder.id,
    });

    // Seed study material folder & material
    const smFolder = await seedStudyMaterialFolder(notebook.id, {
      name: 'Quizzes',
    });
    await seedStudyMaterial(notebook.id, {
      title: 'Qubit Gates Quiz',
      kind: 'quiz',
      folderId: smFolder.id,
      content: {
        questions: [
          {
            question: 'What is a Hadamard gate?',
            options: ['Creates superposition', 'Flips bit', 'Measures state'],
            correctIndex: 0,
          },
        ],
      },
    });

    // Seed a chat message (which must be excluded from export)
    await db.insert(notebookChatMessages).values({
      notebookId: notebook.id,
      role: 'user',
      content: 'Can you explain what a Hadamard gate does?',
    });

    const { res, headers, getBuffer } = createMockResponse();
    const exportPromise = exportService.exportNotebook(notebook.id, res);

    const [zipBuffer] = await Promise.all([getBuffer(), exportPromise]);

    // Check HTTP headers
    expect(headers['content-type']).toBe('application/octet-stream');
    expect(headers['content-disposition']).toContain('attachment');
    expect(headers['content-disposition']).toContain(
      'Quantum-Computing-101.memsys',
    );

    // Verify it is a valid non-empty zip archive by checking zip local file header magic signature PK\x03\x04
    expect(zipBuffer.length).toBeGreaterThan(100);
    expect(zipBuffer[0]).toBe(0x50); // 'P'
    expect(zipBuffer[1]).toBe(0x4b); // 'K'
    expect(zipBuffer[2]).toBe(0x03);
    expect(zipBuffer[3]).toBe(0x04);

    // Verify zip contents using JSZip
    const zip = await JSZip.loadAsync(zipBuffer);

    expect(zip.file('manifest.json')).not.toBeNull();
    expect(zip.file('notebook.json')).not.toBeNull();
    expect(zip.file('sources/folders.json')).not.toBeNull();
    expect(zip.file('sources/sources.json')).not.toBeNull();
    expect(zip.file('sources/versions.json')).not.toBeNull();
    expect(zip.file('sources/segments.json')).not.toBeNull();
    expect(zip.file('sources/chunks.json')).not.toBeNull();
    expect(zip.file('study-materials/folders.json')).not.toBeNull();
    expect(zip.file('study-materials/items.json')).not.toBeNull();

    const manifest = JSON.parse(
      await zip.file('manifest.json')!.async('string'),
    );
    expect(manifest.format).toBe('memsys');
    expect(manifest.title).toBe('Quantum Computing 101');
    expect(manifest.stats.sourcesCount).toBe(1);
    expect(manifest.stats.studyMaterialsCount).toBe(1);

    const notebookJson = JSON.parse(
      await zip.file('notebook.json')!.async('string'),
    );
    expect(notebookJson.title).toBe('Quantum Computing 101');
    expect(notebookJson.layout.panelSizes).toEqual({
      sources: 20,
      chat: 60,
      studio: 20,
    });

    const sourcesJson = JSON.parse(
      await zip.file('sources/sources.json')!.async('string'),
    );
    expect(sourcesJson).toHaveLength(1);
    expect(sourcesJson[0].title).toBe('Qubit Intro');
    expect(sourcesJson[0].rawText).toContain(
      'basic unit of quantum information',
    );

    const smJson = JSON.parse(
      await zip.file('study-materials/items.json')!.async('string'),
    );
    expect(smJson).toHaveLength(1);
    expect(smJson[0].title).toBe('Qubit Gates Quiz');

    // Confirm that chat messages are NOT anywhere in the zip
    const allFiles = Object.keys(zip.files);
    expect(allFiles.some((f) => f.includes('chat'))).toBe(false);

    for (const filename of allFiles) {
      const fileContent = await zip.file(filename)?.async('string');
      if (fileContent) {
        expect(fileContent).not.toContain(
          'Can you explain what a Hadamard gate does?',
        );
      }
    }
  });
});
