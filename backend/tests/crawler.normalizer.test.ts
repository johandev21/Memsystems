import { describe, expect, it } from 'vitest';
import {
  contentHashOf,
  DocumentNormalizerService,
  sectionsFromMarkdown,
} from '../src/modules/sources/document-normalizer.service';

const service = new DocumentNormalizerService();

const MARKDOWN_FIXTURE = [
  '# Hi',
  '',
  'Body paragraph with some text.',
  '',
  '## Sub',
  '',
  'More text under sub.',
  '',
  '### Deep',
  '',
  'Even more text.',
  '',
].join('\n');

describe('DocumentNormalizerService.fromFirecrawlResult', () => {
  it('maps title/text/markdown with extractionMethod firecrawl', () => {
    const doc = service.fromFirecrawlResult(
      {
        title: 'T',
        markdown: MARKDOWN_FIXTURE,
        metadata: { title: 'T', language: 'en' },
      },
      {
        sourceUrl: 'https://example.com/article',
        canonicalUrl: 'https://example.com/article',
        fetchedUrl: 'https://example.com/article',
        contentType: 'text/markdown',
      },
    );

    expect(doc.title).toBe('T');
    expect(doc.markdown).toBe(MARKDOWN_FIXTURE);
    expect(doc.text).toContain('Body paragraph with some text.');
    expect(doc.extractionMethod).toBe('firecrawl');
    expect(doc.sourceUrl).toBe('https://example.com/article');
    expect(doc.canonicalUrl).toBe('https://example.com/article');
    expect(doc.fetchedUrl).toBe('https://example.com/article');
    expect(doc.contentType).toBe('text/markdown');
    expect(doc.language).toBe('en');
    expect(doc.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces a stable contentHash for identical input', () => {
    const input = {
      title: 'T',
      markdown: MARKDOWN_FIXTURE,
      metadata: { title: 'T', language: 'en' },
    } as const;
    const meta = {
      sourceUrl: 'https://example.com/article',
      canonicalUrl: 'https://example.com/article',
      fetchedUrl: 'https://example.com/article',
      contentType: 'text/markdown',
    } as const;

    const first = service.fromFirecrawlResult({ ...input }, { ...meta });
    const second = service.fromFirecrawlResult({ ...input }, { ...meta });

    expect(first.contentHash).toBe(second.contentHash);
    expect(first.contentHash).toBe(contentHashOf(first.text));
  });

  it('preserves markdown heading hierarchy in sections', () => {
    const doc = service.fromFirecrawlResult(
      { title: 'T', markdown: MARKDOWN_FIXTURE, metadata: {} },
      { sourceUrl: 'https://example.com/article' },
    );

    expect(doc.sections.map((s) => s.headingPath)).toEqual([
      ['Hi'],
      ['Hi', 'Sub'],
      ['Hi', 'Sub', 'Deep'],
    ]);
    expect(doc.sections.map((s) => s.ordinal)).toEqual([0, 1, 2]);
    for (const section of doc.sections) {
      expect(section.content.length).toBeGreaterThan(0);
    }
  });

  it('matches sectionsFromMarkdown heading output', () => {
    const doc = service.fromFirecrawlResult(
      { title: 'T', markdown: MARKDOWN_FIXTURE, metadata: {} },
      { sourceUrl: 'https://example.com/article' },
    );
    const sections = sectionsFromMarkdown(MARKDOWN_FIXTURE);

    expect(doc.sections.map((s) => s.headingPath)).toEqual(
      sections.map((s) => s.headingPath),
    );
  });

  it('falls back to metadata title and then Untitled', () => {
    const fromMetadata = service.fromFirecrawlResult(
      { markdown: MARKDOWN_FIXTURE, metadata: { title: 'Meta Title' } },
      { sourceUrl: 'https://example.com/article' },
    );
    expect(fromMetadata.title).toBe('Meta Title');

    const untitled = service.fromFirecrawlResult(
      { markdown: MARKDOWN_FIXTURE, metadata: {} },
      { sourceUrl: 'https://example.com/article' },
    );
    expect(untitled.title).toBe('Untitled');
  });

  it('maps author/siteName/published/modified metadata', () => {
    const doc = service.fromFirecrawlResult(
      {
        title: 'T',
        markdown: MARKDOWN_FIXTURE,
        metadata: {
          language: 'en',
          author: 'Jane Doe',
          siteName: 'Example Site',
          publishedTime: '2025-01-01T00:00:00.000Z',
          modifiedTime: '2025-01-02T00:00:00.000Z',
        },
      },
      { sourceUrl: 'https://example.com/article' },
    );

    expect(doc.author).toBe('Jane Doe');
    expect(doc.siteName).toBe('Example Site');
    expect(doc.publishedAt).toBe('2025-01-01T00:00:00.000Z');
    expect(doc.modifiedAt).toBe('2025-01-02T00:00:00.000Z');
  });
});
