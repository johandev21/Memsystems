import { describe, expect, it } from 'vitest';
import type { RetrievedChunk } from '../src/modules/ai/retrieval.service';
import {
  MAX_CITATION_EXCERPT_LENGTH,
  createCitationEvidence,
  extractCitationEntries,
  formatCitationContext,
  normalizeStoredCitation,
  sanitizeReferenceUrl,
} from '../src/modules/chat/chat-citations';

function chunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    chunkId: 'chunk-1',
    chunkIndex: 0,
    sourceVersionId: 'version-1',
    locator: { pageNumber: 4 },
    sourceId: 'source-1',
    title: 'The Republic',
    content: 'Justice is examined through a conversation in the city.',
    score: 0.91,
    url: 'https://example.com/republic',
    kind: 'url',
    ...overrides,
  };
}

describe('chat citation mapping', () => {
  it('assigns opaque evidence keys and includes them in the model context', () => {
    const evidence = createCitationEvidence([
      chunk(),
      chunk({ chunkId: 'chunk-2', chunkIndex: 1 }),
    ]);

    expect(evidence.map((item) => item.citationKey)).toEqual(['R1', 'R2']);
    expect(formatCitationContext(evidence)).toContain('[Evidence R1]');
    expect(formatCitationContext(evidence)).toContain('[Evidence R2]');
  });

  it('maps valid citations in response order and ignores duplicates and unknown keys', () => {
    const evidence = createCitationEvidence([
      chunk(),
      chunk({
        chunkId: 'chunk-2',
        chunkIndex: 4,
        sourceId: 'source-2',
        title: 'Stanford Encyclopedia of Philosophy',
      }),
    ]);

    const citations = extractCitationEntries(
      'The later source supports this. [ref:R2] Earlier evidence agrees. [ref:R1] Again. [ref:R2] Unknown. [ref:R9]',
      evidence,
    );

    expect(citations).toHaveLength(2);
    expect(citations.map((citation) => citation.citationKey)).toEqual([
      'R2',
      'R1',
    ]);
    expect(citations.map((citation) => citation.number)).toEqual([1, 2]);
    expect(citations[0]).toMatchObject({
      schemaVersion: 2,
      sourceId: 'source-2',
      chunkId: 'chunk-2',
      chunkIndex: 4,
      sourceVersionId: 'version-1',
      locator: { pageNumber: 4 },
      title: 'Stanford Encyclopedia of Philosophy',
    });
  });

  it('keeps distinct chunks from the same source as distinct references', () => {
    const evidence = createCitationEvidence([
      chunk(),
      chunk({
        chunkId: 'chunk-2',
        chunkIndex: 1,
        content: 'A second passage.',
      }),
    ]);

    const citations = extractCitationEntries(
      'First. [ref:R1] Second. [ref:R2]',
      evidence,
    );

    expect(citations.map((citation) => citation.chunkId)).toEqual([
      'chunk-1',
      'chunk-2',
    ]);
  });

  it('normalizes and caps excerpts without accepting unsafe URLs', () => {
    const content = `  ${'word '.repeat(150)}  `;
    const evidence = createCitationEvidence([
      chunk({ content, url: 'javascript:alert(1)' }),
    ]);

    const [citation] = extractCitationEntries('Claim. [ref:R1]', evidence);

    expect(citation.quote?.length).toBeLessThanOrEqual(
      MAX_CITATION_EXCERPT_LENGTH + 2,
    );
    expect(citation.quote).not.toMatch(/\s{2,}/);
    expect(citation.url).toBeNull();
    expect(sanitizeReferenceUrl('https://example.com/source')).toBe(
      'https://example.com/source',
    );
  });

  it('extracts model-emitted markdown links and backticked markers in order', () => {
    const evidence = createCitationEvidence([
      chunk(),
      chunk({
        chunkId: 'chunk-2',
        chunkIndex: 4,
        sourceId: 'source-2',
        title: 'Stanford Encyclopedia of Philosophy',
      }),
    ]);

    const citations = extractCitationEntries(
      'First `[ref:R2]` then [9](#reference-R1) then `[3](#reference-R2)` unknown [7](#reference-R9).',
      evidence,
    );

    expect(citations.map((citation) => citation.citationKey)).toEqual([
      'R2',
      'R1',
    ]);
    expect(citations.map((citation) => citation.number)).toEqual([1, 2]);
  });

  it('extracts clusters sharing one code span without duplicates', () => {
    const evidence = createCitationEvidence([
      chunk(),
      chunk({ chunkId: 'chunk-2', chunkIndex: 1, sourceId: 'source-2' }),
    ]);

    const citations = extractCitationEntries(
      'Cluster `[ref:R1][ref:R2]` then `[REF:R2][REF:R1]`.',
      evidence,
    );

    expect(citations.map((citation) => citation.citationKey)).toEqual([
      'R1',
      'R2',
    ]);
  });

  it('normalizes legacy source ids into a safe compatibility shape', () => {
    expect(normalizeStoredCitation('source-1', 2)).toEqual({
      schemaVersion: 0,
      citationKey: 'legacy-3',
      sourceId: 'source-1',
      chunkId: null,
      chunkIndex: null,
      sourceVersionId: null,
      locator: null,
      number: 3,
      title: null,
      kind: null,
      url: null,
      description: null,
      quote: null,
    });
  });

  it('normalizes v1 entries without losing their legacy fields', () => {
    expect(
      normalizeStoredCitation(
        {
          schemaVersion: 1,
          sourceId: 'source-1',
          chunkId: 'chunk-1',
          chunkIndex: 3,
          number: 2,
          title: 'Old source',
          kind: 'document',
          url: 'https://example.com/old',
          quote: 'An older citation.',
        },
        0,
      ),
    ).toMatchObject({
      schemaVersion: 1,
      sourceId: 'source-1',
      chunkId: 'chunk-1',
      chunkIndex: 3,
      sourceVersionId: null,
      locator: null,
    });
  });
});
