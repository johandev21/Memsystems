import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  sourceSegments,
  sourceVersions,
  sources,
} from '../src/database/schema';
import { DocumentNormalizerService } from '../src/modules/sources/document-normalizer.service';
import { ImageInspectorService } from '../src/modules/sources/image-inspector.service';
import { AudioInspectorService } from '../src/modules/sources/audio-inspector.service';
import { VideoInspectorService } from '../src/modules/sources/video-inspector.service';
import { YouTubeAcquisitionService } from '../src/modules/sources/youtube-acquisition.service';
import { TranscriptionService } from '../src/modules/sources/transcription.service';
import { SourceAcquisitionService } from '../src/modules/sources/source-acquisition.service';
import { SourceExtractionService } from '../src/modules/sources/source-extraction.service';
import {
  SourceProcessingCancelledError,
  SourceProcessingHandler,
} from '../src/modules/sources/source-processing.handler';
import { SourceVersionService } from '../src/modules/sources/source-version.service';
import { VisionExtractionService } from '../src/modules/sources/vision-extraction.service';
import { StorageService } from '../src/modules/storage/storage.service';
import { PptxInspectorService } from '../src/modules/sources/pptx-inspector.service';
import { EpubInspectorService } from '../src/modules/sources/epub-inspector.service';
import { PptxParserService } from '../src/modules/sources/pptx-parser.service';
import { EpubParserService } from '../src/modules/sources/epub-parser.service';
import { TabularInspectorService } from '../src/modules/sources/tabular-inspector.service';
import { TabularParserService } from '../src/modules/sources/tabular-parser.service';
import { db } from './db';
import { seedNotebook, seedSource, seedUser } from './fixtures';

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
      pptxInspector?: Partial<PptxInspectorService>;
      epubInspector?: Partial<EpubInspectorService>;
      pptxParser?: Partial<PptxParserService>;
      epubParser?: Partial<EpubParserService>;
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

    const versions = new SourceVersionService(db as any);
    const queue = {
      isActive: vi.fn().mockResolvedValue(true),
      enqueueIfActive: vi.fn().mockResolvedValue({ id: 'index-job-1' }),
      ...overrides.queue,
    } as any;

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

    const pptxInspector = {
      inspect: vi.fn().mockReturnValue({
        mimeType:
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        slideCount: 2,
      }),
      ...overrides.pptxInspector,
    } as any;

    const epubInspector = {
      inspect: vi.fn().mockReturnValue({
        mimeType: 'application/epub+zip',
        chapterCount: 3,
      }),
      ...overrides.epubInspector,
    } as any;

    const pptxParser = {
      parse: vi.fn().mockReturnValue({
        slideCount: 2,
        slides: [
          {
            slideNumber: 1,
            title: 'Intro',
            texts: ['Intro', 'Welcome to slides'],
            notes: 'Speaker notes for intro',
          },
          {
            slideNumber: 2,
            title: 'Conclusion',
            texts: ['Conclusion', 'Thanks'],
          },
        ],
      }),
      ...overrides.pptxParser,
    } as any;

    const epubParser = {
      parse: vi.fn().mockReturnValue({
        chapterCount: 2,
        chapters: [
          {
            ordinal: 1,
            title: 'Chapter 1',
            textContent: 'Chapter 1 content',
            href: 'chap1.xhtml',
          },
          {
            ordinal: 2,
            title: 'Chapter 2',
            textContent: 'Chapter 2 content',
            href: 'chap2.xhtml',
          },
        ],
      }),
      ...overrides.epubParser,
    } as any;

    const tabularInspector = {
      inspect: vi.fn().mockReturnValue({
        fileName: 'data.csv',
        format: 'csv',
        fileSize: 50,
      }),
      ...overrides.tabularInspector,
    } as any;

    const tabularParser = {
      parse: vi.fn().mockReturnValue({
        fileName: 'data.csv',
        title: 'data',
        format: 'csv',
        totalRows: 2,
        totalColumns: 2,
        sheetCount: 1,
        sheets: [
          {
            sheetName: 'Sheet 1',
            rowCount: 2,
            columnCount: 2,
            cellRange: 'A1:B3',
            headers: ['id', 'val'],
            columns: [{ name: 'id', type: 'number' }],
            sampleRows: [['1', '10'], ['2', '20']],
            markdownTable: '| id | val |\n|---|---|\n| 1 | 10 |\n| 2 | 20 |',
            rawText: '## Sheet: Sheet 1\n\n| id | val |',
          },
        ],
        rawText: '# data\n\n## Sheet: Sheet 1\n\n| id | val |',
      }),
      ...overrides.tabularParser,
    } as any;

    const handler = new SourceProcessingHandler(
      db as any,
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
      videoInspector,
      youtubeAcquisition,
      pptxInspector,
      epubInspector,
      pptxParser,
      epubParser,
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
      videoInspector,
      youtubeAcquisition,
      pptxInspector,
      epubInspector,
      pptxParser,
      epubParser,
      tabularInspector,
      tabularParser,
    };
  }

  it('processes image source end-to-end with analyzing_visuals stage and persists segments', async () => {
    const user = await seedUser();
    const notebook = await seedNotebook(user.id);
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
      userId: user.id,
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
    const user = await seedUser();
    const notebook = await seedNotebook(user.id);
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
      userId: user.id,
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

  it('processes non-image file with extracting stage and acquisitionService', async () => {
    const user = await seedUser();
    const notebook = await seedNotebook(user.id);
    const source = await seedSource(notebook.id, {
      kind: 'file',
      title: 'paper.pdf',
      rawText: '',
      s3Key: 'sources/paper.pdf',
      contentType: 'application/pdf',
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

  it('throws SourceProcessingCancelledError when job is no longer active in queue', async () => {
    const user = await seedUser();
    const notebook = await seedNotebook(user.id);
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
    const user = await seedUser();
    const notebook = await seedNotebook(user.id);
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
    const user = await seedUser();
    const notebook = await seedNotebook(user.id);
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
    const user = await seedUser();
    const notebook = await seedNotebook(user.id);
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
      userId: user.id,
    });
    expect(videoInspector.sampleKeyframes).toHaveBeenCalled();
    expect(visionExtraction.extractVisualDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        buffer: expect.any(Buffer),
        mimeType: 'image/png',
        userId: user.id,
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
    const user = await seedUser();
    const notebook = await seedNotebook(user.id);
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
          { timestampMs: 10000, buffer: Buffer.from('f1'), mimeType: 'image/png' },
          { timestampMs: 20000, buffer: Buffer.from('f2'), mimeType: 'image/png' },
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
    const user = await seedUser();
    const notebook = await seedNotebook(user.id);
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

  it('processes PPTX slides flow with extracting stage, validates limits, parses and persists slide segments', async () => {
    const user = await seedUser();
    const notebook = await seedNotebook(user.id);
    const source = await seedSource(notebook.id, {
      kind: 'file',
      title: 'deck.pptx',
      rawText: '',
      s3Key: 'sources/deck.pptx',
      contentType:
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      modality: 'slides',
    });

    const { handler, pptxInspector, pptxParser, queue } = createHandler();

    const job = {
      id: 'proc-job-pptx-1',
      type: 'source_processing',
      payload: { sourceId: source.id, notebookId: notebook.id },
      attemptCount: 1,
      maxAttempts: 3,
    } as any;

    const result = await handler.process(job);

    expect(pptxInspector.inspect).toHaveBeenCalledWith(
      expect.any(Buffer),
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'sources/deck.pptx',
    );
    expect(pptxParser.parse).toHaveBeenCalledWith(expect.any(Buffer));
    expect(queue.enqueueIfActive).toHaveBeenCalledWith(
      'proc-job-pptx-1',
      'source_indexing',
      expect.objectContaining({
        sourceId: source.id,
        notebookId: notebook.id,
        sourceVersionId: result.sourceVersionId,
      }),
      expect.any(Object),
    );
    expect(result.segmentCount).toBeGreaterThan(0);

    const [version] = await db
      .select()
      .from(sourceVersions)
      .where(eq(sourceVersions.id, result.sourceVersionId));
    expect(version.extractorId).toBe('parser');

    const segments = await db
      .select()
      .from(sourceSegments)
      .where(eq(sourceSegments.sourceVersionId, result.sourceVersionId))
      .orderBy(sourceSegments.ordinal);

    // At least slide 1 heading + notes + slide 2
    expect(segments.length).toBeGreaterThanOrEqual(2);
    expect(segments[0].locator).toEqual(
      expect.objectContaining({ slideNumber: 1 }),
    );
    expect(segments.some((s) => s.locator.slideNumber === 2)).toBe(true);

    const [updatedSource] = await db
      .select()
      .from(sources)
      .where(eq(sources.id, source.id));
    expect(updatedSource.processingStage).toBe('indexing');
  });

  it('processes EPUB ebook flow with extracting stage, validates limits, parses and persists chapter segments', async () => {
    const user = await seedUser();
    const notebook = await seedNotebook(user.id);
    const source = await seedSource(notebook.id, {
      kind: 'file',
      title: 'book.epub',
      rawText: '',
      s3Key: 'sources/book.epub',
      contentType: 'application/epub+zip',
      modality: 'ebook',
    });

    const { handler, epubInspector, epubParser, queue } = createHandler();

    const job = {
      id: 'proc-job-epub-1',
      type: 'source_processing',
      payload: { sourceId: source.id, notebookId: notebook.id },
      attemptCount: 1,
      maxAttempts: 3,
    } as any;

    const result = await handler.process(job);

    expect(epubInspector.inspect).toHaveBeenCalledWith(
      expect.any(Buffer),
      'application/epub+zip',
      'sources/book.epub',
    );
    expect(epubParser.parse).toHaveBeenCalledWith(expect.any(Buffer));
    expect(queue.enqueueIfActive).toHaveBeenCalledWith(
      'proc-job-epub-1',
      'source_indexing',
      expect.objectContaining({
        sourceId: source.id,
        notebookId: notebook.id,
        sourceVersionId: result.sourceVersionId,
      }),
      expect.any(Object),
    );
    expect(result.segmentCount).toBe(2);

    const segments = await db
      .select()
      .from(sourceSegments)
      .where(eq(sourceSegments.sourceVersionId, result.sourceVersionId))
      .orderBy(sourceSegments.ordinal);

    expect(segments).toHaveLength(2);
    expect(segments[0].content).toContain('Chapter 1');
    expect(segments[0].locator).toEqual(
      expect.objectContaining({ pageNumber: 1 }),
    );
  });

  it('processes Tabular datasets into table segments with sheet and cellRange locators', async () => {
    const user = await seedUser();
    const notebook = await seedNotebook(user.id);
    const source = await seedSource(notebook.id, {
      kind: 'file',
      title: 'data.csv',
      rawText: '',
      s3Key: 'sources/data.csv',
      contentType: 'text/csv',
      modality: 'dataset',
    });

    const { handler, tabularInspector, tabularParser, queue } = createHandler();

    const job = {
      id: 'proc-job-tab-1',
      type: 'source_processing',
      payload: { sourceId: source.id },
      attempt: 1,
      maxAttempts: 3,
    } as any;

    const result = await handler.process(job);

    expect(tabularInspector.inspect).toHaveBeenCalledWith(
      expect.any(Buffer),
      'sources/data.csv',
      'text/csv',
    );
    expect(tabularParser.parse).toHaveBeenCalledWith(
      expect.any(Buffer),
      'sources/data.csv',
    );
    expect(queue.enqueueIfActive).toHaveBeenCalled();
    expect(result.segmentCount).toBe(1);

    const segments = await db
      .select()
      .from(sourceSegments)
      .where(eq(sourceSegments.sourceVersionId, result.sourceVersionId));

    expect(segments).toHaveLength(1);
    expect(segments[0].kind).toBe('table');
    expect(segments[0].locator).toEqual(
      expect.objectContaining({ sheetName: 'Sheet 1', cellRange: 'A1:B3' }),
    );
  });
});
