import { describe, expect, it } from 'vitest';
import { PassThrough } from 'node:stream';
import { eq } from 'drizzle-orm';
import JSZip from 'jszip';
import { studyMaterialAudio, studyMaterials } from '../../src/database/schema';
import { StudyMaterialService } from '../../src/modules/study-materials/study-material.service';
import { NotebooksService } from '../../src/modules/notebooks/notebooks.service';
import { NotebookExportService } from '../../src/modules/notebooks/notebook-export.service';
import { NotebookImportService } from '../../src/modules/notebooks/notebook-import.service';
import { StorageService } from '../../src/modules/storage/storage.service';
import { seedNotebook } from '../fixtures';
import { db } from '../db';

const wav = Buffer.from('RIFF\x24\x00\x00\x00WAVEfmt ');

function createMockResponse() {
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  const response: any = stream;
  response.setHeader = () => undefined;
  response.getHeader = () => undefined;
  response.headersSent = false;
  return {
    response,
    buffer: new Promise<Buffer>((resolve, reject) => {
      stream.on('finish', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    }),
  };
}

describe('Audio Overview material lifecycle', () => {
  const storage = new StorageService({ get: () => 'test-secret' } as any);
  const notebooks = new NotebooksService(db as any, storage);
  const materials = new StudyMaterialService(db as any, notebooks);

  const content = {
    title: 'Cellular respiration',
    transcript: 'Cells release energy from glucose. [ref:R1]',
    citations: [],
    metadata: { language: 'en' },
  };

  it('persists audio with its material, duplicates independent bytes, and hides deleted audio', async () => {
    const notebook = await seedNotebook();
    const original = await materials.createAudioOverview(
      notebook.id,
      { title: content.title, content },
      wav,
    );
    expect(await materials.getAudio(original.id)).toMatchObject({
      audio: wav,
      contentType: 'audio/wav',
    });

    const duplicate = await materials.duplicate(original.id);
    expect(duplicate.title).toBe('Cellular respiration copy');
    expect(await materials.getAudio(duplicate.id)).toMatchObject({
      audio: wav,
      contentType: 'audio/wav',
    });

    await materials.delete(original.id);
    await expect(materials.getAudio(original.id)).rejects.toThrow();
    expect(await materials.getAudio(duplicate.id)).toMatchObject({ audio: wav });
  });

  it('rejects audio lookup for an unknown material and does not duplicate a deleted item', async () => {
    const notebook = await seedNotebook();
    const material = await materials.createAudioOverview(
      notebook.id,
      { title: content.title, content },
      wav,
    );
    await materials.delete(material.id);

    await expect(materials.getAudio('missing-material')).rejects.toThrow();
    await expect(materials.duplicate(material.id)).rejects.toThrow();
  });

  it('keeps audio in the dedicated asset row and material content in the database', async () => {
    const notebook = await seedNotebook();
    const material = await materials.createAudioOverview(
      notebook.id,
      { title: content.title, content },
      wav,
    );
    const [storedMaterial] = await db
      .select()
      .from(studyMaterials)
      .where(eq(studyMaterials.id, material.id));
    const [storedAudio] = await db
      .select()
      .from(studyMaterialAudio)
      .where(eq(studyMaterialAudio.studyMaterialId, material.id));

    expect(storedMaterial.content).toMatchObject({ transcript: content.transcript });
    expect(storedAudio.audio).toEqual(wav);
    expect(storedAudio.contentType).toBe('audio/wav');
  });

  it('exports and imports the WAV asset with a remapped material ID', async () => {
    const notebook = await seedNotebook();
    const material = await materials.createAudioOverview(
      notebook.id,
      { title: content.title, content },
      wav,
    );
    const exporter = new NotebookExportService(db as any, storage);
    const importer = new NotebookImportService(db as any, storage, notebooks);
    const { response, buffer } = createMockResponse();

    const exported = exporter.exportNotebook(notebook.id, response);
    const archiveBuffer = await buffer;
    await exported;
    const archive = await JSZip.loadAsync(archiveBuffer);
    const items = JSON.parse(await archive.file('study-materials/items.json')!.async('string'));
    const audioPath = items.find((item: { id: string }) => item.id === material.id).audioFile;
    expect(await archive.file(audioPath)!.async('nodebuffer')).toEqual(wav);

    const importedNotebook = await importer.importNotebook(archiveBuffer);
    const importedItems = await materials.list(importedNotebook.id);
    expect(importedItems).toHaveLength(1);
    expect(importedItems[0].id).not.toBe(material.id);
    expect(importedItems[0].content).toMatchObject({ transcript: content.transcript });
    expect(await materials.getAudio(importedItems[0].id)).toMatchObject({ audio: wav });
  });
});
