import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  sourceSegments,
  sourceUploadIntents,
  sourceVersions,
  sources,
} from '../../src/database/schema';
import { DocumentNormalizerService } from '../../src/modules/sources/extraction/document-normalizer.service';
import { ImageInspectorService } from '../../src/modules/sources/extraction/image-inspector.service';
import { AudioInspectorService } from '../../src/modules/sources/extraction/audio-inspector.service';
import { VideoInspectorService } from '../../src/modules/sources/extraction/video-inspector.service';
import { YouTubeAcquisitionService } from '../../src/modules/sources/acquisition/youtube-acquisition.service';
import { TranscriptionService } from '../../src/modules/sources/extraction/transcription.service';
import { SourceAcquisitionService } from '../../src/modules/sources/acquisition/source-acquisition.service';
import { SourceExtractionService } from '../../src/modules/sources/extraction/source-extraction.service';
import {
  SourceProcessingCancelledError,
  SourceProcessingHandler,
} from '../../src/modules/sources/jobs/source-processing.handler';
import { SourceVersionService } from '../../src/modules/sources/source-version.service';
import { VisionExtractionService } from '../../src/modules/sources/extraction/vision-extraction.service';
import { StorageService } from '../../src/modules/storage/storage.service';
import { ParseFileError } from '../../src/modules/sources/source-errors';
import { TabularInspectorService } from '../../src/modules/sources/extraction/tabular-inspector.service';
import { TabularParserService } from '../../src/modules/sources/extraction/tabular-parser.service';
import { db } from '../db';
import { seedNotebook, seedSource } from '../fixtures';

