import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EVIDENCE_CONFIG,
  DEFAULT_EVIDENCE_TOKEN_BUDGET,
  DEFAULT_MAX_PER_SOURCE,
  DEFAULT_OVERLAP_THRESHOLD,
  assembleEvidence,
  chunkBody,
  loadRetrievalEvidenceConfig,
  type EvidencePassage,
  type RetrievalEvidenceConfig,
} from '../src/modules/ai/evidence-assembly';

function passage(
  id: string,
  overrides: Partial<EvidencePassage> = {},
): EvidencePassage {
  return {
    chunkId: id,
    sourceId: 'source-1',
    chunkIndex: 0,
    sectionPath: [],
    content: `Passage body ${id}`,
    ...overrides,
  };
}

function config(
  overrides: Partial<RetrievalEvidenceConfig> = {},
): RetrievalEvidenceConfig {
  return { ...DEFAULT_EVIDENCE_CONFIG, ...overrides };
}

describe('assembleEvidence overlap dedupe', () => {
  it('drops a passage a better-ranked passage contains', () => {
    const full =
      'Osmosis is the net movement of water across a selectively permeable membrane.';
    const { items, droppedOverlap } = assembleEvidence({
      candidates: [
        passage('full', { content: full }),
        passage('excerpt', {
          content:
            'the net movement of water across a selectively permeable membrane',
        }),
      ],
      topK: 4,
      perSource: false,
      config: config(),
    });

    expect(items.map((item) => item.passage.chunkId)).toEqual(['full']);
    expect(droppedOverlap.map((p) => p.chunkId)).toEqual(['excerpt']);
  });

  it('keeps passages that merely share vocabulary', () => {
    const { items, droppedOverlap } = assembleEvidence({
      candidates: [
        passage('a', {
          content:
            'A competitive inhibitor competes with the substrate for the active site.',
        }),
        passage('b', {
          content:
            'A noncompetitive inhibitor binds an allosteric site and changes the enzyme shape.',
        }),
      ],
      topK: 4,
      perSource: false,
      config: config(),
    });

    expect(items).toHaveLength(2);
    expect(droppedOverlap).toEqual([]);
  });

  it('keeps a longer passage that contains an earlier one', () => {
    const { items, droppedOverlap } = assembleEvidence({
      candidates: [
        passage('short', { content: 'Alpha beta gamma.' }),
        passage('long', {
          sourceId: 'source-2',
          content: 'Alpha beta gamma delta epsilon zeta eta theta.',
        }),
      ],
      topK: 4,
      perSource: false,
      config: config(),
    });

    // The longer candidate repeats the shorter one but adds text, so it is
    // not an overlap of it.
    expect(items.map((item) => item.passage.chunkId)).toEqual([
      'short',
      'long',
    ]);
    expect(droppedOverlap).toEqual([]);
  });

  it('ignores the overlap check when the threshold is 1', () => {
    const full = 'Alpha beta gamma delta epsilon zeta.';
    const { droppedOverlap } = assembleEvidence({
      candidates: [
        passage('full', { content: full }),
        passage('excerpt', { content: 'Alpha beta gamma delta epsilon zeta' }),
      ],
      topK: 4,
      perSource: false,
      config: config({ overlapThreshold: 1 }),
    });

    expect(droppedOverlap).toEqual([]);
  });

  it('strips the source-title header before measuring overlap', () => {
    const { droppedOverlap } = assembleEvidence({
      candidates: [
        passage('full', {
          content: 'Source: "Notes"\nAlpha beta gamma delta epsilon.',
        }),
        passage('excerpt', {
          content: 'Source: "Notes"\nAlpha beta gamma delta epsilon.',
        }),
      ],
      topK: 4,
      perSource: false,
      config: config(),
    });

    expect(droppedOverlap.map((p) => p.chunkId)).toEqual(['excerpt']);
  });
});

