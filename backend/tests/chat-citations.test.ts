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
      sourceId: 'source-2',
      chunkId: 'chunk-2',
      chunkIndex: 4,
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

  it('normalizes legacy source ids into a safe compatibility shape', () => {
    expect(normalizeStoredCitation('source-1', 2)).toEqual({
      schemaVersion: 0,
      citationKey: 'legacy-3',
      sourceId: 'source-1',
      chunkId: null,
      chunkIndex: null,
      number: 3,
      title: null,
      kind: null,
      url: null,
      description: null,
      quote: null,
    });
  });
});