describe('SourceProcessingHandler', () => {
  function createHandler(
    overrides: {
      storage?: Partial<StorageService>;
      acquisition?: Partial<SourceAcquisitionService>;
      queue?: any;
      imageInspector?: Partial<ImageInspectorService>;
      visionExtraction?: Partial<VisionExtractionService>;
      audioInspector?: Partial<AudioInspectorService>;
      transcriptionService?: Partial<TranscriptionService>;
      videoInspector?: Partial<VideoInspectorService>;
      youtubeAcquisition?: Partial<YouTubeAcquisitionService>;
      versions?: Partial<SourceVersionService>;
      crawler?: { parseFile: ReturnType<typeof vi.fn> };
      tabularInspector?: Partial<TabularInspectorService>;
      tabularParser?: Partial<TabularParserService>;
    } = {},
  ) {
    const storage = {
      getObjectBuffer: vi
        .fn()
        .mockResolvedValue(Buffer.from('fake-file-bytes')),
      ...overrides.storage,
    } as any;

    const acquisition = {
      acquireFile: vi.fn().mockResolvedValue({
        title: 'Doc Title',
        text: 'Extracted doc prose',
        contentHash: 'hash-doc-1',
        extractionMethod: 'file',
        sections: [
          { headingPath: [], content: 'Extracted doc prose', ordinal: 0 },
        ],
      }),
      fromText: vi.fn().mockReturnValue({
        title: 'Text Title',
        text: 'Text content',
        contentHash: 'hash-text-1',
        extractionMethod: 'text',
        sections: [{ headingPath: [], content: 'Text content', ordinal: 0 }],
      }),
      ...overrides.acquisition,
    } as any;

    const versions = new SourceVersionService(db);
    const queue = {
      isActive: vi.fn().mockResolvedValue(true),
      enqueueIfActive: vi.fn().mockResolvedValue({ id: 'index-job-1' }),
      ...overrides.queue,
    };

    const imageInspector = {
      inspect: vi.fn().mockReturnValue({
        mimeType: 'image/png',
        width: 800,
        height: 600,
        totalPixels: 480_000,
      }),
      ...overrides.imageInspector,
    } as any;

    const visionExtraction = {
      extractVisualDocument: vi.fn().mockResolvedValue({
        title: 'Visual Notes',
        rawText: 'Heading 1\n\nFormula: E=mc^2',
        segments: [
          {
            kind: 'heading',
            content: 'Heading 1',
            imageRegion: { x: 0, y: 0, width: 1, height: 0.2 },
          },
          {
            kind: 'formula',
            content: '$$E=mc^2$$',
            imageRegion: { x: 0.1, y: 0.3, width: 0.8, height: 0.2 },
          },
          {
            kind: 'visual_description',
            content: 'A graph showing energy versus mass',
            imageRegion: { x: 0, y: 0.5, width: 1, height: 0.5 },
          },
        ],
      }),
      ...overrides.visionExtraction,
    } as any;

    const audioInspector = {
      inspect: vi.fn().mockReturnValue({
        mimeType: 'audio/mpeg',
        size: 1000,
      }),
      ...overrides.audioInspector,
    } as any;

    const transcriptionService = {
      transcribeAudio: vi.fn().mockResolvedValue({
        title: 'Audio Lecture',
        rawText: 'Hello class, welcome to lecture 1.\n\nThank you professor.',
        segments: [
          {
            content: 'Hello class, welcome to lecture 1.',
            startOffsetMs: 0,
            endOffsetMs: 2500,
            speaker: 'Professor Smith',
          },
          {
            content: 'Thank you professor.',
            startOffsetMs: 2600,
            endOffsetMs: 4000,
            speaker: 'Student A',
          },
        ],
      }),
      ...overrides.transcriptionService,
    } as any;

    const videoInspector = {
      inspect: vi.fn().mockReturnValue({
        mimeType: 'video/mp4',
        durationMs: 60000,
        width: 1920,
        height: 1080,
        size: 5000000,
      }),
      sampleKeyframes: vi.fn().mockReturnValue([
        {
          timestampMs: 0,
          durationMs: 5000,
          buffer: Buffer.from('frame-0'),
          mimeType: 'image/png',
          isKeyframe: true,
        },
      ]),
      ...overrides.videoInspector,
    } as any;

    const youtubeAcquisition = {
      acquire: vi.fn().mockResolvedValue({
        videoId: 'dQw4w9WgXcQ',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: 'YouTube Lecture Video',
        description: 'Full lecture description',
        author: 'MIT OpenCourseWare',
        channelTitle: 'MIT OpenCourseWare',
        rawText: 'Introduction to Algorithms lecture by Prof. Erik Demaine.',
        segments: [
          {
            content:
              'Introduction to Algorithms lecture by Prof. Erik Demaine.',
            startOffsetMs: 0,
            endOffsetMs: 5000,
            speaker: 'Prof. Demaine',
          },
          {
            content: 'Today we discuss peak finding algorithms.',
            startOffsetMs: 5100,
            endOffsetMs: 12000,
            speaker: 'Prof. Demaine',
          },
        ],
      }),
      ...overrides.youtubeAcquisition,
    } as any;

    const sourceExtractionService = new SourceExtractionService();
    const documentNormalizer = new DocumentNormalizerService();

    const crawler = {
      parseFile: vi.fn().mockResolvedValue({
        title: 'Parsed document',
        markdown:
          '# Parsed document\n\nExtracted content with enough detail to study.',
      }),
      ...overrides.crawler,
    };
    const tabularInspector = {
      inspect: vi.fn(),
      ...overrides.tabularInspector,
    } as any;
    const tabularParser = {
      parse: vi.fn().mockReturnValue({
        fileName: 'data.tsv',
        title: 'data',
        format: 'tsv',
        totalRows: 1,
        totalColumns: 1,
        sheetCount: 1,
        sheets: [],
        rawText: '# data\n\n| value |',
      }),
      ...overrides.tabularParser,
    } as any;

    const handler = new SourceProcessingHandler(
      db,
      storage,
      acquisition,
      versions,
      queue,
      imageInspector,
      visionExtraction,
      audioInspector,
      transcriptionService,
      sourceExtractionService,
      documentNormalizer,
      crawler as any,
      videoInspector,
      youtubeAcquisition,
      tabularInspector,
      tabularParser,
    );

    return {
      handler,
      storage,
      acquisition,
      versions,
      queue,
      imageInspector,
      visionExtraction,
      audioInspector,
      transcriptionService,
      sourceExtractionService,
      documentNormalizer,
      crawler,
      tabularInspector,
      tabularParser,
      videoInspector,
      youtubeAcquisition,
    };
  }

  it('processes image source end-to-end with analyzing_visuals stage and persists segments', async () => {
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'file',
      title: 'diagram.png',
      rawText: '',
      s3Key: 'sources/diagram.png',
      contentType: 'image/png',
      modality: 'image',
    });

    const { handler, imageInspector, visionExtraction, queue } =
      createHandler();

    const job = {
      id: 'proc-job-1',
      type: 'source_processing',
      payload: { sourceId: source.id, notebookId: notebook.id },
      attemptCount: 1,
      maxAttempts: 3,
    } as any;

    const result = await handler.process(job);

    expect(imageInspector.inspect).toHaveBeenCalled();
    expect(visionExtraction.extractVisualDocument).toHaveBeenCalledWith({
      buffer: expect.any(Buffer),
      mimeType: 'image/png',
      filename: 'diagram.png',
    });

    expect(queue.enqueueIfActive).toHaveBeenCalledWith(
      'proc-job-1',
      'source_indexing',
      expect.objectContaining({
        sourceId: source.id,
        notebookId: notebook.id,
        sourceVersionId: result.sourceVersionId,
      }),
      expect.any(Object),
    );

    expect(result.segmentCount).toBe(3);

    // Verify source version and segments in DB
    const [version] = await db
      .select()
      .from(sourceVersions)
      .where(eq(sourceVersions.id, result.sourceVersionId));
    expect(version.extractorId).toBe('vision');

    const segments = await db
      .select()
      .from(sourceSegments)
      .where(eq(sourceSegments.sourceVersionId, result.sourceVersionId))
      .orderBy(sourceSegments.ordinal);

    expect(segments).toHaveLength(3);
    expect(segments[0].kind).toBe('heading');
    expect(segments[1].kind).toBe('formula');
    expect(segments[2].kind).toBe('visual_description');
    expect(segments[1].locator).toEqual({
      imageRegion: { x: 0.1, y: 0.3, width: 0.8, height: 0.2 },
    });
  });

  it('processes audio source end-to-end with transcribing stage and persists transcript segments', async () => {
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'file',
      title: 'lecture.mp3',
      rawText: '',
      s3Key: 'sources/lecture.mp3',
      contentType: 'audio/mpeg',
      modality: 'audio',
    });

    const { handler, audioInspector, transcriptionService, queue } =
      createHandler();

    const job = {
      id: 'proc-job-audio-1',
      type: 'source_processing',
      payload: { sourceId: source.id, notebookId: notebook.id },
      attemptCount: 1,
      maxAttempts: 3,
    } as any;

    const result = await handler.process(job);

    expect(audioInspector.inspect).toHaveBeenCalled();
    expect(transcriptionService.transcribeAudio).toHaveBeenCalledWith({
      buffer: expect.any(Buffer),
      mimeType: 'audio/mpeg',
      filename: 'lecture.mp3',
    });

    expect(queue.enqueueIfActive).toHaveBeenCalledWith(
      'proc-job-audio-1',
      'source_indexing',
      expect.objectContaining({
        sourceId: source.id,
        notebookId: notebook.id,
        sourceVersionId: result.sourceVersionId,
      }),
      expect.any(Object),
    );

    expect(result.segmentCount).toBe(2);

    // Verify source version and segments in DB
    const [version] = await db
      .select()
      .from(sourceVersions)
      .where(eq(sourceVersions.id, result.sourceVersionId));
    expect(version.extractorId).toMatch(/transcription|audio/);

    const segments = await db
      .select()
      .from(sourceSegments)
      .where(eq(sourceSegments.sourceVersionId, result.sourceVersionId))
      .orderBy(sourceSegments.ordinal);

    expect(segments).toHaveLength(2);
    expect(segments[0].kind).toBe('transcript');
    expect(segments[0].locator).toEqual(
      expect.objectContaining({
        startOffsetMs: 0,
        endOffsetMs: 2500,
        speaker: 'Professor Smith',
      }),
    );
    expect(segments[1].kind).toBe('transcript');
    expect(segments[1].locator).toEqual(
      expect.objectContaining({
        startOffsetMs: 2600,
        endOffsetMs: 4000,
        speaker: 'Student A',
      }),
    );
  });

  it('processes a plain-text file with extracting stage and local acquisition', async () => {
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'file',
      title: 'paper.txt',
      rawText: '',
      s3Key: 'sources/paper.txt',
      contentType: 'text/plain',
      modality: 'document',
    });

    const { handler, acquisition, visionExtraction, queue } = createHandler();

    const job = {
      id: 'proc-job-2',
      type: 'source_processing',
      payload: { sourceId: source.id, notebookId: notebook.id },
      attemptCount: 1,
      maxAttempts: 3,
    } as any;

    const result = await handler.process(job);

    expect(acquisition.acquireFile).toHaveBeenCalled();
    expect(visionExtraction.extractVisualDocument).not.toHaveBeenCalled();
    expect(queue.enqueueIfActive).toHaveBeenCalled();
    expect(result.segmentCount).toBe(1);
  });

  it('marks a navigation-only extraction degraded and never enqueues indexing', async () => {
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'file',
      title: 'study-guide.html',
      rawText: '',
      s3Key: 'sources/study-guide.html',
      contentType: 'text/html',
      modality: 'document',
    });

    const navigationText = Array.from(
      { length: 80 },
      (_, i) =>
        `[Chapter ${i} study guide summary notes](https://example.com/chapter-${i})`,
    ).join('\n');

    const { handler, queue } = createHandler({
      acquisition: {
        acquireFile: vi.fn().mockResolvedValue({
          title: 'Study guide',
          text: navigationText,
          contentHash: 'hash-navigation-1',
          extractionMethod: 'readability',
          sections: [{ headingPath: [], content: navigationText, ordinal: 0 }],
        }),
      },
    });

    const job = {
      id: 'proc-job-degraded-1',
      type: 'source_processing',
      payload: { sourceId: source.id, notebookId: notebook.id },
      attemptCount: 1,
      maxAttempts: 3,
    } as any;

    const result = await handler.process(job);

    expect(queue.enqueueIfActive).not.toHaveBeenCalled();

    const [version] = await db
      .select()
      .from(sourceVersions)
      .where(eq(sourceVersions.id, result.sourceVersionId));
    expect(version.quality).toMatchObject({
      status: 'degraded',
      reason: 'navigation',
    });
    expect(version.status).toBe('degraded');

    const [updatedSource] = await db
      .select()
      .from(sources)
      .where(eq(sources.id, source.id));
    expect(updatedSource.processingStatus).toBe('degraded');
    expect(updatedSource.processingStage).toBeNull();
    expect(updatedSource.processingErrorCode).toBe('quality_navigation');
    expect(updatedSource.processingErrorMessage).toBe(
      'errors.sources.quality.navigation',
    );
  });

  it('throws SourceProcessingCancelledError when job is no longer active in queue', async () => {
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'file',
      title: 'photo.png',
      rawText: '',
      s3Key: 'sources/photo.png',
      contentType: 'image/png',
      modality: 'image',
    });

    const { handler } = createHandler({
      queue: {
        isActive: vi.fn().mockResolvedValue(false),
      },
    });

    const job = {
      id: 'proc-job-3',
      type: 'source_processing',
      payload: { sourceId: source.id, notebookId: notebook.id },
      attemptCount: 1,
      maxAttempts: 3,
    } as any;

    await expect(handler.process(job)).rejects.toThrow(
      SourceProcessingCancelledError,
    );
  });

  it('throws SourceProcessingCancelledError when source is marked cancelled', async () => {
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'file',
      title: 'photo.png',
      rawText: '',
      s3Key: 'sources/photo.png',
      contentType: 'image/png',
      modality: 'image',
      processingStatus: 'cancelled',
    });

    const { handler } = createHandler();

    const job = {
      id: 'proc-job-4',
      type: 'source_processing',
      payload: { sourceId: source.id, notebookId: notebook.id },
      attemptCount: 1,
      maxAttempts: 3,
    } as any;

    await expect(handler.process(job)).rejects.toThrow(
      SourceProcessingCancelledError,
    );
  });

  it('marks source failed when extraction error occurs on final attempt', async () => {
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'file',
      title: 'corrupt.png',
      rawText: '',
      s3Key: 'sources/corrupt.png',
      contentType: 'image/png',
      modality: 'image',
    });

    const { handler } = createHandler({
      imageInspector: {
        inspect: vi.fn().mockImplementation(() => {
          throw new Error('Corrupt image data');
        }),
      },
    });

    const job = {
      id: 'proc-job-5',
      type: 'source_processing',
      payload: { sourceId: source.id, notebookId: notebook.id },
      attemptCount: 3,
      maxAttempts: 3,
    } as any;

    await expect(handler.process(job)).rejects.toThrow('Corrupt image data');

    const [updatedSource] = await db
      .select()
      .from(sources)
      .where(eq(sources.id, source.id));

    expect(updatedSource.processingStatus).toBe('failed');
    expect(updatedSource.processingErrorCode).toBe('extraction_failed');
    expect(updatedSource.processingErrorMessage).toContain(
      'Corrupt image data',
    );
  });

  it('processes video source end-to-end with transcribing and analyzing_visuals stages, merging transcript and visual segments', async () => {
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'file',
      title: 'lecture.mp4',
      rawText: '',
      s3Key: 'sources/lecture.mp4',
      contentType: 'video/mp4',
      modality: 'video',
    });

    const {
      handler,
      videoInspector,
      transcriptionService,
      visionExtraction,
      queue,
    } = createHandler();

    const job = {
      id: 'proc-job-video-1',
      type: 'source_processing',
      payload: { sourceId: source.id, notebookId: notebook.id },
      attemptCount: 1,
      maxAttempts: 3,
    } as any;

    const result = await handler.process(job);

    expect(videoInspector.inspect).toHaveBeenCalled();
    expect(transcriptionService.transcribeAudio).toHaveBeenCalledWith({
      buffer: expect.any(Buffer),
      mimeType: 'video/mp4',
      filename: 'lecture.mp4',
    });
    expect(videoInspector.sampleKeyframes).toHaveBeenCalled();
    expect(visionExtraction.extractVisualDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        buffer: expect.any(Buffer),
        mimeType: 'image/png',
      }),
    );

    expect(queue.enqueueIfActive).toHaveBeenCalledWith(
      'proc-job-video-1',
      'source_indexing',
      expect.objectContaining({
        sourceId: source.id,
        notebookId: notebook.id,
        sourceVersionId: result.sourceVersionId,
      }),
      expect.any(Object),
    );

    // 2 transcript segments + 3 visual segments = 5 total
    expect(result.segmentCount).toBe(5);

    // Verify source version in DB
    const [version] = await db
      .select()
      .from(sourceVersions)
      .where(eq(sourceVersions.id, result.sourceVersionId));
    expect(version.extractorId).toBe('video');

    const segments = await db
      .select()
      .from(sourceSegments)
      .where(eq(sourceSegments.sourceVersionId, result.sourceVersionId))
      .orderBy(sourceSegments.ordinal);

    expect(segments).toHaveLength(5);
    // Transcript segments have start/end offsets and speaker
    expect(segments.some((s) => s.kind === 'transcript')).toBe(true);
    // Visual segments have imageRegion and timestamps
    const visualSeg = segments.find((s) => s.kind === 'formula');
    expect(visualSeg).toBeDefined();
    expect(visualSeg?.locator).toEqual(
      expect.objectContaining({
        startOffsetMs: 0,
        imageRegion: { x: 0.1, y: 0.3, width: 0.8, height: 0.2 },
      }),
    );
  });

  it('deduplicates consecutive identical visual keyframes to prevent chunk bloat', async () => {
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'file',
      title: 'presentation.mp4',
      rawText: '',
      s3Key: 'sources/presentation.mp4',
      contentType: 'video/mp4',
      modality: 'video',
    });

    const identicalSlideText = 'Title Slide\n\nIntroductory concepts';
    const { handler, videoInspector, visionExtraction } = createHandler({
      videoInspector: {
        inspect: vi.fn().mockReturnValue({
          mimeType: 'video/mp4',
          durationMs: 30000,
          width: 1920,
          height: 1080,
        }),
        // Returns 3 keyframes, but frame 1 and 2 show the exact same slide
        sampleKeyframes: vi.fn().mockReturnValue([
          { timestampMs: 0, buffer: Buffer.from('f0'), mimeType: 'image/png' },
          {
            timestampMs: 10000,
            buffer: Buffer.from('f1'),
            mimeType: 'image/png',
          },
          {
            timestampMs: 20000,
            buffer: Buffer.from('f2'),
            mimeType: 'image/png',
          },
        ]),
      },
      visionExtraction: {
        extractVisualDocument: vi
          .fn()
          .mockResolvedValueOnce({
            rawText: identicalSlideText,
            segments: [{ kind: 'heading', content: 'Title Slide' }],
          })
          .mockResolvedValueOnce({
            // Frame 1 is duplicate of Frame 0
            rawText: identicalSlideText,
            segments: [{ kind: 'heading', content: 'Title Slide' }],
          })
          .mockResolvedValueOnce({
            // Frame 2 is a new slide
            rawText: 'Slide 2: Next steps',
            segments: [{ kind: 'heading', content: 'Slide 2: Next steps' }],
          }),
      },
    });

    const job = {
      id: 'proc-job-video-dedup-1',
      type: 'source_processing',
      payload: { sourceId: source.id, notebookId: notebook.id },
      attemptCount: 1,
      maxAttempts: 3,
    } as any;

    const result = await handler.process(job);

    // 2 transcript segments + 2 unique visual slides (duplicate skipped) = 4 segments total
    expect(result.segmentCount).toBe(4);
  });

  it('processes YouTube URL source end-to-end with extracting stage and persists segments', async () => {
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'url',
      title: 'YouTube Lecture Video',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      rawText: '',
      modality: 'video',
    });

    const { handler, youtubeAcquisition, queue } = createHandler();

    const job = {
      id: 'proc-job-youtube-1',
      type: 'source_processing',
      payload: { sourceId: source.id, notebookId: notebook.id },
      attemptCount: 1,
      maxAttempts: 3,
    } as any;

    const result = await handler.process(job);

    expect(youtubeAcquisition.acquire).toHaveBeenCalledWith(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );

    expect(queue.enqueueIfActive).toHaveBeenCalledWith(
      'proc-job-youtube-1',
      'source_indexing',
      expect.objectContaining({
        sourceId: source.id,
        notebookId: notebook.id,
        sourceVersionId: result.sourceVersionId,
      }),
      expect.any(Object),
    );

    expect(result.segmentCount).toBe(2);

    // Verify source version and segments in DB
    const [version] = await db
      .select()
      .from(sourceVersions)
      .where(eq(sourceVersions.id, result.sourceVersionId));
    expect(version.extractorId).toBe('youtube');

    const segments = await db
      .select()
      .from(sourceSegments)
      .where(eq(sourceSegments.sourceVersionId, result.sourceVersionId))
      .orderBy(sourceSegments.ordinal);

    expect(segments).toHaveLength(2);
    expect(segments[0].kind).toBe('transcript');
    expect(segments[0].content).toContain('Introduction to Algorithms');
    expect(segments[0].locator).toEqual(
      expect.objectContaining({
        startOffsetMs: 0,
        endOffsetMs: 5000,
        speaker: 'Prof. Demaine',
      }),
    );
  });

  it.each([
    ['paper.pdf', 'application/pdf'],
    ['book.epub', 'application/epub+zip'],
    [
      'report.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    [
      'deck.pptx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
    ['deck.pptm', 'application/vnd.ms-powerpoint.presentation.macroEnabled.12'],
    [
      'sheet.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    ['legacy.xls', 'application/vnd.ms-excel'],
    ['data.csv', 'text/csv'],
  ])(
    'routes %s through crawler parsing and persists normalized content',
    async (filename, contentType) => {
      const notebook = await seedNotebook();
      const source = await seedSource(notebook.id, {
        kind: 'file',
        title: filename,
        rawText: '',
        s3Key: `pending-sources/${filename}`,
        contentType,
        modality: 'document',
      });
      const markdown =
        '# Parsed document\n\n## Details\n\nA detailed paragraph with enough extracted study content.\n\n| Topic | Notes |\n| --- | --- |\n| Routing | Preserved table |';
      const crawler = {
        parseFile: vi
          .fn()
          .mockResolvedValue({ title: 'Parsed document', markdown }),
      };
      const { handler } = createHandler({ crawler: crawler as any });
      const result = await handler.process({
        id: `parse-${filename}`,
        type: 'source_processing',
        payload: { sourceId: source.id, notebookId: notebook.id },
        attemptCount: 1,
        maxAttempts: 3,
      } as any);

      expect(crawler.parseFile).toHaveBeenCalledWith({
        buffer: expect.any(Buffer),
        filename,
        contentType,
      });
      const [version] = await db
        .select()
        .from(sourceVersions)
        .where(eq(sourceVersions.id, result.sourceVersionId));
      expect(version.extractorId).toBe('firecrawl');
      const [updatedSource] = await db
        .select()
        .from(sources)
        .where(eq(sources.id, source.id));
      expect(updatedSource.rawText).toBe(markdown);
      const segments = await db
        .select()
        .from(sourceSegments)
        .where(eq(sourceSegments.sourceVersionId, result.sourceVersionId));
      expect(segments.length).toBeGreaterThan(0);
      expect(segments.map((segment) => segment.content).join('\n')).toContain(
        'detailed paragraph',
      );
      expect(
        segments.some((segment) => segment.content.includes('Preserved table')),
      ).toBe(true);
      expect(
        segments.some(
          (segment) =>
            Array.isArray(segment.metadata.headingPath) &&
            segment.metadata.headingPath.join('/') ===
              'Parsed document/Details',
        ),
      ).toBe(true);
    },
  );

  it.each([
    ['notes.txt', 'text/plain'],
    ['notes.md', 'text/markdown'],
  ])('keeps %s on local extraction', async (filename, contentType) => {
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'file',
      title: filename,
      rawText: '',
      s3Key: `pending-sources/${filename}`,
      contentType,
    });
    const { handler, acquisition, crawler } = createHandler();
    await handler.process({
      id: `local-${filename}`,
      type: 'source_processing',
      payload: { sourceId: source.id },
      attemptCount: 1,
      maxAttempts: 3,
    } as any);
    expect(acquisition.acquireFile).toHaveBeenCalled();
    expect(crawler.parseFile).not.toHaveBeenCalled();
  });

  it('uses the artifact extension for routing despite a text MIME conflict', async () => {
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'file',
      title: 'renamed notes',
      rawText: '',
      s3Key: 'pending-sources/original-paper.pdf',
      contentType: 'text/plain',
    });
    const { handler, crawler, acquisition } = createHandler();
    await handler.process({
      id: 'mime-conflict',
      type: 'source_processing',
      payload: { sourceId: source.id },
      attemptCount: 1,
      maxAttempts: 3,
    } as any);
    expect(crawler.parseFile).toHaveBeenCalledWith(
      expect.objectContaining({ filename: 'original-paper.pdf' }),
    );
    expect(acquisition.acquireFile).not.toHaveBeenCalled();
  });

  it('uses the artifact extension when the editable title omits it and MIME is absent', async () => {
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'file',
      title: 'renamed slides',
      rawText: '',
      s3Key: 'pending-sources/original-deck.pptx',
      contentType: null,
    });
    const { handler, crawler } = createHandler();
    await handler.process({
      id: 'artifact-extension',
      type: 'source_processing',
      payload: { sourceId: source.id },
      attemptCount: 1,
      maxAttempts: 3,
    } as any);
    expect(crawler.parseFile).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: 'original-deck.pptx',
        contentType: '',
      }),
    );
  });

  it.each([
    ['slides', 'untitled slides', 'untitled slides.pptx'],
    ['ebook', 'untitled book', 'untitled book.epub'],
  ] as const)(
    'uses the %s modality when MIME and filename type are unavailable',
    async (modality, title, filename) => {
      const notebook = await seedNotebook();
      const source = await seedSource(notebook.id, {
        kind: 'file',
        title,
        rawText: '',
        s3Key: 'pending-sources/upload-token',
        contentType: null,
        modality,
      });
      const { handler, crawler } = createHandler();
      await handler.process({
        id: `modality-${modality}`,
        type: 'source_processing',
        payload: { sourceId: source.id },
        attemptCount: 1,
        maxAttempts: 3,
      } as any);
      expect(crawler.parseFile).toHaveBeenCalledWith(
        expect.objectContaining({ filename }),
      );
    },
  );

  it.each(['original.pdf', 'original.csv', 'original.md'])(
    'routes opaque uploads using the original filename %s',
    async (filename) => {
      const notebook = await seedNotebook();
      const storageKey = 'pending-sources/opaque-token';
      await db.insert(sourceUploadIntents).values({
        id: 'opaque-token',
        notebookId: notebook.id,
        storageKey,
        filename,
        contentType: 'application/octet-stream',
        expectedBytes: 15,
        status: 'consumed',
        expiresAt: new Date(Date.now() + 60_000),
      });
      const source = await seedSource(notebook.id, {
        kind: 'file',
        title: 'An editable title',
        rawText: '',
        s3Key: storageKey,
        contentType: 'application/octet-stream',
      });
      const { handler, crawler, acquisition } = createHandler();

      await handler.process({
        id: 'opaque-upload-job',
        type: 'source_processing',
        payload: { sourceId: source.id },
        attemptCount: 1,
        maxAttempts: 3,
      } as any);

      if (filename.endsWith('.md')) {
        expect(crawler.parseFile).not.toHaveBeenCalled();
        expect(acquisition.acquireFile).toHaveBeenCalledWith(
          expect.any(Buffer),
          'application/octet-stream',
          filename,
        );
      } else {
        expect(crawler.parseFile).toHaveBeenCalledWith(
          expect.objectContaining({ filename }),
        );
        expect(acquisition.acquireFile).not.toHaveBeenCalled();
      }
    },
  );

  it('keeps legacy TSV datasets on the local tabular parser', async () => {
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'file',
      title: 'data.tsv',
      rawText: '',
      s3Key: 'pending-sources/data.tsv',
      contentType: 'text/tab-separated-values',
      modality: 'dataset',
    });
    const { handler, crawler, tabularParser } = createHandler();
    await handler.process({
      id: 'local-tsv',
      type: 'source_processing',
      payload: { sourceId: source.id },
      attemptCount: 1,
      maxAttempts: 3,
    } as any);
    expect(tabularParser.parse).toHaveBeenCalledWith(
      expect.any(Buffer),
      'data.tsv',
    );
    expect(crawler.parseFile).not.toHaveBeenCalled();
  });

  it('retries transient parse failures and marks a permanent parse failure immediately', async () => {
    const notebook = await seedNotebook();
    const retrySource = await seedSource(notebook.id, {
      kind: 'file',
      title: 'retry.pdf',
      rawText: '',
      s3Key: 'pending-sources/retry.pdf',
      contentType: 'application/pdf',
    });
    const retryable = new ParseFileError(
      'Crawler unavailable',
      'service_unavailable',
      true,
    );
    const { handler } = createHandler({
      crawler: { parseFile: vi.fn().mockRejectedValue(retryable) } as any,
    });
    await expect(
      handler.process({
        id: 'retry-parse',
        type: 'source_processing',
        payload: { sourceId: retrySource.id },
        attemptCount: 1,
        maxAttempts: 3,
      } as any),
    ).rejects.toBe(retryable);
    let [source] = await db
      .select()
      .from(sources)
      .where(eq(sources.id, retrySource.id));
    expect(source.processingStatus).not.toBe('failed');

    const permanentSource = await seedSource(notebook.id, {
      kind: 'file',
      title: 'invalid.pdf',
      rawText: '',
      s3Key: 'pending-sources/invalid.pdf',
      contentType: 'application/pdf',
    });
    const permanent = new ParseFileError('Invalid file', 'invalid_file', false);
    const permanentHandler = createHandler({
      crawler: { parseFile: vi.fn().mockRejectedValue(permanent) } as any,
    }).handler;
    await expect(
      permanentHandler.process({
        id: 'permanent-parse',
        type: 'source_processing',
        payload: { sourceId: permanentSource.id },
        attemptCount: 1,
        maxAttempts: 3,
      } as any),
    ).rejects.toBe(permanent);
    [source] = await db
      .select()
      .from(sources)
      .where(eq(sources.id, permanentSource.id));
    expect(source.processingStatus).toBe('failed');
  });
});