describe('assembleEvidence diversity cap', () => {
  it('caps one source and backfills when other sources run out', () => {
    const candidates = [
      passage('a-1', { sourceId: 'a' }),
      passage('a-2', { sourceId: 'a' }),
      passage('a-3', { sourceId: 'a' }),
      passage('b-1', { sourceId: 'b' }),
    ];
    const { items } = assembleEvidence({
      candidates,
      topK: 4,
      perSource: false,
      config: config({ maxPerSource: 2 }),
    });

    // a-1 and a-2 fill a's cap, b-1 joins them, and a-3 backfills the last
    // slot because no other source has a candidate left.
    expect(items.map((item) => item.passage.chunkId)).toEqual([
      'a-1',
      'a-2',
      'b-1',
      'a-3',
    ]);
  });

  it('stops at top-k and records what the cap left out', () => {
    const candidates = [
      passage('a-1', { sourceId: 'a' }),
      passage('a-2', { sourceId: 'a' }),
      passage('b-1', { sourceId: 'b' }),
      passage('a-3', { sourceId: 'a' }),
    ];
    const { items, droppedDiversity } = assembleEvidence({
      candidates,
      topK: 3,
      perSource: false,
      config: config({ maxPerSource: 1 }),
    });

    expect(items.map((item) => item.passage.chunkId)).toEqual([
      'a-1',
      'b-1',
      'a-2',
    ]);
    expect(droppedDiversity.map((p) => p.chunkId)).toEqual(['a-3']);
  });

  it('bounds each selected source independently', () => {
    const candidates = [
      passage('a-1', { sourceId: 'a' }),
      passage('a-2', { sourceId: 'a' }),
      passage('a-3', { sourceId: 'a' }),
      passage('b-1', { sourceId: 'b' }),
      passage('b-2', { sourceId: 'b' }),
    ];
    const { items, droppedDiversity } = assembleEvidence({
      candidates,
      topK: 2,
      perSource: true,
      // The diversity cap is not applied in the selected-source scope.
      config: config({ maxPerSource: 1 }),
    });

    expect(items.map((item) => item.passage.chunkId)).toEqual([
      'a-1',
      'a-2',
      'b-1',
      'b-2',
    ]);
    expect(droppedDiversity.map((p) => p.chunkId)).toEqual(['a-3']);
  });

  it('does not cap when maxPerSource is 0', () => {
    const candidates = Array.from({ length: 5 }, (_value, index) =>
      passage(`a-${index}`, { sourceId: 'a' }),
    );
    const { items } = assembleEvidence({
      candidates,
      topK: 5,
      perSource: false,
      config: config({ maxPerSource: 0 }),
    });

    expect(items).toHaveLength(5);
  });
});

describe('assembleEvidence token budget and section context', () => {
  it('carries the section path when expansion is enabled', () => {
    const { items, tokens } = assembleEvidence({
      candidates: [
        passage('a', {
          sectionPath: ['Experiment 3', 'Fractional Distillation'],
          content: 'Heat the flask slowly and collect the fraction.',
        }),
      ],
      topK: 4,
      perSource: false,
      config: config(),
    });

    expect(items[0].sectionExpanded).toBe(true);
    expect(items[0].tokens).toBeGreaterThan(0);
    expect(tokens).toBe(items[0].tokens);
  });

  it('leaves the section path out when expansion is disabled', () => {
    const { items } = assembleEvidence({
      candidates: [
        passage('a', {
          sectionPath: ['Experiment 3', 'Fractional Distillation'],
        }),
      ],
      topK: 4,
      perSource: false,
      config: config({ sectionExpansion: false }),
    });

    expect(items[0].sectionExpanded).toBe(false);
  });

  it('drops the section header before dropping the passage it belongs to', () => {
    const body = 'Alpha beta gamma delta epsilon zeta eta theta.';
    const budget =
      Math.ceil(body.length / 4) +
      Math.ceil('Section: A > Very Long Section Title\n'.length / 4) -
      2;
    const { items, budgetExhausted } = assembleEvidence({
      candidates: [
        passage('a', {
          content: body,
          sectionPath: ['A', 'Very Long Section Title'],
        }),
      ],
      topK: 4,
      perSource: false,
      config: config({ tokenBudget: budget }),
    });

    expect(items).toHaveLength(1);
    expect(items[0].sectionExpanded).toBe(false);
    expect(budgetExhausted).toBe(true);
  });

  it('stops adding passages at the budget and records the tail', () => {
    const content = 'alpha '.repeat(40);
    const other = 'omega '.repeat(40);
    const { items, droppedBudget, budgetExhausted, tokens } = assembleEvidence({
      candidates: [passage('a', { content }), passage('b', { content: other })],
      topK: 4,
      perSource: false,
      config: config({ tokenBudget: 60 }),
    });

    expect(items.map((item) => item.passage.chunkId)).toEqual(['a']);
    expect(droppedBudget.map((p) => p.chunkId)).toEqual(['b']);
    expect(budgetExhausted).toBe(true);
    expect(tokens).toBeLessThanOrEqual(60);
  });

  it('keeps the first passage even when it alone exceeds the budget', () => {
    const content = 'word '.repeat(200);
    const { items, budgetExhausted } = assembleEvidence({
      candidates: [passage('a', { content })],
      topK: 4,
      perSource: false,
      config: config({ tokenBudget: 10 }),
    });

    expect(items.map((item) => item.passage.chunkId)).toEqual(['a']);
    expect(budgetExhausted).toBe(true);
  });

  it('is deterministic for the same candidates', () => {
    const candidates = [
      passage('a-1', { sourceId: 'a', content: 'Alpha beta gamma delta.' }),
      passage('b-1', { sourceId: 'b', content: 'Epsilon zeta eta theta.' }),
      passage('a-2', { sourceId: 'a', content: 'Iota kappa lambda mu.' }),
    ];
    const first = assembleEvidence({
      candidates,
      topK: 2,
      perSource: false,
      config: config({ maxPerSource: 1 }),
    });
    const second = assembleEvidence({
      candidates,
      topK: 2,
      perSource: false,
      config: config({ maxPerSource: 1 }),
    });

    expect(first.items.map((item) => item.passage.chunkId)).toEqual(
      second.items.map((item) => item.passage.chunkId),
    );
  });
});

