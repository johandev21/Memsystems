import { describe, expect, it } from 'vitest';
import {
  DocumentNormalizerService,
  NORMALIZATION_VERSION,
  sectionsFromHtml,
  sectionsFromMarkdown,
} from '../src/modules/sources/document-normalizer.service';
import type { ScrapedPage } from '../src/modules/sources/web-scraper.service';

const service = new DocumentNormalizerService();

function scrapedPage(
  html: string,
  overrides: Partial<ScrapedPage> = {},
): ScrapedPage {
  return {
    title: 'Test Article',
    text: '',
    html,
    ...overrides,
  };
}

describe('DocumentNormalizerService.fromText', () => {
  it('produces a single section and a deterministic content hash', () => {
    const first = service.fromText('Line one.\n\n\nLine two.', 'Doc');
    const second = service.fromText('Line one.\n\n\nLine two.', 'Doc');

    expect(first.sections).toHaveLength(1);
    expect(first.sections[0].headingPath).toEqual([]);
    expect(first.text).toBe('Line one.\n\nLine two.');
    expect(first.contentHash).toBe(second.contentHash);
    expect(first.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.extractionMethod).toBe('text');
  });

  it('preserves legitimate bracketed text', () => {
    const doc = service.fromText(
      'See [RFC 9110] for details. Access arr[0] and obj["key"].',
      'Doc',
    );
    expect(doc.text).toContain('[RFC 9110]');
    expect(doc.text).toContain('arr[0]');
  });
});

describe('DocumentNormalizerService.fromFile', () => {
  it('treats markdown files as structured documents', () => {
    const doc = service.fromFile({
      text: '# Title\n\nIntro.\n\n## Section A\n\nBody with `code`.\n\n```ts\nconst x = 1;\n# not a heading\n```\n',
      contentType: 'text/markdown',
      fileName: 'notes.md',
    });

    expect(doc.extractionMethod).toBe('file');
    expect(doc.markdown).toBeDefined();
    expect(doc.sections.map((s) => s.headingPath)).toEqual([
      ['Title'],
      ['Title', 'Section A'],
    ]);
    // The `# not a heading` line inside the fence is preserved as content
    expect(doc.sections[1].content).toContain('# not a heading');
    expect(doc.sections[1].content).toContain('const x = 1;');
  });

  it('detects markdown by extension', () => {
    const doc = service.fromFile({
      text: '# Only Heading',
      contentType: 'application/octet-stream',
      fileName: 'notes.markdown',
    });
    expect(doc.sections[0].headingPath).toEqual(['Only Heading']);
  });

  it('produces a single section for plain text files', () => {
    const doc = service.fromFile({
      text: 'Just prose.\n\nMore prose.',
      contentType: 'text/plain',
      fileName: 'notes.txt',
    });
    expect(doc.sections).toHaveLength(1);
    expect(doc.markdown).toBeUndefined();
  });
});

describe('sectionsFromHtml', () => {
  const articleHtml = [
    '<h1>Title</h1>',
    '<p>First paragraph with a citation. [1] It continues here.</p>',
    '<h2>Section A</h2>',
    '<p>Content of A. See [RFC 9110] for details, or arr[0].</p>',
    '<pre><code>def f(x):\n    return x</code></pre>',
    '<h3>Subsection</h3>',
    '<p>Deep content.</p>',
  ].join('');

  it('builds a heading hierarchy and preserves code blocks', () => {
    const sections = sectionsFromHtml(articleHtml);

    expect(sections).toHaveLength(3);
    expect(sections[0].headingPath).toEqual(['Title']);
    expect(sections[1].headingPath).toEqual(['Title', 'Section A']);
    expect(sections[2].headingPath).toEqual([
      'Title',
      'Section A',
      'Subsection',
    ]);
  });

  it('strips proven inline citations but preserves RFC and array syntax', () => {
    const sections = sectionsFromHtml(articleHtml);
    expect(sections[0].content).not.toContain('[1]');
    expect(sections[0].content).toContain('It continues here.');
    expect(sections[1].content).toContain('[RFC 9110]');
    expect(sections[1].content).toContain('arr[0]');
    expect(sections[1].content).toContain('def f(x):\n    return x');
  });

  it('handles articles without headings', () => {
    const sections = sectionsFromHtml('<p>One paragraph only.</p>');
    expect(sections).toHaveLength(1);
    expect(sections[0].headingPath).toEqual([]);
  });

  it('assigns ordinals deterministically', () => {
    const sections = sectionsFromHtml(articleHtml);
    expect(sections.map((s) => s.ordinal)).toEqual([0, 1, 2]);
  });
});

