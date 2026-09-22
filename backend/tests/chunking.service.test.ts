import { describe, expect, it } from 'vitest';
import {
  CHUNKING_VERSION,
  ChunkingService,
  DEFAULT_CHUNKING_CONFIG,
  chunkContextHeader,
  estimateChunkTokens,
  loadChunkingConfig,
  stripChunkContentHeader,
} from '../src/modules/ai/chunking.service';
import { GOLDEN_SOURCES } from './eval/golden-set';

/** A paragraph of `sentences` sentences, each `words` words long. */
function paragraph(sentences: number, words: number, seed = 'alpha'): string {
  return Array.from(
    { length: sentences },
    (_, index) =>
      `${seed} sentence ${index} ${Array.from(
        { length: words },
        (_, word) => `${seed}${word}`,
      ).join(' ')}.`,
  ).join(' ');
}

/** A space-separated blob of `count` three-character words. */
function wordBlob(count: number): string {
  return Array.from({ length: count }, (_, index) => `ab${index % 10}`).join(
    ' ',
  );
}

/** Collapses whitespace so re-joined chunks can be compared to the source. */
function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

describe('ChunkingService', () => {
  it('preserves source version provenance, segment locators, and heading paths', () => {
    const chunks = new ChunkingService().chunkSource({
      id: 'source-1',
      notebookId: 'notebook-1',
      kind: 'text',
      title: 'Lecture notes',
      rawText: 'legacy fallback',
      sourceVersionId: 'version-1',
      segments: [
        {
          id: 'segment-1',
          content: 'The derivative measures instantaneous change.',
          headingPath: ['Calculus', 'Derivatives'],
          locator: { pageNumber: 4 },
        },
      ],
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      sourceVersionId: 'version-1',
      segmentIds: ['segment-1'],
      locator: { pageNumber: 4 },
      headingPath: ['Calculus', 'Derivatives'],
      sourceKind: 'text',
      chunkingVersion: CHUNKING_VERSION,
    });
    expect(chunks[0].contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('stores the contextual header on the searchable text, not the body', () => {
    const chunks = new ChunkingService().chunkSource({
      id: 'source-1',
      notebookId: 'notebook-1',
      kind: 'url',
      title: 'Cell Biology Lecture Notes',
      rawText: '',
      segments: [
        {
          id: 'segment-1',
          content:
            'Mitochondria generate most of the chemical energy of a cell.',
          headingPath: ['Chapter 2', 'The Mitochondrion'],
        },
      ],
    });

    expect(chunks).toHaveLength(1);
    const chunk = chunks[0];
    expect(chunk.contextHeader).toBe(
      chunkContextHeader({
        title: 'Cell Biology Lecture Notes',
        kind: 'url',
        headingPath: ['Chapter 2', 'The Mitochondrion'],
      }),
    );
    expect(chunk.contextHeader).toContain('Kind: url');
    expect(chunk.contextHeader).toContain(
      'Section: Chapter 2 > The Mitochondrion',
    );
    // The searchable text carries the context; the stored body stays the text
    // shown to the model and used for citations.
    expect(chunk.searchableText).toBe(
      `${chunk.contextHeader}Mitochondria generate most of the chemical energy of a cell.`,
    );
    expect(chunk.content).toBe(
      'Source: "Cell Biology Lecture Notes"\nMitochondria generate most of the chemical energy of a cell.',
    );
    expect(chunk.content).not.toContain('Section:');
  });

  it('omits the Section line when the segment has no heading path', () => {
    const chunks = new ChunkingService().chunkSource({
      id: 'source-1',
      notebookId: 'notebook-1',
      kind: 'text',
      title: 'Loose notes',
      rawText: 'Existing source text.',
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0].contextHeader).toBe('Source: "Loose notes"\nKind: text\n');
    expect(chunks[0].searchableText).toBe(
      `${chunks[0].contextHeader}Existing source text.`,
    );
    expect(chunks[0].segmentIds).toEqual([]);
    expect(chunks[0].locator).toEqual({});
  });

  it('never merges two source segments into one chunk', () => {
    const chunks = new ChunkingService().chunkSource({
      id: 'source-1',
      notebookId: 'notebook-1',
      kind: 'file',
      title: 'Manual',
      rawText: '',
      segments: [
        { id: 'segment-1', content: 'Short intro.', headingPath: ['Intro'] },
        { id: 'segment-2', content: 'Short body.', headingPath: ['Body'] },
      ],
    });

    expect(chunks.map((chunk) => chunk.segmentIds)).toEqual([
      ['segment-1'],
      ['segment-2'],
    ]);
    expect(chunks.map((chunk) => chunk.headingPath)).toEqual([
      ['Intro'],
      ['Body'],
    ]);
  });

  it('sizes chunks in tokens and respects the target', () => {
    const service = new ChunkingService({
      targetTokens: 40,
      minTokens: 12,
      overlapTokens: 0,
    });
    const chunks = service.chunkText(
      [paragraph(4, 12, 'alpha'), paragraph(4, 12, 'beta')].join('\n\n'),
    );

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(estimateChunkTokens(chunk)).toBeLessThanOrEqual(40);
    }
  });

  it('keeps whole paragraphs and sentences instead of cutting them', () => {
    const service = new ChunkingService({
      targetTokens: 70,
      minTokens: 8,
      overlapTokens: 0,
    });
    const first = paragraph(3, 10, 'alpha');
    const second = paragraph(3, 10, 'beta');
    const chunks = service.chunkText(`${first}\n\n${second}`);

    expect(chunks).toEqual([first, second]);
    for (const chunk of chunks) {
      // Every sentence keeps its closing punctuation: no mid-sentence cut.
      const sentences = chunk.split(/(?<=\.)\s+/);
      for (const sentence of sentences) {
        expect(sentence.endsWith('.')).toBe(true);
      }
    }
  });

  it('merges a fragment below the minimum into its neighbour', () => {
    const service = new ChunkingService({
      targetTokens: 12,
      minTokens: 8,
      overlapTokens: 0,
    });
    // 11 tokens and 4 tokens: the pair exceeds the target, but the fragment
    // alone is below the minimum.
    const long = wordBlob(11);
    const fragment = wordBlob(4);
    expect(estimateChunkTokens(long)).toBe(11);
    expect(estimateChunkTokens(fragment)).toBe(4);

    for (const text of [`${long}\n\n${fragment}`, `${fragment}\n\n${long}`]) {
      const chunks = service.chunkText(text);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toContain(long);
      expect(chunks[0]).toContain(fragment);
      expect(estimateChunkTokens(chunks[0])).toBe(15);
    }
  });

  it('keeps a document shorter than the minimum as a single chunk', () => {
    const chunks = new ChunkingService({
      targetTokens: 40,
      minTokens: 30,
      overlapTokens: 0,
    }).chunkText('Too short to split.');

    expect(chunks).toEqual(['Too short to split.']);
  });

  it('overlaps consecutive chunks by whole words', () => {
    const chunks = new ChunkingService({
      targetTokens: 3,
      minTokens: 2,
      overlapTokens: 1,
    }).chunkText('one two three four five six seven eight nine ten');

    expect(chunks[0]).toBe('one two');
    // The tail of the previous chunk is repeated at a word boundary.
    expect(chunks[1]).toBe('two\n\nthree four');
  });

  it('reads chunk sizing from the environment and clamps invalid values', () => {
    expect(loadChunkingConfig({})).toEqual(DEFAULT_CHUNKING_CONFIG);
    expect(
      loadChunkingConfig({
        CHUNK_TARGET_TOKENS: '100',
        CHUNK_MIN_TOKENS: '500',
        CHUNK_OVERLAP_TOKENS: '200',
      }),
    ).toEqual({ targetTokens: 100, minTokens: 100, overlapTokens: 99 });
    expect(
      loadChunkingConfig({
        CHUNK_TARGET_TOKENS: 'nonsense',
        CHUNK_MIN_TOKENS: '0',
        CHUNK_OVERLAP_TOKENS: '-5',
      }),
    ).toEqual(DEFAULT_CHUNKING_CONFIG);
  });

  it('preserves text around newlines and before the first sentence terminator', () => {
    const service = new ChunkingService({
      targetTokens: 16,
      minTokens: 4,
      overlapTokens: 0,
    });
    // The first clause ends in a newline, not a terminator; the old splitter
    // dropped it from both the searchable text and the stored content.
    const text =
      'The mitochondria produce ATP\nthrough oxidative phosphorylation. This is important.';
    const chunks = service.chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(collapseWhitespace(chunks.join(' '))).toBe(collapseWhitespace(text));
    expect(chunks.join(' ')).toContain('The mitochondria produce ATP');
    expect(chunks.join(' ')).toContain('through oxidative phosphorylation.');
    expect(chunks.join(' ')).toContain('This is important.');
  });

  it('keeps terminator runs and leading text when a paragraph is split', () => {
    const chunks = new ChunkingService({
      targetTokens: 5,
      minTokens: 2,
      overlapTokens: 0,
    }).chunkText('Wait... what?! Really?');

    expect(collapseWhitespace(chunks.join(' '))).toBe('Wait... what?! Really?');
  });

  it('bumps the chunking version for the contextual representation', () => {
    expect(CHUNKING_VERSION).toBe(2);
  });

  it('chunks the section-dependent evaluation corpus without losing text', () => {
    const source = GOLDEN_SOURCES.find((entry) => entry.id === 'lab-manual');
    expect(source).toBeDefined();
    const service = new ChunkingService();

    // Each golden section is a sub-minimum fragment. Sections never merge
    // across each other, so every one stays its own chunk with its heading
    // path, and the body survives byte for byte.
    const perSection = service.chunkSource({
      id: source!.id,
      notebookId: 'eval',
      kind: source!.kind,
      title: source!.title,
      rawText: source!.chunks.map((chunk) => chunk.text).join('\n\n'),
      segments: source!.chunks.map((chunk, index) => ({
        id: `segment-${index}`,
        content: chunk.text,
        headingPath: chunk.headingPath ?? [],
      })),
    });

    expect(perSection).toHaveLength(source!.chunks.length);
    perSection.forEach((chunk, index) => {
      const golden = source!.chunks[index];
      expect(chunk.headingPath).toEqual(golden.headingPath);
      expect(chunk.contextHeader).toContain(
        `Section: ${golden.headingPath!.join(' > ')}`,
      );
      expect(stripChunkContentHeader(chunk.content)).toBe(golden.text);
    });

    // The same corpus as one long document exercises real token sizing: the
    // text is split into multiple chunks that respect the minimum and stay
    // within the target, and no text is lost.
    const rawText = source!.chunks.map((chunk) => chunk.text).join('\n\n');
    const sized = new ChunkingService({
      targetTokens: 60,
      minTokens: 20,
      overlapTokens: 0,
    }).chunkSource({
      id: source!.id,
      notebookId: 'eval',
      kind: source!.kind,
      title: source!.title,
      rawText,
    });

    expect(sized.length).toBeGreaterThan(1);
    for (const chunk of sized) {
      const body = stripChunkContentHeader(chunk.content);
      expect(estimateChunkTokens(body)).toBeGreaterThanOrEqual(20);
      expect(estimateChunkTokens(body)).toBeLessThanOrEqual(60 + 20);
    }
    expect(
      collapseWhitespace(
        sized.map((chunk) => stripChunkContentHeader(chunk.content)).join(' '),
      ),
    ).toBe(collapseWhitespace(rawText));
  });
});
