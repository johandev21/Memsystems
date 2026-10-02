import { describe, expect, it } from 'vitest';
import type { RetrievedChunk } from '../src/modules/ai/retrieval.service';
import {
  MAX_CITATION_EXCERPT_LENGTH,
  MIN_CITATION_SPAN_LENGTH,
  MIN_CITATION_SPAN_WORDS,
  MAX_PASSAGE_CONTEXT_LENGTH,
  attachScrollToTextFragment,
  createCitationEvidence,
  extractCitationEntries,
  extractPassageContext,
  formatCitationContext,
  normalizeStoredCitation,
  sanitizeReferenceUrl,
  selectSupportingSpan,
  verifyCitations,
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
    sectionPath: [],
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
      schemaVersion: 3,
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

  it('preserves page, slide, timestamp, and URL metadata on the citation', () => {
    const evidence = createCitationEvidence([
      chunk({
        locator: {
          pageNumber: 12,
          slideNumber: 4,
          startOffsetMs: 1500,
          endOffsetMs: 3200,
        },
        url: 'https://example.com/lecture.pdf',
      }),
    ]);

    const [citation] = extractCitationEntries('A claim. [ref:R1]', evidence);

    expect(citation.locator).toEqual({
      pageNumber: 12,
      slideNumber: 4,
      startOffsetMs: 1500,
      endOffsetMs: 3200,
    });
    expect(citation.url).toBe('https://example.com/lecture.pdf');
    expect(citation.chunkId).toBe('chunk-1');
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
      attribution: 'explicit',
      sectionPath: null,
      context: null,
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

describe('citation supporting spans', () => {
  const longChunk = chunk({
    content:
      'Osmosis is the net movement of water molecules across a selectively permeable membrane. The osmotic pressure needed to stop the flow depends on the size of the solute gradient.',
  });

  it('stores the supporting span instead of the whole chunk', () => {
    const evidence = createCitationEvidence([longChunk]);
    const [citation] = extractCitationEntries(
      'The pressure depends on the solute gradient. [ref:R1]',
      evidence,
    );

    expect(citation.quote).toBe(
      'The osmotic pressure needed to stop the flow depends on the size of the solute gradient.',
    );
    expect(citation.quote).not.toBe(longChunk.content);
    expect(longChunk.content).toContain(citation.quote!);
  });

  it('attaches a trailing marker to the sentence before it', () => {
    const evidence = createCitationEvidence([longChunk]);
    const [citation] = extractCitationEntries(
      'Osmosis is the net movement of water molecules across a selectively permeable membrane. [ref:R1] The next sentence is not the claim.',
      evidence,
    );

    expect(citation.quote).toContain('net movement of water');
    expect(citation.quote).not.toContain('next sentence');
  });

  it('prefers the sentence that covers the claim and falls back to the start', () => {
    const span = selectSupportingSpan(
      longChunk.content,
      'solute gradient pressure',
    );
    expect(span.text).toContain('osmotic pressure');
    expect(span.coverage).toBeGreaterThan(0);

    const fallback = selectSupportingSpan(
      longChunk.content,
      'quantum chromodynamics',
    );
    expect(fallback.text.startsWith('Osmosis is the net movement')).toBe(true);
    expect(fallback.coverage).toBe(0);
  });

  it('caps a long span without cutting a word in half or appending an ellipsis', () => {
    const content = `${'word '.repeat(150)}`;
    const span = selectSupportingSpan(content, 'word');

    expect(span.text.length).toBeLessThanOrEqual(MAX_CITATION_EXCERPT_LENGTH);
    expect(span.text.endsWith('...')).toBe(false);
    // The capped span stays a literal substring of the chunk.
    expect(content.includes(span.text)).toBe(true);
  });

  it('stores a span that crosses a newline literally', () => {
    const content =
      'Heat the round-bottom flask slowly and collect the fraction.\nRecord the volume of the distillate and cap the flask immediately.';
    const evidence = createCitationEvidence([chunk({ content })]);

    const [citation] = extractCitationEntries(
      'Heat the flask slowly and collect the fraction, then record the volume of the distillate. [ref:R1]',
      evidence,
    );

    expect(citation.quote).toContain('\n');
    expect(content.includes(citation.quote!)).toBe(true);
  });

  it('renders the section context and never the retrieval score', () => {
    const context = formatCitationContext(
      createCitationEvidence([
        chunk({
          sectionPath: ['Experiment 3', 'Fractional Distillation'],
          content: 'Source: "The Republic"\nHeat the flask slowly.',
        }),
      ]),
    );

    expect(context).toContain(
      'Section: Experiment 3 > Fractional Distillation',
    );
    expect(context).toContain('Heat the flask slowly.');
    // The block states the source once; the chunk's own header is stripped.
    expect(context.match(/Source: "/g)).toHaveLength(1);
    expect(context).not.toMatch(/Relevance|0\.91/);
  });
});

describe('citation verification', () => {
  it('drops unresolvable references and reports them', () => {
    const evidence = createCitationEvidence([chunk()]);
    const verification = verifyCitations(
      'A grounded claim. [ref:R1] An invented claim. [ref:R9]',
      evidence,
    );

    expect(verification.entries).toHaveLength(1);
    expect(verification.entries[0]).toMatchObject({
      citationKey: 'R1',
      attribution: 'explicit',
    });
    expect(verification.droppedKeys).toEqual(['R9']);
  });

  it('attributes an unmarked claim to the nearest evidence when attribution is enabled', () => {
    const evidence = createCitationEvidence([
      chunk(),
      chunk({
        chunkId: 'chunk-2',
        chunkIndex: 1,
        sourceId: 'source-2',
        title: 'Cell Biology Lecture Notes',
        content:
          'Osmosis is the net movement of water molecules across a selectively permeable membrane. The osmotic pressure depends on the solute gradient.',
      }),
    ]);

    const verification = verifyCitations(
      'Osmosis moves water molecules across a selectively permeable membrane.',
      evidence,
      { attribution: true },
    );

    expect(verification.entries).toHaveLength(1);
    expect(verification.entries[0]).toMatchObject({
      chunkId: 'chunk-2',
      attribution: 'nearest',
    });
    expect(verification.attributedClaims).toBe(1);
    expect(verification.entries[0].quote).toContain(
      'Osmosis is the net movement',
    );
  });

  it('attributes each evidence key once, in first-appearance order when attribution is enabled', () => {
    const evidence = createCitationEvidence([
      chunk(),
      chunk({
        chunkId: 'chunk-2',
        chunkIndex: 1,
        sourceId: 'source-2',
        content: 'Mitochondria generate most of the chemical energy in a cell.',
      }),
    ]);

    const verification = verifyCitations(
      'Mitochondria generate most of the chemical energy in a cell. Justice is examined through a conversation in the city. [ref:R1]',
      evidence,
      { attribution: true },
    );

    expect(verification.entries.map((entry) => entry.chunkId)).toEqual([
      'chunk-2',
      'chunk-1',
    ]);
    expect(verification.entries.map((entry) => entry.number)).toEqual([1, 2]);
  });

  it('does not attribute questions, short fragments, or ambiguous claims', () => {
    const evidence = createCitationEvidence([chunk()]);

    expect(
      verifyCitations('Why does justice matter?', evidence, { attribution: true }).entries,
    ).toEqual([]);
    expect(verifyCitations('Yes.', evidence, { attribution: true }).entries).toEqual([]);
    const ambiguous = verifyCitations(
      'The city and the conversation and justice are examined.',
      evidence,
      { attribution: true },
    );
    expect(ambiguous.entries).toHaveLength(1);
    // A claim the evidence barely covers is left unattributed.
    expect(
      verifyCitations(
        'Quantum chromodynamics binds the atomic nucleus.',
        evidence,
        { attribution: true },
      ).entries,
    ).toEqual([]);
  });

  it('skips fenced code blocks when attributing claims', () => {
    const evidence = createCitationEvidence([chunk()]);
    const verification = verifyCitations(
      '```\nJustice is examined through a conversation in the city.\n```',
      evidence,
      { attribution: true },
    );

    expect(verification.entries).toEqual([]);
  });

  it('attributes a claim even when its marker is unresolvable when attribution is enabled', () => {
    const evidence = createCitationEvidence([
      chunk({
        content:
          'Osmosis is the net movement of water molecules across a selectively permeable membrane.',
      }),
    ]);

    const verification = verifyCitations(
      '[ref:R9] Osmosis is the net movement of water molecules across a selectively permeable membrane.',
      evidence,
      { attribution: true },
    );

    expect(verification.droppedKeys).toEqual(['R9']);
    expect(verification.entries).toHaveLength(1);
    expect(verification.entries[0]).toMatchObject({
      chunkId: 'chunk-1',
      attribution: 'nearest',
    });
  });

  it('disables nearest-evidence auto-attribution by default to prevent phantom citations', () => {
    const evidence = createCitationEvidence([
      chunk({
        content:
          'Osmosis is the net movement of water molecules across a selectively permeable membrane.',
      }),
    ]);

    const verification = verifyCitations(
      'Osmosis moves water molecules across a selectively permeable membrane.',
      evidence,
    );

    expect(verification.entries).toHaveLength(0);
    expect(verification.attributedClaims).toBe(0);
  });

  it('preserves sectionPath and passage context on verified entries', () => {
    const evidence = createCitationEvidence([
      chunk({
        sectionPath: ['Aristotle', 'Logic', 'Demonstrations'],
        content:
          'Demonstrations depend on necessary premises. If the premises are true, primary, immediate, and better known than the conclusion, a scientific syllogism is produced.',
      }),
    ]);

    const verification = verifyCitations(
      'Scientific syllogisms require premises that are true and primary. [ref:R1]',
      evidence,
    );

    expect(verification.entries).toHaveLength(1);
    const entry = verification.entries[0];
    expect(entry.sectionPath).toEqual(['Aristotle', 'Logic', 'Demonstrations']);
    expect(entry.context).toContain('Demonstrations depend on necessary premises');
    expect(entry.context).toContain('scientific syllogism is produced');
    expect(entry.quote).toContain('premises are true, primary, immediate');
  });

  it('enforces minimum span length threshold (min 35 chars / 5 words) and falls back safely on cross-lingual queries', () => {
    const evidence = createCitationEvidence([
      chunk({
        content:
          'In. Conditions on Premises are strict. If premises are true and better known, a demonstration proceeds.',
      }),
    ]);

    // Cross-lingual query: Spanish claim against English text
    const span = selectSupportingSpan(
      evidence[0].content,
      '¿Cuáles son las condiciones de las premisas?',
    );

    // Must NOT select the 3-character sentence "In."
    expect(span.text).not.toBe('In.');
    expect(span.text.length).toBeGreaterThanOrEqual(MIN_CITATION_SPAN_LENGTH);
    expect(span.text).toContain('Conditions on Premises are strict');
  });

  it('attaches W3C scroll-to-text fragments to web URLs and skips PDFs', () => {
    const webEvidence = createCitationEvidence([
      chunk({
        url: 'https://example.com/logic/aristotle',
        kind: 'url',
        content:
          'Demonstrations depend on necessary premises. If the premises are true, primary, immediate, and better known than the conclusion, a scientific syllogism is produced.',
      }),
      chunk({
        chunkId: 'chunk-pdf',
        url: 'https://example.com/logic/paper.pdf',
        kind: 'pdf',
        content:
          'Demonstrations depend on necessary premises. If the premises are true, primary, immediate, and better known than the conclusion, a scientific syllogism is produced.',
      }),
    ]);

    const verification = verifyCitations(
      'Web claim. [ref:R1] PDF claim. [ref:R2]',
      webEvidence,
    );

    expect(verification.entries).toHaveLength(2);
    expect(verification.entries[0].url).toContain('https://example.com/logic/aristotle#:~:text=');
    // PDF URLs must NOT have text fragments
    expect(verification.entries[1].url).toBe('https://example.com/logic/paper.pdf');
    expect(verification.entries[1].url).not.toContain(':~:text=');
  });
});