describe('sectionsFromMarkdown', () => {
  it('ignores headings inside code fences', () => {
    const sections = sectionsFromMarkdown(
      '```\n# code heading\n```\n\n# Real heading\n\nText.',
    );
    // Content before the first heading forms an unnamed intro section
    expect(sections.map((s) => s.headingPath)).toEqual([[], ['Real heading']]);
    expect(sections[1].content).not.toContain('code heading');
  });
});

describe('DocumentNormalizerService.fromHtml', () => {
  it('records extraction method, metadata and content hash', () => {
    const page = scrapedPage('<p>Body text.</p>', {
      title: 'Page Title',
      lang: 'en',
      byline: 'Jane Doe',
      siteName: 'Example Site',
      text: 'Body text.',
    });

    const doc = service.fromHtml(page, {
      sourceUrl: 'https://example.com/a?utm=1',
      canonicalUrl: 'https://example.com/a',
      fetchedUrl: 'https://example.com/a',
      contentType: 'text/html',
    });

    expect(doc.extractionMethod).toBe('readability');
    expect(doc.title).toBe('Page Title');
    expect(doc.language).toBe('en');
    expect(doc.author).toBe('Jane Doe');
    expect(doc.siteName).toBe('Example Site');
    expect(doc.sourceUrl).toBe('https://example.com/a?utm=1');
    expect(doc.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('DocumentNormalizerService.fromImageResult', () => {
  it('normalizes vision extraction result with sections, kind, and imageRegion locators', () => {
    const visionResult = {
      title: 'Neural Networks Architecture',
      rawText:
        'Introduction\n\n$$\\sigma(z) = \\frac{1}{1 + e^{-z}}$$\n\nNetwork Diagram',
      segments: [
        {
          kind: 'heading' as const,
          content: 'Introduction',
          confidence: 0.99,
          imageRegion: { x: 0.05, y: 0.05, width: 0.9, height: 0.1 },
        },
        {
          kind: 'formula' as const,
          content: '$$\\sigma(z) = \\frac{1}{1 + e^{-z}}$$',
          confidence: 0.98,
          imageRegion: { x: 0.2, y: 0.2, width: 0.6, height: 0.15 },
        },
        {
          kind: 'visual_description' as const,
          content: 'Network Diagram',
          confidence: 0.95,
          imageRegion: { x: 0.1, y: 0.4, width: 0.8, height: 0.5 },
        },
      ],
    };

    const doc = service.fromImageResult(visionResult, {
      fileName: 'nn.png',
      contentType: 'image/png',
    });

    expect(doc.extractionMethod).toBe('vision');
    expect(doc.title).toBe('Neural Networks Architecture');
    expect(doc.contentType).toBe('image/png');
    expect(doc.sections).toHaveLength(3);

    expect(doc.sections[0]).toEqual({
      headingPath: ['Introduction'],
      content: 'Introduction',
      ordinal: 0,
      kind: 'heading',
      locator: { imageRegion: { x: 0.05, y: 0.05, width: 0.9, height: 0.1 } },
      metadata: { confidence: 0.99 },
    });

    expect(doc.sections[1]).toEqual({
      headingPath: ['Introduction'],
      content: '$$\\sigma(z) = \\frac{1}{1 + e^{-z}}$$',
      ordinal: 1,
      kind: 'formula',
      locator: { imageRegion: { x: 0.2, y: 0.2, width: 0.6, height: 0.15 } },
      metadata: { confidence: 0.98 },
    });

    expect(doc.sections[2]).toEqual({
      headingPath: ['Introduction'],
      content: 'Network Diagram',
      ordinal: 2,
      kind: 'visual_description',
      locator: { imageRegion: { x: 0.1, y: 0.4, width: 0.8, height: 0.5 } },
      metadata: { confidence: 0.95 },
    });

    expect(doc.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('DocumentNormalizerService.fromAudioResult', () => {
  it('normalizes transcription result with transcript sections, timestamps, and speaker locators', () => {
    const audioResult = {
      title: 'Design Meeting',
      language: 'en',
      durationMs: 9000,
      rawText: 'Hello team.\n\nLet us begin.',
      segments: [
        {
          speaker: 'Speaker A',
          content: 'Hello team.',
          startOffsetMs: 0,
          endOffsetMs: 3000,
          confidence: 0.99,
        },
        {
          speaker: 'Speaker B',
          content: 'Let us begin.',
          startOffsetMs: 3500,
          endOffsetMs: 9000,
          confidence: 0.95,
        },
      ],
    };

    const doc = service.fromAudioResult(audioResult, {
      fileName: 'meeting.mp3',
      contentType: 'audio/mpeg',
    });

    expect(doc.extractionMethod).toBe('transcription');
    expect(doc.title).toBe('Design Meeting');
    expect(doc.language).toBe('en');
    expect(doc.contentType).toBe('audio/mpeg');
    expect(doc.sections).toHaveLength(2);

    expect(doc.sections[0]).toEqual({
      headingPath: ['Speaker A'],
      content: 'Hello team.',
      ordinal: 0,
      kind: 'transcript',
      locator: {
        speaker: 'Speaker A',
        startOffsetMs: 0,
        endOffsetMs: 3000,
      },
      metadata: {
        confidence: 0.99,
        durationMs: 9000,
      },
    });

    expect(doc.sections[1]).toEqual({
      headingPath: ['Speaker B'],
      content: 'Let us begin.',
      ordinal: 1,
      kind: 'transcript',
      locator: {
        speaker: 'Speaker B',
        startOffsetMs: 3500,
        endOffsetMs: 9000,
      },
      metadata: {
        confidence: 0.95,
        durationMs: 9000,
      },
    });

    expect(doc.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('DocumentNormalizerService.fromVideoResult', () => {
  it('normalizes video transcription result with transcript sections, timestamps, and speaker locators', () => {
    const videoResult = {
      title: 'Keynote Talk',
      language: 'en',
      durationMs: 15000,
      rawText: 'Welcome everyone.\n\nHere is the roadmap.',
      segments: [
        {
          speaker: 'Presenter',
          content: 'Welcome everyone.',
          startOffsetMs: 0,
          endOffsetMs: 5000,
          confidence: 0.98,
        },
        {
          speaker: 'Presenter',
          content: 'Here is the roadmap.',
          startOffsetMs: 5500,
          endOffsetMs: 15000,
          confidence: 0.96,
        },
      ],
    };

    const doc = service.fromVideoResult(videoResult, {
      fileName: 'keynote.mp4',
      contentType: 'video/mp4',
    });

    expect(doc.extractionMethod).toBe('transcription');
    expect(doc.title).toBe('Keynote Talk');
    expect(doc.language).toBe('en');
    expect(doc.contentType).toBe('video/mp4');
    expect(doc.sections).toHaveLength(2);

    expect(doc.sections[0]).toEqual({
      headingPath: ['Presenter'],
      content: 'Welcome everyone.',
      ordinal: 0,
      kind: 'transcript',
      locator: {
        speaker: 'Presenter',
        startOffsetMs: 0,
        endOffsetMs: 5000,
      },
      metadata: {
        confidence: 0.98,
        durationMs: 15000,
      },
    });

    expect(doc.sections[1]).toEqual({
      headingPath: ['Presenter'],
      content: 'Here is the roadmap.',
      ordinal: 1,
      kind: 'transcript',
      locator: {
        speaker: 'Presenter',
        startOffsetMs: 5500,
        endOffsetMs: 15000,
      },
      metadata: {
        confidence: 0.96,
        durationMs: 15000,
      },
    });

    expect(doc.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('merges visual keyframes with transcript segments chronologically', () => {
    const videoResult = {
      title: 'ML Lecture',
      durationMs: 30000,
      rawText: 'Introduction to CNNs.',
      segments: [
        {
          speaker: 'Prof',
          content: 'Introduction to CNNs.',
          startOffsetMs: 5000,
          endOffsetMs: 15000,
        },
      ],
    };

    const visualResults = [
      {
        keyframe: {
          timestampMs: 0,
          durationMs: 5000,
          buffer: Buffer.from('img-0'),
          mimeType: 'image/png' as const,
          isKeyframe: true,
        },
        result: {
          title: 'Title Slide',
          rawText: 'Title Slide',
          segments: [
            {
              kind: 'heading' as const,
              content: 'Convolutional Neural Networks',
              imageRegion: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 },
            },
          ],
        },
      },
      {
        keyframe: {
          timestampMs: 20000,
          durationMs: 10000,
          buffer: Buffer.from('img-1'),
          mimeType: 'image/png' as const,
          isKeyframe: true,
        },
        result: {
          title: 'Diagram',
          rawText: 'Diagram',
          segments: [
            {
              kind: 'visual_description' as const,
              content: 'Architecture diagram showing Conv2D and MaxPool layers',
              imageRegion: { x: 0.05, y: 0.2, width: 0.9, height: 0.6 },
            },
          ],
        },
      },
    ];

    const doc = service.fromVideoResult(videoResult, {
      fileName: 'lecture.mp4',
      contentType: 'video/mp4',
      visualResults,
    });

    expect(doc.extractionMethod).toBe('video');
    expect(doc.sections).toHaveLength(3);

    // Sorted chronologically: 0ms (visual), 5000ms (transcript), 20000ms (visual)
    expect(doc.sections[0].kind).toBe('heading');
    expect(doc.sections[0].locator).toEqual({
      startOffsetMs: 0,
      endOffsetMs: 5000,
      imageRegion: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 },
    });

    expect(doc.sections[1].kind).toBe('transcript');
    expect(doc.sections[1].locator).toEqual(
      expect.objectContaining({
        startOffsetMs: 5000,
        endOffsetMs: 15000,
        speaker: 'Prof',
      }),
    );

    expect(doc.sections[2].kind).toBe('visual_description');
    expect(doc.sections[2].locator).toEqual({
      startOffsetMs: 20000,
      endOffsetMs: 30000,
      imageRegion: { x: 0.05, y: 0.2, width: 0.9, height: 0.6 },
    });
  });
});

describe('DocumentNormalizerService.fromYouTubeResult', () => {
  it('normalizes YouTube acquisition result with transcript sections and locators', () => {
    const ytResult = {
      videoId: 'dQw4w9WgXcQ',
      title: 'YouTube Deep Dive',
      author: 'Channel Host',
      durationMs: 60000,
      rawText: 'Section 1 text.\n\nSection 2 text.',
      segments: [
        {
          content: 'Section 1 text.',
          startOffsetMs: 0,
          endOffsetMs: 30000,
          speaker: 'Channel Host',
        },
        {
          content: 'Section 2 text.',
          startOffsetMs: 30000,
          endOffsetMs: 60000,
          speaker: 'Channel Host',
        },
      ],
    };

    const doc = service.fromYouTubeResult(ytResult, {
      contentType: 'text/html',
    });

    expect(doc.extractionMethod).toBe('youtube');
    expect(doc.title).toBe('YouTube Deep Dive');
    expect(doc.author).toBe('Channel Host');
    expect(doc.siteName).toBe('YouTube');
    expect(doc.sourceUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(doc.canonicalUrl).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );
    expect(doc.sections).toHaveLength(2);

    expect(doc.sections[0]).toEqual({
      headingPath: ['Channel Host'],
      content: 'Section 1 text.',
      ordinal: 0,
      kind: 'transcript',
      locator: {
        speaker: 'Channel Host',
        startOffsetMs: 0,
        endOffsetMs: 30000,
      },
      metadata: {
        durationMs: 60000,
      },
    });

    expect(doc.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('DocumentNormalizerService.fromTabularResult', () => {
  it('normalizes tabular dataset results with table sections and dimension locators', () => {
    const tabularResult = {
      fileName: 'metrics.csv',
      title: 'metrics',
      format: 'csv' as const,
      totalRows: 10,
      totalColumns: 3,
      sheetCount: 1,
      sheets: [
        {
          sheetName: 'Sheet 1',
          rowCount: 10,
          columnCount: 3,
          cellRange: 'A1:C11',
          headers: ['id', 'metric', 'val'],
          columns: [
            {
              name: 'id',
              type: 'number' as const,
              nonNullCount: 10,
              nullCount: 0,
              uniqueSampleValues: ['1'],
            },
          ],
          sampleRows: [['1', 'cpu', '45.2']],
          markdownTable:
            '| id | metric | val |\n|---|---|---|\n| 1 | cpu | 45.2 |',
          rawText: '## Sheet: Sheet 1\n\n| id | metric | val |',
        },
      ],
      rawText: '# metrics\n\n## Sheet: Sheet 1\n\n| id | metric | val |',
    };

    const doc = service.fromTabularResult(tabularResult);
    expect(doc.extractionMethod).toBe('tabular');
    expect(doc.title).toBe('metrics');
    expect(doc.sections).toHaveLength(1);
    expect(doc.sections[0].kind).toBe('table');
    expect(doc.sections[0].locator?.sheetName).toBe('Sheet 1');
    expect(doc.sections[0].locator?.cellRange).toBe('A1:C11');
    expect(doc.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('versioning', () => {
  it('exposes a stable normalization version', () => {
    expect(NORMALIZATION_VERSION).toBe(1);
  });
});
