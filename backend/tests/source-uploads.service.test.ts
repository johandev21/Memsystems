/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, resetDatabase } from './db';
import { notebooks, sourceUploadIntents } from '../src/database/schema';
import { StorageService } from '../src/modules/storage/storage.service';
import { SourceUploadsService } from '../src/modules/sources/source-uploads.service';
import { seedNotebook } from './fixtures';

const directories: string[] = [];

function makeService(directory: string) {
  const storage = new StorageService({
    get: (key: string) => (key === 'DEV_STORAGE_DIR' ? directory : undefined),
  } as any);
  const notebooks = { assertNotebookOwner: () => Promise.resolve() } as any;
  const extraction = { isSupportedFile: () => true } as any;
  const sources = {
    createFileFromArtifact: (_notebook: string, input: unknown) => ({
      id: 'source-1',
      ...((input as object) ?? {}),
    }),
  } as any;
  return new SourceUploadsService(db, notebooks, storage, extraction, sources);
}

async function newDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'memsystems-upload-'));
  directories.push(directory);
  return directory;
}

function requestFrom(content: Buffer, contentLength?: number) {
  const request = Readable.from(content);
  (request as any).headers =
    contentLength === undefined
      ? {}
      : { 'content-length': String(contentLength) };
  return request;
}

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('SourceUploadsService', () => {
  it('streams a local upload and finalizes only the issued target', async () => {
    const service = makeService(await newDirectory());
    const notebook = await seedNotebook();
    const content = Buffer.from('bounded upload');
    const target = await service.createTarget(notebook.id, {
      filename: 'notes.txt',
      contentType: 'text/plain',
      size: content.length,
    });

    await service.uploadLocal(
      target.uploadId,
      requestFrom(content, content.length) as any,
    );
    const source = await service.finalize(notebook.id, target.uploadId);

    expect(source).toMatchObject({
      id: 'source-1',
      artifactKey: `pending-sources/${target.uploadId}`,
    });
    const [intent] = await db
      .select()
      .from(sourceUploadIntents)
      .where(eq(sourceUploadIntents.id, target.uploadId));
    expect(intent).toMatchObject({
      notebookId: notebook.id,
      status: 'consumed',
      uploadedBytes: content.length,
    });
    expect(intent?.consumedAt).toBeInstanceOf(Date);
  });

  it('rejects finalizing a target from another notebook', async () => {
    const service = makeService(await newDirectory());
    const notebook = await seedNotebook();
    const otherNotebook = await seedNotebook();
    const target = await service.createTarget(notebook.id, {
      filename: 'notes.txt',
      contentType: 'text/plain',
      size: 1,
    });

    await expect(
      service.finalize(otherNotebook.id, target.uploadId),
    ).rejects.toThrow('does not belong to this notebook');
  });

  it('rejects a stream whose bytes exceed the declared target', async () => {
    const service = makeService(await newDirectory());
    const notebook = await seedNotebook();
    const target = await service.createTarget(notebook.id, {
      filename: 'notes.txt',
      contentType: 'text/plain',
      size: 1,
    });

    await expect(
      service.uploadLocal(
        target.uploadId,
        requestFrom(Buffer.from('xx'), 2) as any,
      ),
    ).rejects.toThrow('does not match');
  });

  it('can finalize a completed upload after the service is recreated', async () => {
    const directory = await newDirectory();
    const service = makeService(directory);
    const notebook = await seedNotebook();
    const content = Buffer.from('durable upload');
    const target = await service.createTarget(notebook.id, {
      filename: 'notes.txt',
      contentType: 'text/plain',
      size: content.length,
    });
    await service.uploadLocal(
      target.uploadId,
      requestFrom(content, content.length) as any,
    );

    const recreated = makeService(directory);
    await expect(
      recreated.finalize(notebook.id, target.uploadId),
    ).resolves.toMatchObject({ id: 'source-1' });
  });

  it('allows only one concurrent finalizer to consume an intent', async () => {
    const directory = await newDirectory();
    const service = makeService(directory);
    const notebook = await seedNotebook();
    const content = Buffer.from('one time');
    const target = await service.createTarget(notebook.id, {
      filename: 'notes.txt',
      contentType: 'text/plain',
      size: content.length,
    });
    await service.uploadLocal(
      target.uploadId,
      requestFrom(content, content.length) as any,
    );

    const results = await Promise.allSettled([
      service.finalize(notebook.id, target.uploadId),
      service.finalize(notebook.id, target.uploadId),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === 'rejected'),
    ).toMatchObject({
      reason: expect.objectContaining({
        message: expect.stringContaining('finalized'),
      }),
    });
  });

  it('enforces 20 MB MAX_IMAGE_BYTES limit for images while allowing up to 50 MB for documents', async () => {
    const service = makeService(await newDirectory());
    const notebook = await seedNotebook();

    // Image exceeding 20 MB must fail
    await expect(
      service.createTarget(notebook.id, {
        filename: 'large.png',
        contentType: 'image/png',
        size: 20 * 1024 * 1024 + 1,
      }),
    ).rejects.toThrow('Upload exceeds maximum size of 20971520 bytes');

    // Image within 20 MB succeeds
    const imageTarget = await service.createTarget(notebook.id, {
      filename: 'valid.png',
      contentType: 'image/png',
      size: 20 * 1024 * 1024,
    });
    expect(imageTarget.maxBytes).toBe(20 * 1024 * 1024);

    // Document larger than 20 MB but <= 50 MB succeeds
    const docTarget = await service.createTarget(notebook.id, {
      filename: 'large.pdf',
      contentType: 'application/pdf',
      size: 30 * 1024 * 1024,
    });
    expect(docTarget.maxBytes).toBe(50 * 1024 * 1024);
  });

  it('enforces 500 MB MAX_AUDIO_BYTES limit for audio files', async () => {
    const service = makeService(await newDirectory());
    const notebook = await seedNotebook();

    // Audio exceeding 500 MB must fail
    await expect(
      service.createTarget(notebook.id, {
        filename: 'huge.mp3',
        contentType: 'audio/mpeg',
        size: 500 * 1024 * 1024 + 1,
      }),
    ).rejects.toThrow('Upload exceeds maximum size of 524288000 bytes');

    // Audio within 500 MB (e.g. 100 MB) succeeds
    const audioTarget = await service.createTarget(notebook.id, {
      filename: 'lecture.mp3',
      contentType: 'audio/mpeg',
      size: 100 * 1024 * 1024,
    });
    expect(audioTarget.maxBytes).toBe(500 * 1024 * 1024);
  });
});
