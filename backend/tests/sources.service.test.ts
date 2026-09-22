import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import {
  sourceChunks,
  sourceIndexJobs,
  sourceSegments,
  sources,
  sourceVersions,
} from '../src/database/schema';
import { EMBEDDING_DIMENSIONS } from '../src/modules/ai/embedding.service';
import { NotebooksService } from '../src/modules/notebooks/notebooks.service';
import { StorageService } from '../src/modules/storage/storage.service';
import { SourceExtractionService } from '../src/modules/sources/source-extraction.service';
import { SourceVersionService } from '../src/modules/sources/source-version.service';
import { SourcesService } from '../src/modules/sources/sources.service';
import { seedNotebook, seedSource } from './fixtures';
import { db } from './db';

function mockStorageService() {
  const s = new StorageService({
    get: (key: string) => {
      if (key === 'DEV_STORAGE_TOKEN_SECRET') return 'dev-storage-secret-test';
      return undefined;
    },
  } as any);
  vi.spyOn(s, 'objectMetadata').mockResolvedValue({
    contentLength: 1024,
    metadata: {},
  });
  return s;
}

function createSourcesService(
  overrides: { acquisition?: any; jobs?: any } = {},
) {
  const notebooksService = new NotebooksService(
    db as any,
    mockStorageService(),
  );
  const acquisition = overrides.acquisition ?? {
    acquireUrl: vi.fn(),
    acquireFile: vi.fn(),
    fromText: vi.fn().mockImplementation((rawText: string, title: string) => ({
      title,
      text: rawText.replace(/\n{3,}/g, '\n\n').trim(),
      contentHash: 'ab12'.repeat(16),
      extractionMethod: 'text',
      sections: [],
    })),
  };
  const jobs = overrides.jobs ?? {
    enqueue: vi.fn().mockResolvedValue({ id: 'job-1' }),
    cancelForSource: vi.fn().mockResolvedValue(undefined),
    latestForSource: vi.fn().mockResolvedValue(null),
    reindexNotebook: vi.fn().mockResolvedValue(0),
  };
  const sourceVersionService = new SourceVersionService(db as any);
  const service = new SourcesService(
    db as any,
    notebooksService,
    mockStorageService(),
    acquisition,
    jobs,
    new SourceExtractionService(),
    sourceVersionService,
  );
  return { db, service, notebooksService, acquisition, jobs };
}