describe('assembleEvidence disabled', () => {
  it('falls back to the plain top-k selection', () => {
    const candidates = [
      passage('a-1', { sourceId: 'a' }),
      passage('a-2', { sourceId: 'a' }),
      passage('a-3', { sourceId: 'a' }),
    ];
    const { items, droppedOverlap, droppedDiversity } = assembleEvidence({
      candidates,
      topK: 2,
      perSource: false,
      config: config({ enabled: false, maxPerSource: 1 }),
    });

    expect(items.map((item) => item.passage.chunkId)).toEqual(['a-1', 'a-2']);
    expect(droppedOverlap).toEqual([]);
    expect(droppedDiversity.map((p) => p.chunkId)).toEqual(['a-3']);
  });
});

describe('chunkBody', () => {
  it('removes only the source-title header', () => {
    expect(chunkBody('Source: "Notes"\nBody text.')).toBe('Body text.');
    expect(chunkBody('Body text.')).toBe('Body text.');
  });
});

describe('loadRetrievalEvidenceConfig', () => {
  it('falls back to the documented defaults', () => {
    expect(loadRetrievalEvidenceConfig({})).toEqual(DEFAULT_EVIDENCE_CONFIG);
    expect(DEFAULT_EVIDENCE_CONFIG).toMatchObject({
      enabled: true,
      overlapThreshold: DEFAULT_OVERLAP_THRESHOLD,
      maxPerSource: DEFAULT_MAX_PER_SOURCE,
      tokenBudget: DEFAULT_EVIDENCE_TOKEN_BUDGET,
      sectionExpansion: true,
    });
  });

  it('reads the assembly configuration from the environment', () => {
    expect(
      loadRetrievalEvidenceConfig({
        RETRIEVAL_EVIDENCE_ENABLED: 'false',
        RETRIEVAL_OVERLAP_THRESHOLD: '0.6',
        RETRIEVAL_MAX_PER_SOURCE: '2',
        RETRIEVAL_EVIDENCE_TOKEN_BUDGET: '4000',
        RETRIEVAL_SECTION_EXPANSION: 'off',
      }),
    ).toEqual({
      enabled: false,
      overlapThreshold: 0.6,
      maxPerSource: 2,
      tokenBudget: 4000,
      sectionExpansion: false,
    });
  });

  it('clamps the budget and the overlap threshold and accepts an unlimited cap', () => {
    expect(
      loadRetrievalEvidenceConfig({
        RETRIEVAL_OVERLAP_THRESHOLD: '5',
        RETRIEVAL_EVIDENCE_TOKEN_BUDGET: '10',
        RETRIEVAL_MAX_PER_SOURCE: '0',
      }),
    ).toMatchObject({
      overlapThreshold: 1,
      tokenBudget: 1000,
      maxPerSource: 0,
    });
    expect(
      loadRetrievalEvidenceConfig({
        RETRIEVAL_OVERLAP_THRESHOLD: '-3',
        RETRIEVAL_MAX_PER_SOURCE: 'many',
        RETRIEVAL_EVIDENCE_ENABLED: 'maybe',
        RETRIEVAL_SECTION_EXPANSION: 'maybe',
      }),
    ).toEqual(DEFAULT_EVIDENCE_CONFIG);
  });
});