describe.sequential('SourcesService', () => {
  it('createText normalizes content, hashes it and enqueues indexing', async () => {
    const { service, jobs, db } = createSourcesService();
    const notebook = await seedNotebook();

    const row = await service.createText(notebook.id, {
      title: 'Pasted Notes',
      rawText: 'Some notes.\n\n\nExtra blank line.',
    });

    expect(row.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.extractionMethod).toBe('text');
    expect(row.normalizationVersion).toBe(1);
    expect(row.rawText).toBe('Some notes.\n\nExtra blank line.');
    expect(jobs.enqueue).toHaveBeenCalledWith(row.id);

    const [stored] = await db
      .select()
      .from(sources)
      .where(eq(sources.id, row.id));
    expect(stored.contentHash).toBe(row.contentHash);
  });

  it('createText rejects empty and oversized text', async () => {
    const { service } = createSourcesService();
    const notebook = await seedNotebook();

    await expect(
      service.createText(notebook.id, { title: 'X', rawText: '   ' }),
    ).rejects.toThrow('non-empty');

    await expect(
      service.createText(notebook.id, {
        title: 'X',
        rawText: 'a'.repeat(5 * 1024 * 1024 + 1),
      }),
    ).rejects.toThrow('exceeds maximum size');
  });

  it('createText marks a navigation-only paste degraded and skips indexing', async () => {
    const { service, jobs, db } = createSourcesService();
    const notebook = await seedNotebook();
    const navigationText = Array.from(
      { length: 80 },
      (_, i) =>
        `[Chapter ${i} study guide summary notes](https://example.com/chapter-${i})`,
    ).join('\n');

    const row = await service.createText(notebook.id, {
      title: 'Beyond Good and Evil Summary',
      rawText: navigationText,
    });

    expect(row.processingStatus).toBe('degraded');
    expect(jobs.enqueue).not.toHaveBeenCalled();

    const [stored] = await db
      .select()
      .from(sources)
      .where(eq(sources.id, row.id));
    expect(stored.processingStatus).toBe('degraded');
    expect(stored.processingErrorCode).toBe('quality_navigation');
    expect(stored.processingErrorMessage).toBe(
      'errors.sources.quality.navigation',
    );

    const [version] = await db
      .select()
      .from(sourceVersions)
      .where(eq(sourceVersions.id, stored.currentVersionId!));
    expect(version.quality).toMatchObject({
      status: 'degraded',
      reason: 'navigation',
    });
  });

  it('createUrl persists fetch provenance and normalized metadata', async () => {
    const acquisition = {
      acquireUrl: vi.fn().mockResolvedValue({
        title: 'Fetched Title',
        text: 'Article body text that is long enough for the minimum content threshold to pass comfortably when importing via web search.',
        contentHash: 'abc123',
        extractionMethod: 'readability',
        sourceUrl: 'https://example.com/a?utm=1',
        canonicalUrl: 'https://example.com/a',
        fetchedUrl: 'https://example.com/a',
        status: 200,
        httpContentType: 'text/html; charset=utf-8',
        etag: '"etag-1"',
        lastModified: 'Wed, 02 Jan 2025 00:00:00 GMT',
        robotsDecision: 'allowed',
        redirects: [],
        sections: [],
      }),
    } as any;
    const { service, jobs, db } = createSourcesService({ acquisition });

    const notebook = await seedNotebook();
    const row = await service.createUrl(notebook.id, {
      url: 'https://example.com/a?utm=1',
    });

    expect(row.title).toBe('Fetched Title');
    expect(row.contentHash).toBe('abc123');
    expect(row.canonicalUrl).toBe('https://example.com/a');
    expect(row.fetchedUrl).toBe('https://example.com/a');
    expect(row.httpStatus).toBe(200);
    expect(row.etag).toBe('"etag-1"');
    expect(row.lastModified).toContain('2025');
    expect(row.robotsDecision).toBe('allowed');
    expect(row.extractionMethod).toBe('readability');
    expect(row.normalizationVersion).toBe(1);
    expect(jobs.enqueue).toHaveBeenCalledWith(row.id);

    const [stored] = await db
      .select()
      .from(sources)
      .where(eq(sources.id, row.id));
    expect(stored.url).toBe('https://example.com/a?utm=1');
    expect(stored.fetchedAt).toBeDefined();
  });

  it('createUrl enforces the minimum text length', async () => {
    const acquisition = {
      acquireUrl: vi.fn().mockResolvedValue({
        title: 'Short',
        text: 'too short',
        contentHash: 'hash',
        extractionMethod: 'readability',
        status: 200,
        httpContentType: 'text/html',
        robotsDecision: 'skipped',
        sections: [],
      }),
    } as any;
    const { service, db } = createSourcesService({ acquisition });
    const notebook = await seedNotebook();

    await expect(
      service.createUrl(notebook.id, {
        url: 'https://example.com/short',
        minTextLength: 1000,
      }),
    ).rejects.toMatchObject({ code: 'not_readerable' });

    const count = await db.select({ id: sources.id }).from(sources);
    expect(count).toHaveLength(0);
  });

  it('createFile stores the artifact and enqueues asynchronous processing', async () => {
    const acquisition = {
      acquireFile: vi.fn().mockResolvedValue({
        text: 'File text',
        contentHash: 'file-hash',
        extractionMethod: 'file',
        sections: [],
      }),
      fromText: vi.fn(),
      acquireUrl: vi.fn(),
    } as any;
    const { service, jobs } = createSourcesService({ acquisition });
    const notebook = await seedNotebook();

    const row = await service.createFile(
      notebook.id,
      Buffer.from('Hello file'),
      'notes.txt',
      'text/plain',
    );

    expect(row.kind).toBe('file');
    expect(row.contentHash).toBeNull();
    expect(row.rawText).toBe('');
    expect(row.processingStatus).toBe('pending');
    expect(row.processingStage).toBe('uploading');
    expect(row.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(row.s3Key).toContain('sources/');
    expect(acquisition.acquireFile).not.toHaveBeenCalled();
    expect(jobs.enqueue).toHaveBeenCalledWith(row.id);
  });

  it('delete removes the source and cancels indexing', async () => {
    const { service, jobs } = createSourcesService();
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'text',
      title: 'Doomed',
      rawText: 'content',
    });

    await service.delete(source.id);
    expect(jobs.cancelForSource).toHaveBeenCalledWith(source.id);

    const rows = await db
      .select()
      .from(sources)
      .where(eq(sources.id, source.id));
    expect(rows).toHaveLength(0);
  });

  it('reindex enqueues a fresh job for an owned source', async () => {
    const jobs = {
      enqueue: vi.fn().mockResolvedValue({ id: 'job-2', status: 'pending' }),
      cancelForSource: vi.fn(),
      latestForSource: vi.fn(),
      reindexNotebook: vi.fn(),
    } as any;
    const { service } = createSourcesService({ jobs });
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'text',
      title: 'Reindex me',
      rawText: 'content',
    });

    const job = await service.reindex(source.id);
    expect(job.id).toBe('job-2');
    expect(jobs.enqueue).toHaveBeenCalledWith(source.id);
  });

  it('reindex rejects unknown sources', async () => {
    const { service } = createSourcesService();
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'text',
      title: 'Private',
      rawText: 'content',
    });

    await expect(service.reindex('non-existent-source-id')).rejects.toThrow();
  });

  it('get includes the latest indexing job status', async () => {
    const jobs = {
      latestForSource: vi.fn().mockResolvedValue({
        id: 'job-3',
        status: 'ready',
        chunksCount: 4,
      }),
    } as any;
    const { service } = createSourcesService({ jobs });
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'text',
      title: 'Status',
      rawText: 'content',
    });

    const result = await service.get(source.id);
    expect(result.indexingStatus).toEqual({
      id: 'job-3',
      status: 'ready',
      chunksCount: 4,
    });
    expect(result.segments).toEqual([]);
  });

  it('createFile assigns modality: image and enforces 20 MB limit for images', async () => {
    const { service, db } = createSourcesService();
    const notebook = await seedNotebook();

    // Rejects oversized image (> 20 MB)
    await expect(
      service.createFile(
        notebook.id,
        Buffer.alloc(20 * 1024 * 1024 + 1),
        'photo.png',
        'image/png',
      ),
    ).rejects.toThrow('exceeds maximum size');

    // Accepts valid image and sets modality to image
    const row = await service.createFile(
      notebook.id,
      Buffer.from('png-bytes'),
      'photo.png',
      'image/png',
    );

    expect(row.kind).toBe('file');
    expect(row.modality).toBe('image');
    expect(row.processingStage).toBe('uploading');

    const [stored] = await db
      .select()
      .from(sources)
      .where(eq(sources.id, row.id));
    expect(stored.modality).toBe('image');
  });

  it('createFileFromArtifact assigns modality: image and enforces 20 MB limit', async () => {
    const storage = mockStorageService();
    vi.spyOn(storage, 'objectMetadata').mockResolvedValue({
      contentLength: 1024,
      metadata: {},
    } as any);

    const notebooksService = new NotebooksService(db as any, storage);
    const service = new SourcesService(
      db as any,
      notebooksService,
      storage,
      { acquireFile: vi.fn(), fromText: vi.fn(), acquireUrl: vi.fn() } as any,
      {
        enqueue: vi.fn(),
        enqueueProcessing: vi.fn(),
        latestForSource: vi.fn(),
      } as any,
      new SourceExtractionService(),
    );

    const notebook = await seedNotebook();

    // Rejects oversized image
    await expect(
      service.createFileFromArtifact(notebook.id, {
        artifactKey: 'pending-sources/test-token',
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
        fileSize: 20 * 1024 * 1024 + 1,
      }),
    ).rejects.toThrow('exceeds maximum size');

    // Creates source with modality: image
    const row = await service.createFileFromArtifact(notebook.id, {
      artifactKey: 'pending-sources/test-token',
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
      fileSize: 1024,
    });

    expect(row.kind).toBe('file');
    expect(row.modality).toBe('image');
  });

  it('get returns segments for source.currentVersionId ordered by ordinal', async () => {
    const { service } = createSourcesService();
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'file',
      title: 'Vision Doc',
      rawText: 'Full doc text',
    });

    const [version] = await db
      .insert(sourceVersions)
      .values({
        sourceId: source.id,
        contentHash: 'hash-v1',
        extractorId: 'vision',
        extractorVersion: '1',
        normalizationVersion: 1,
        status: 'ready',
      })
      .returning();

    await db
      .update(sources)
      .set({ currentVersionId: version.id })
      .where(eq(sources.id, source.id));

    await db.insert(sourceSegments).values([
      {
        sourceVersionId: version.id,
        ordinal: 2,
        kind: 'visual_description',
        content: 'Segment 2 description',
        locator: { imageRegion: { x: 0, y: 0.5, width: 1, height: 0.5 } },
      },
      {
        sourceVersionId: version.id,
        ordinal: 0,
        kind: 'heading',
        content: 'Segment 0 heading',
        locator: { imageRegion: { x: 0, y: 0, width: 1, height: 0.2 } },
      },
      {
        sourceVersionId: version.id,
        ordinal: 1,
        kind: 'formula',
        content: 'Segment 1 formula: $$E=mc^2$$',
        locator: { imageRegion: { x: 0, y: 0.2, width: 1, height: 0.3 } },
      },
    ]);

    const result = await service.get(source.id);
    expect(result.segments).toHaveLength(3);
    expect(result.segments[0].ordinal).toBe(0);
    expect(result.segments[0].kind).toBe('heading');
    expect(result.segments[1].ordinal).toBe(1);
    expect(result.segments[1].kind).toBe('formula');
    expect(result.segments[2].ordinal).toBe(2);
    expect(result.segments[2].kind).toBe('visual_description');
  });

  it('createFile & createFileFromArtifact support audio files with 500 MB limit', async () => {
    const storage = mockStorageService();
    vi.spyOn(storage, 'objectMetadata').mockResolvedValue({
      contentLength: 1024,
      metadata: {},
    } as any);

    const notebooksService = new NotebooksService(db as any, storage);
    const service = new SourcesService(
      db as any,
      notebooksService,
      storage,
      { acquireFile: vi.fn(), fromText: vi.fn(), acquireUrl: vi.fn() } as any,
      {
        enqueue: vi.fn(),
        enqueueProcessing: vi.fn(),
        latestForSource: vi.fn(),
      } as any,
      new SourceExtractionService(),
    );

    const notebook = await seedNotebook();

    // Audio createFile
    const audioBuffer = Buffer.from('fake-audio-mp3-bytes');
    const audioSource = await service.createFile(
      notebook.id,
      audioBuffer,
      'lecture.mp3',
      'audio/mpeg',
    );

    expect(audioSource.kind).toBe('file');
    expect(audioSource.modality).toBe('audio');

    // Audio createFileFromArtifact
    const artifactSource = await service.createFileFromArtifact(notebook.id, {
      artifactKey: 'pending-sources/test-token',
      filename: 'recording.wav',
      contentType: 'audio/wav',
      fileSize: 1024,
    });

    expect(artifactSource.kind).toBe('file');
    expect(artifactSource.modality).toBe('audio');

    // Rejects audio exceeding 500 MB
    await expect(
      service.createFileFromArtifact(notebook.id, {
        artifactKey: 'pending-sources/test-token',
        filename: 'large.mp3',
        contentType: 'audio/mpeg',
        fileSize: 500 * 1024 * 1024 + 1,
      }),
    ).rejects.toThrow('exceeds maximum size');
  });

  it('createFile & createFileFromArtifact support video files with 1 GB limit and modality: video', async () => {
    const storage = mockStorageService();
    vi.spyOn(storage, 'objectMetadata').mockResolvedValue({
      contentLength: 2048,
      metadata: {},
    } as any);

    const notebooksService = new NotebooksService(db as any, storage);
    const service = new SourcesService(
      db as any,
      notebooksService,
      storage,
      { acquireFile: vi.fn(), fromText: vi.fn(), acquireUrl: vi.fn() } as any,
      {
        enqueue: vi.fn(),
        enqueueProcessing: vi.fn(),
        latestForSource: vi.fn(),
      } as any,
      new SourceExtractionService(),
    );

    const notebook = await seedNotebook();

    // Video createFile assigns modality video
    const videoBuffer = Buffer.from('fake-video-mp4-bytes');
    const videoSource = await service.createFile(
      notebook.id,
      videoBuffer,
      'lecture.mp4',
      'video/mp4',
    );
    expect(videoSource.kind).toBe('file');
    expect(videoSource.modality).toBe('video');

    // Video createFileFromArtifact assigns modality video
    const artifactSource = await service.createFileFromArtifact(notebook.id, {
      artifactKey: 'pending-sources/test-token-video',
      filename: 'recording.mp4',
      contentType: 'video/mp4',
      fileSize: 2048,
    });
    expect(artifactSource.kind).toBe('file');
    expect(artifactSource.modality).toBe('video');

    // Rejects video exceeding 1 GB
    await expect(
      service.createFileFromArtifact(notebook.id, {
        artifactKey: 'pending-sources/test-token-video',
        filename: 'large.mp4',
        contentType: 'video/mp4',
        fileSize: 1024 * 1024 * 1024 + 1,
      }),
    ).rejects.toThrow('exceeds maximum size');
  });

  it('createUrl assigns modality video for YouTube URLs', async () => {
    const acquisition = {
      acquireUrl: vi.fn().mockResolvedValue({
        title: 'YouTube Video',
        text: 'YouTube transcript content that is long enough to pass any threshold.',
        contentHash: 'yt-hash',
        extractionMethod: 'youtube',
        sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        fetchedUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        status: 200,
        httpContentType: 'text/html',
        robotsDecision: 'allowed',
        sections: [],
      }),
    } as any;
    const { service } = createSourcesService({ acquisition });
    const notebook = await seedNotebook();

    const row = await service.createUrl(notebook.id, {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
    expect(row.modality).toBe('video');
    expect(row.kind).toBe('url');

    // Non-YouTube URL remains document
    const row2 = await service.createUrl(notebook.id, {
      url: 'https://example.com/article',
    });
    expect(row2.modality).toBe('document');
  });

  it('createFile & createFileFromArtifact support PPTX with 200 MB limit and modality: slides', async () => {
    const storage = mockStorageService();
    vi.spyOn(storage, 'objectMetadata').mockResolvedValue({
      contentLength: 2048,
      metadata: {},
    } as any);

    const notebooksService = new NotebooksService(db as any, storage);
    const service = new SourcesService(
      db as any,
      notebooksService,
      storage,
      { acquireFile: vi.fn(), fromText: vi.fn(), acquireUrl: vi.fn() } as any,
      {
        enqueue: vi.fn(),
        enqueueProcessing: vi.fn(),
        latestForSource: vi.fn(),
      } as any,
      new SourceExtractionService(),
    );

    const notebook = await seedNotebook();

    // Rejects PPTX exceeding 200 MB
    await expect(
      service.createFile(
        notebook.id,
        Buffer.alloc(200 * 1024 * 1024 + 1),
        'deck.pptx',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ),
    ).rejects.toThrow('exceeds maximum size');

    // PPTX createFile assigns modality slides
    const pptxBuffer = Buffer.from('fake-pptx-bytes');
    const pptxSource = await service.createFile(
      notebook.id,
      pptxBuffer,
      'deck.pptx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    );
    expect(pptxSource.kind).toBe('file');
    expect(pptxSource.modality).toBe('slides');

    // PPTX createFileFromArtifact assigns modality slides
    const artifactSource = await service.createFileFromArtifact(notebook.id, {
      artifactKey: 'pending-sources/pptx-token',
      filename: 'deck.pptx',
      contentType:
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      fileSize: 2048,
    });
    expect(artifactSource.kind).toBe('file');
    expect(artifactSource.modality).toBe('slides');

    // Rejects via artifact exceeding 200 MB
    await expect(
      service.createFileFromArtifact(notebook.id, {
        artifactKey: 'pending-sources/pptx-token',
        filename: 'big.pptx',
        contentType:
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        fileSize: 200 * 1024 * 1024 + 1,
      }),
    ).rejects.toThrow('exceeds maximum size');
  });

  it('createFile & createFileFromArtifact support EPUB with 200 MB limit and modality: ebook', async () => {
    const storage = mockStorageService();
    vi.spyOn(storage, 'objectMetadata').mockResolvedValue({
      contentLength: 4096,
      metadata: {},
    } as any);

    const notebooksService = new NotebooksService(db as any, storage);
    const service = new SourcesService(
      db as any,
      notebooksService,
      storage,
      { acquireFile: vi.fn(), fromText: vi.fn(), acquireUrl: vi.fn() } as any,
      {
        enqueue: vi.fn(),
        enqueueProcessing: vi.fn(),
        latestForSource: vi.fn(),
      } as any,
      new SourceExtractionService(),
    );

    const notebook = await seedNotebook();

    await expect(
      service.createFile(
        notebook.id,
        Buffer.alloc(200 * 1024 * 1024 + 1),
        'book.epub',
        'application/epub+zip',
      ),
    ).rejects.toThrow('exceeds maximum size');

    const epubBuffer = Buffer.from('fake-epub-bytes');
    const epubSource = await service.createFile(
      notebook.id,
      epubBuffer,
      'book.epub',
      'application/epub+zip',
    );
    expect(epubSource.kind).toBe('file');
    expect(epubSource.modality).toBe('ebook');

    const artifactSource = await service.createFileFromArtifact(notebook.id, {
      artifactKey: 'pending-sources/epub-token',
      filename: 'book.epub',
      contentType: 'application/epub+zip',
      fileSize: 4096,
    });
    expect(artifactSource.kind).toBe('file');
    expect(artifactSource.modality).toBe('ebook');
  });

  it('updateSpeakerLabels updates speaker in source_segments and source_chunks without retranscription', async () => {
    const { service } = createSourcesService();
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'file',
      title: 'Audio Source',
      rawText: 'Audio text',
      modality: 'audio',
    });

    const [version] = await db
      .insert(sourceVersions)
      .values({
        sourceId: source.id,
        contentHash: 'hash-audio-v1',
        extractorId: 'transcription',
        extractorVersion: '1',
        normalizationVersion: 1,
        status: 'ready',
      })
      .returning();

    await db
      .update(sources)
      .set({ currentVersionId: version.id })
      .where(eq(sources.id, source.id));

    const [seg1, seg2] = await db
      .insert(sourceSegments)
      .values([
        {
          sourceVersionId: version.id,
          ordinal: 0,
          kind: 'transcript',
          content: 'Hello world',
          locator: {
            startOffsetMs: 0,
            endOffsetMs: 2000,
            speaker: 'Speaker 1',
          },
        },
        {
          sourceVersionId: version.id,
          ordinal: 1,
          kind: 'transcript',
          content: 'Hi there',
          locator: {
            startOffsetMs: 2100,
            endOffsetMs: 4000,
            speaker: 'Speaker 2',
          },
        },
      ])
      .returning();

    const [chunk1] = await db
      .insert(sourceChunks)
      .values([
        {
          sourceId: source.id,
          notebookId: notebook.id,
          sourceKind: 'file',
          sourceVersionId: version.id,
          chunkIndex: 0,
          content: 'Hello world',
          searchableText: 'Hello world',
          locator: {
            startOffsetMs: 0,
            endOffsetMs: 2000,
            speaker: 'Speaker 1',
          },
          embedding: new Array(EMBEDDING_DIMENSIONS).fill(0),
        },
      ])
      .returning();

    const updatedSegments = await service.updateSpeakerLabels(source.id, {
      'Speaker 1': 'Alice',
    });

    expect(updatedSegments).toHaveLength(2);
    expect(updatedSegments[0].locator.speaker).toBe('Alice');
    expect(updatedSegments[1].locator.speaker).toBe('Speaker 2');

    // Verify DB records
    const [storedSeg1] = await db
      .select()
      .from(sourceSegments)
      .where(eq(sourceSegments.id, seg1.id));
    expect(storedSeg1.locator.speaker).toBe('Alice');

    const [storedChunk1] = await db
      .select()
      .from(sourceChunks)
      .where(eq(sourceChunks.id, chunk1.id));
    expect(storedChunk1.locator?.speaker).toBe('Alice');
  });

  it('adds transcripts to a video source and creates timed segments', async () => {
    const { service } = createSourcesService();
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'url',
      modality: 'video',
      title: 'YouTube Lecture',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      rawText: '',
    });

    const transcriptText = `(00:00) Welcome to the course\n(00:05) First chapter on algorithms\n(00:20) Summary and conclusion`;
    const result = await service.addTranscript(source.id, transcriptText);

    expect(result.id).toBe(source.id);
    expect(result.segments).toHaveLength(3);
    expect(result.segments[0].content).toBe('Welcome to the course');
    expect(result.segments[0].locator?.startOffsetMs).toBe(0);
    expect(result.segments[0].locator?.endOffsetMs).toBe(5000);
    expect(result.segments[1].content).toBe('First chapter on algorithms');
    expect(result.segments[1].locator?.startOffsetMs).toBe(5000);
    expect(result.segments[1].locator?.endOffsetMs).toBe(20000);
    expect(result.segments[2].content).toBe('Summary and conclusion');
    expect(result.segments[2].locator?.startOffsetMs).toBe(20000);
  });
});
