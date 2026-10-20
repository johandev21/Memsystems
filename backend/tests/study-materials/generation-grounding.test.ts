import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_FUSION_K,
  RetrievalService,
} from '../../src/modules/ai/retrieval/retrieval.service';
import type { RetrievedChunk } from '../../src/modules/ai/retrieval/retrieval.service';
import {
  GENERATION_EVIDENCE_CHUNKS_PER_SOURCE,
  GENERATION_KIND_BUDGETS,
  GENERATION_MAX_PROMPT_SOURCE_CHARS,
  GENERATION_MAX_RETRIEVAL_PASSES,
  GENERATION_MAX_SECTION_PASSES_PER_SOURCE,
  GenerationGroundingService,
  formatGroundedSourceText,
  type GenerationGrounding,
  type GroundedSource,
} from '../../src/modules/study-materials/generation/generation-grounding';
import {
  attachGenerationCitations,
  extractGenerationCitations,
} from '../../src/modules/study-materials/generation/generation-citations';
import { DeterministicEmbedder } from '../eval/deterministic-embedder';
import { DeterministicReranker } from '../eval/deterministic-reranker';
import { contextualText, seedGoldenCorpus } from '../eval/seed-corpus';
import { db } from '../db';
import type { GoldenSource } from '../eval/golden-set';

/**
 * Eight sections of three chunks each, ordered by chunk position. The first
 * chunk of each section repeats the section's distinctive word, so its own
 * section pass ranks it first; the other chunks are generic filler.
 */
const LONG_SECTION_WORDS = [
  'lamella',
  'spore',
  'mycelium',
  'habitat',
  'edibility',
  'toxin',
  'drying',
  'substrate',
];

function longSource(id: string, title: string, words: string[]): GoldenSource {
  return {
    id,
    title,
    kind: 'file',
    processingStatus: 'ready',
    chunks: words.flatMap((word, section) =>
      Array.from({ length: 3 }, (_, part) => ({
        id: `${id}-s${section}-${part}`,
        headingPath: [`Part ${section + 1}`, `${word} notes`],
        text:
          part === 0
            ? `${word} notes for part ${section + 1}: this ${word} passage carries the ${word} vocabulary of the section and repeats ${word} so the section's own retrieval pass ranks it first. Detail ${section}${part}. The remainder of this note records observations, measurements, and procedures in enough detail to make the passage a realistic chunk rather than a stub.`
            : `Supplementary note ${section}${part} for the same part of the guide, with filler words about procedures, measurements, and observations that never name the section's subject directly. The remainder of this note records observations, measurements, and procedures in enough detail to make the passage a realistic chunk rather than a stub.`,
      })),
    ),
  };
}

const LONG_SOURCE = longSource(
  'long',
  'Mushroom Field Guide',
  LONG_SECTION_WORDS,
);
const SECOND_SOURCE = longSource('second', 'Laboratory Manual', [
  'glassware',
  'reagent',
  'titration',
  'filtration',
  'notebook',
]);

function buildGroundingService(
  sources: GoldenSource[],
  hooks?: {
    onEmbed?: (text: string) => void;
    onRerank?: () => void;
    onUnderstand?: () => void;
  },
) {
  const corpus = sources.flatMap((source) =>
    source.chunks.map((chunk) => contextualText(source, chunk)),
  );
  const embedder = new DeterministicEmbedder(corpus);
  const reranker = new DeterministicReranker(corpus);
  const retrieval = new RetrievalService(
    db as never,
    {
      embedQuery: async (text: string) => {
        hooks?.onEmbed?.(text);
        return embedder.embed(text);
      },
      queryEmbeddingModel: () => 'eval-deterministic-embedder',
    } as never,
    { relevanceFloor: 0 },
    {
      enabled: true,
      model: 'eval-coverage-reranker',
      candidateDepth: 8,
      threshold: 0,
      topK: GENERATION_EVIDENCE_CHUNKS_PER_SOURCE,
    },
    {
      rerank: async (input: Parameters<typeof reranker.rerank>[0]) => {
        hooks?.onRerank?.();
        return reranker.rerank(input);
      },
    } as never,
    {
      enabled: true,
      fusionK: DEFAULT_FUSION_K,
      denseWeight: 1,
      lexicalWeight: 1,
      denseCandidateDepth: 8,
      lexicalCandidateDepth: 8,
    },
    hooks?.onUnderstand
      ? ({
          understand: async (input: { message: string }) => {
            hooks.onUnderstand?.();
            return {
              queries: [input.message],
              hypotheticalAnswer: null,
              applied: false,
              inputTokens: 0,
              outputTokens: 0,
            };
          },
        } as never)
      : undefined,
  );
  return new GenerationGroundingService(db as never, retrieval);
}

async function seed(sources: GoldenSource[]) {
  const corpus = sources.flatMap((source) =>
    source.chunks.map((chunk) => contextualText(source, chunk)),
  );
  return seedGoldenCorpus(new DeterministicEmbedder(corpus), { sources });
}

function sectionsOf(chunks: { chunkId: string }[]): Set<string | undefined> {
  return new Set(
    chunks.map((chunk) => chunk.chunkId.match(/-s(\d+)-\d+$/)?.[1]),
  );
}

describe('GenerationGroundingService long-source coverage', () => {
  it('represents every section of a long source instead of one bounded set', async () => {
    const seeded = await seed([LONG_SOURCE]);
    const service = buildGroundingService([LONG_SOURCE]);

    const grounding = await service.ground({
      notebookId: seeded.notebookId,
      kind: 'quiz',
      // The brief names only the head topic; section passes still reach the
      // tail, which is the behavior under test.
      brief: 'Explain the first section of the mushroom guide',
      sourceIds: [seeded.sourceIdByGoldenId.get('long')!],
    });

    expect(grounding.sources).toHaveLength(1);
    const source = grounding.sources[0];
    expect(source.chunks.length).toBeLessThanOrEqual(
      GENERATION_KIND_BUDGETS.quiz.maxTotalChunksSingleSource,
    );
    // Every one of the eight sections contributes evidence.
    expect([...sectionsOf(source.chunks)].sort()).toEqual([
      '0',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
    ]);
    // Evidence is reported in chunk order...
    expect(source.chunks.map((chunk) => chunk.chunkIndex)).toEqual(
      [...source.chunks.map((chunk) => chunk.chunkIndex)].sort((a, b) => a - b),
    );
    // ...while the prompt order is round robin across passes, so the first
    // blocks already span every section.
    expect([...sectionsOf(source.promptChunks)].sort()).toEqual([
      '0',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
    ]);
    expect(sectionsOf(source.promptChunks.slice(0, 8)).size).toBe(8);
    // One trace per retrieval pass, capped per source.
    expect(grounding.traces.length).toBe(
      Math.min(8, GENERATION_MAX_SECTION_PASSES_PER_SOURCE),
    );
    expect(grounding.evidence.map((item) => item.chunkId)).toEqual(
      source.chunks.map((chunk) => chunk.chunkId),
    );
    expect(
      new Set(grounding.evidence.map((item) => item.citationKey)).size,
    ).toBe(grounding.evidence.length);
  });
});

describe('GenerationGroundingService multi-source coverage', () => {
  it('keeps every selected source, including the tail of the selection order', async () => {
    const seeded = await seed([LONG_SOURCE, SECOND_SOURCE]);
    const service = buildGroundingService([LONG_SOURCE, SECOND_SOURCE]);

    const grounding = await service.ground({
      notebookId: seeded.notebookId,
      kind: 'simple_flashcard',
      brief: 'Review the material',
      // The long source is selected last: its tail must not be the thing that
      // gets dropped.
      sourceIds: [
        seeded.sourceIdByGoldenId.get('second')!,
        seeded.sourceIdByGoldenId.get('long')!,
      ],
    });

    expect(grounding.sources.map((source) => source.id)).toEqual([
      seeded.sourceIdByGoldenId.get('second'),
      seeded.sourceIdByGoldenId.get('long'),
    ]);
    expect(grounding.unavailableSources).toEqual([]);
    expect(grounding.sources.every((source) => source.chunks.length > 0)).toBe(
      true,
    );

    const longSections = sectionsOf(grounding.sources[1].chunks);
    expect(longSections.has('7')).toBe(true);
    const secondSections = sectionsOf(grounding.sources[0].chunks);
    expect(secondSections.has('4')).toBe(true);
    expect(grounding.traces.length).toBeLessThanOrEqual(
      GENERATION_MAX_RETRIEVAL_PASSES,
    );
  });

  it('keeps the soft pass cap above sixteen sources without dropping any', async () => {
    const sources = Array.from({ length: 20 }, (_, index) =>
      longSource(`soft-${index}`, `Source ${index}`, [`topic${index}`]),
    );
    const seeded = await seed(sources);
    const service = buildGroundingService(sources);

    const grounding = await service.ground({
      notebookId: seeded.notebookId,
      kind: 'quiz',
      brief: 'Focus on molecular synthesis mechanisms',
      sourceIds: sources.map((source) =>
        seeded.sourceIdByGoldenId.get(source.id)!,
      ),
    });

    // The cap is soft: every selected source keeps one pass, so the total
    // exceeds it rather than dropping a source.
    expect(grounding.traces.length).toBe(20);
    expect(grounding.traces.length).toBeGreaterThan(
      GENERATION_MAX_RETRIEVAL_PASSES,
    );
    expect(grounding.sources).toHaveLength(20);
    expect(grounding.unavailableSources).toEqual([]);
  });
});

describe('GenerationGroundingService reporting', () => {
  it('reports a degraded selected source as unavailable', async () => {
    const degraded: GoldenSource = {
      ...SECOND_SOURCE,
      processingStatus: 'degraded',
    };
    const seeded = await seed([LONG_SOURCE, degraded]);
    const service = buildGroundingService([LONG_SOURCE, degraded]);

    const grounding = await service.ground({
      notebookId: seeded.notebookId,
      kind: 'quiz',
      brief: 'Quiz me',
      sourceIds: [
        seeded.sourceIdByGoldenId.get('long')!,
        seeded.sourceIdByGoldenId.get('second')!,
      ],
    });

    expect(grounding.sources.map((source) => source.id)).toEqual([
      seeded.sourceIdByGoldenId.get('long'),
    ]);
    expect(grounding.unavailableSources.map((source) => source.id)).toEqual([
      seeded.sourceIdByGoldenId.get('second'),
    ]);
    expect(grounding.degradedSources.map((source) => source.id)).toEqual([
      seeded.sourceIdByGoldenId.get('second'),
    ]);
  });

  it('reports a selected id that has no indexed chunks as unavailable', async () => {
    const seeded = await seed([LONG_SOURCE]);
    const service = buildGroundingService([LONG_SOURCE]);

    const grounding = await service.ground({
      notebookId: seeded.notebookId,
      kind: 'quiz',
      brief: 'Quiz me',
      sourceIds: [seeded.sourceIdByGoldenId.get('long')!, 'missing-source'],
    });

    expect(grounding.sources).toHaveLength(1);
    expect(grounding.unavailableSources.map((source) => source.id)).toEqual([
      'missing-source',
    ]);
  });

  it('does not retrieve when no sources are selected', async () => {
    const seeded = await seed([LONG_SOURCE]);
    const service = buildGroundingService([]);

    const grounding = await service.ground({
      notebookId: seeded.notebookId,
      kind: 'quiz',
      brief: 'From the brief alone',
      sourceIds: [],
    });

    expect(grounding).toEqual({
      sources: [],
      evidence: [],
      unavailableSources: [],
      degradedSources: [],
      traces: [],
    });
  });
});

describe('Ticket 01: Adaptive Evidence budget & boilerplate filtering', () => {
  const BOILERPLATE_BOOK: GoldenSource = {
    id: 'bp-book',
    title: 'Systems Architecture Textbook',
    kind: 'file',
    processingStatus: 'ready',
    chunks: [
      {
        id: 'bp-toc',
        headingPath: ['Table of Contents'],
        text: 'Table of Contents: Chapter 1 Pipeline Hazards ........................ 1. Chapter 2 Cache Coherence ........................ 45. References ........................ 190. Index ........................ 205.',
      },
      {
        id: 'bp-preface',
        headingPath: ['Preface'],
        text: 'Preface: This textbook was written for third-year computer engineering students studying processor microarchitecture and memory hierarchies.',
      },
      {
        id: 'bp-ack',
        headingPath: ['Acknowledgments'],
        text: 'Acknowledgments: We thank all the faculty members and graduate teaching assistants who reviewed the problem sets and laboratory assignments.',
      },
      {
        id: 'bp-copyright',
        headingPath: ['Copyright'],
        text: 'Copyright 2026 University Press. All rights reserved. No part of this publication may be reproduced without prior written permission.',
      },
      {
        id: 'bp-ch1-stub',
        headingPath: ['Chapter 1', 'Pipeline Hazards'],
        text: 'Short stub.',
      },
      {
        id: 'bp-ch1-main',
        headingPath: ['Chapter 1', 'Pipeline Hazards'],
        text: 'Pipeline hazards occur when an instruction cannot execute in the designated clock cycle. Data hazards arise from read-after-write dependencies, while control hazards stem from conditional branches that alter the program counter before target resolution.',
      },
      {
        id: 'bp-ch2-main',
        headingPath: ['Chapter 2', 'Cache Coherence'],
        text: 'Cache coherence protocols such as MESI maintain a consistent view of shared memory across multicore processors by tracking Modified, Exclusive, Shared, and Invalid cache line states over the interconnect bus.',
      },
      {
        id: 'bp-refs',
        headingPath: ['References'],
        text: 'References: Hennessy and Patterson, Computer Architecture: A Quantitative Approach, 6th Edition. Sorin et al., A Primer on Memory Consistency and Cache Coherence.',
      },
      {
        id: 'bp-bib',
        headingPath: ['Bibliography'],
        text: 'Bibliography: Paterson, D. and Hennessy, J., Computer Organization and Design: The Hardware/Software Interface, Morgan Kaufmann.',
      },
      {
        id: 'bp-index',
        headingPath: ['Index'],
        text: 'Index: branch prediction 18, cache line 52, forwarding path 24, invalidation broadcast 61, pipeline stall 14, snooping bus 58.',
      },
    ],
  };

  it('excludes boilerplate sections and short stub chunks when the Brief does not mention them', async () => {
    const seeded = await seed([BOILERPLATE_BOOK]);
    const service = buildGroundingService([BOILERPLATE_BOOK]);

    const grounding = await service.ground({
      notebookId: seeded.notebookId,
      kind: 'quiz',
      brief: '',
      sourceIds: [seeded.sourceIdByGoldenId.get('bp-book')!],
    });

    const returnedIds = grounding.evidence.map((item) => item.chunkId);
    expect(returnedIds).toEqual([
      seeded.chunkIdByGoldenId.get('bp-ch1-main'),
      seeded.chunkIdByGoldenId.get('bp-ch2-main'),
    ]);
  });

  it('includes boilerplate sections when the Brief explicitly asks for them', async () => {
    const seeded = await seed([BOILERPLATE_BOOK]);
    const service = buildGroundingService([BOILERPLATE_BOOK]);

    const grounding = await service.ground({
      notebookId: seeded.notebookId,
      kind: 'quiz',
      brief: 'Quiz me on the Preface and Bibliography',
      sourceIds: [seeded.sourceIdByGoldenId.get('bp-book')!],
    });

    const returnedIds = new Set(grounding.evidence.map((item) => item.chunkId));
    expect(returnedIds.has(seeded.chunkIdByGoldenId.get('bp-preface')!)).toBe(
      true,
    );
    expect(returnedIds.has(seeded.chunkIdByGoldenId.get('bp-bib')!)).toBe(true);
    expect(returnedIds.has(seeded.chunkIdByGoldenId.get('bp-index')!)).toBe(
      false,
    );
  });

  it('falls back to available chunks on a tiny Source whose only chunk is short or under a boilerplate heading', async () => {
    const tinyBoilerplateSource: GoldenSource = {
      id: 'tiny-preface',
      title: 'Quick Note',
      kind: 'text',
      processingStatus: 'ready',
      chunks: [
        {
          id: 'tiny-chunk-1',
          headingPath: ['Preface'],
          text: 'Short preface note only.',
        },
      ],
    };
    const seeded = await seed([tinyBoilerplateSource]);
    const service = buildGroundingService([tinyBoilerplateSource]);

    const grounding = await service.ground({
      notebookId: seeded.notebookId,
      kind: 'simple_flashcard',
      brief: '',
      sourceIds: [seeded.sourceIdByGoldenId.get('tiny-preface')!],
    });

    expect(grounding.unavailableSources).toEqual([]);
    expect(grounding.sources).toHaveLength(1);
    expect(grounding.evidence).toHaveLength(1);
    expect(grounding.evidence[0].chunkId).toBe(
      seeded.chunkIdByGoldenId.get('tiny-chunk-1'),
    );
  });

  it('enforces Kind-specific Evidence chunk ceilings and prompt character budgets', async () => {
    const seeded = await seed([LONG_SOURCE]);
    const service = buildGroundingService([LONG_SOURCE]);
    const sourceId = seeded.sourceIdByGoldenId.get('long')!;

    for (const kind of [
      'mind_map',
      'roadmap',
      'simple_flashcard',
      'slides',
      'quiz',
    ] as const) {
      const grounding = await service.ground({
        notebookId: seeded.notebookId,
        kind,
        brief: '',
        sourceIds: [sourceId],
      });
      const expectedBudget = GENERATION_KIND_BUDGETS[kind];
      expect(grounding.evidence.length).toBe(
        expectedBudget.maxTotalChunksSingleSource,
      );

      // Verify prompt character ceiling is enforced for the Kind
      const bloatedGrounding: GenerationGrounding = {
        ...grounding,
        sources: grounding.sources.map((src) => ({
          ...src,
          promptChunks: src.promptChunks.map((ch) => ({
            ...ch,
            content: `${ch.content} ${'extra padding words '.repeat(200)}`,
          })),
        })),
      };
      const formatted = formatGroundedSourceText(bloatedGrounding, { kind });
      expect(formatted.text.length).toBeLessThanOrEqual(
        expectedBudget.maxPromptChars,
      );
    }
  });

  it('allocates chunks proportionally across a large book and a single-chunk note while guaranteeing >= 1 chunk per source', async () => {
    const singleNote: GoldenSource = {
      id: 'tiny-note',
      title: 'Exam Formula Sheet',
      kind: 'text',
      processingStatus: 'ready',
      chunks: [
        {
          id: 'tiny-note-c0',
          headingPath: ['Formulas'],
          text: 'Key formula sheet: Snell law relates angles of incidence and refraction across optical media boundaries with differing refractive indices.',
        },
      ],
    };
    const seeded = await seed([LONG_SOURCE, singleNote]);
    const service = buildGroundingService([LONG_SOURCE, singleNote]);

    const grounding = await service.ground({
      notebookId: seeded.notebookId,
      kind: 'simple_flashcard',
      brief: '',
      sourceIds: [
        seeded.sourceIdByGoldenId.get('long')!,
        seeded.sourceIdByGoldenId.get('tiny-note')!,
      ],
    });

    expect(grounding.sources).toHaveLength(2);
    const bookChunks = grounding.sources[0].chunks;
    const noteChunks = grounding.sources[1].chunks;
    expect(noteChunks).toHaveLength(1);
    expect(bookChunks.length).toBe(
      GENERATION_KIND_BUDGETS.simple_flashcard.maxTotalChunksMultiSource - 1,
    );
  });
});

describe('Ticket 02: Zero-Brief and broad-survey stratified SQL sampling', () => {
  it('samples a 45-chapter book evenly from first chapter to last chapter with zero embedding or reranker calls', async () => {
    const fortyFiveChapterBook: GoldenSource = {
      id: 'book-45',
      title: 'Comprehensive Physiology Textbook',
      kind: 'file',
      processingStatus: 'ready',
      chunks: Array.from({ length: 45 }, (_, chapterIdx) => ({
        id: `book-45-ch-${chapterIdx + 1}`,
        headingPath: [
          `Chapter ${chapterIdx + 1}`,
          `Physiology Topic ${chapterIdx + 1} with Extended Descriptive Heading Title`,
        ],
        text: `Chapter ${chapterIdx + 1} instructional content: homeostatic regulation mechanism number ${chapterIdx + 1} coordinates cellular signaling pathways, membrane transport proteins, and feedback loops across organ systems in quantitative detail.`,
      })),
    };

    const onEmbed = vi.fn();
    const onRerank = vi.fn();
    const onUnderstand = vi.fn();
    const seeded = await seed([fortyFiveChapterBook]);
    const service = buildGroundingService([fortyFiveChapterBook], {
      onEmbed,
      onRerank,
      onUnderstand,
    });

    const grounding = await service.ground({
      notebookId: seeded.notebookId,
      kind: 'quiz',
      brief: '',
      sourceIds: [seeded.sourceIdByGoldenId.get('book-45')!],
    });

    expect(grounding.traces).toEqual([]);
    expect(onEmbed).not.toHaveBeenCalled();
    expect(onRerank).not.toHaveBeenCalled();
    expect(onUnderstand).not.toHaveBeenCalled();

    const chunks = grounding.sources[0].chunks;
    expect(chunks).toHaveLength(
      GENERATION_KIND_BUDGETS.quiz.maxTotalChunksSingleSource,
    );
    // First chapter (index 0) and final chapter (index 44) are both represented,
    // along with middle chapters past the 300-character heading cutoff.
    const indices = chunks.map((c) => c.chunkIndex);
    expect(indices[0]).toBe(0);
    expect(indices[indices.length - 1]).toBe(44);
    expect(indices.some((idx) => idx >= 15 && idx <= 30)).toBe(true);
  });

  it('partitions a headingless long Source (headingPath = []) by chunkIndex ranges across beginning, middle, and end', async () => {
    const flatBook: GoldenSource = {
      id: 'flat-book',
      title: 'Unstructured Scanned Lecture',
      kind: 'file',
      processingStatus: 'ready',
      chunks: Array.from({ length: 30 }, (_, index) => ({
        id: `flat-c-${index}`,
        headingPath: [],
        text: `Transcript paragraph ${index + 1}: thermodynamics lecture discussion covering entropy production, reversible Carnot engines, and Boltzmann statistical mechanics at step ${index + 1} of the derivation.`,
      })),
    };

    const onEmbed = vi.fn();
    const seeded = await seed([flatBook]);
    const service = buildGroundingService([flatBook], { onEmbed });

    const grounding = await service.ground({
      notebookId: seeded.notebookId,
      kind: 'roadmap',
      brief: 'Summarize the lecture',
      sourceIds: [seeded.sourceIdByGoldenId.get('flat-book')!],
    });

    expect(grounding.traces).toEqual([]);
    expect(onEmbed).not.toHaveBeenCalled();

    const chunks = grounding.sources[0].chunks;
    expect(chunks).toHaveLength(
      GENERATION_KIND_BUDGETS.roadmap.maxTotalChunksSingleSource,
    );
    const indices = chunks.map((c) => c.chunkIndex);
    // Beginning, middle, and end of the 30-chunk flat source are all sampled
    expect(indices.some((i) => i < 5)).toBe(true);
    expect(indices.some((i) => i >= 12 && i <= 18)).toBe(true);
    expect(indices.some((i) => i >= 25)).toBe(true);
  });
});

describe('Ticket 03: Brief-driven section targeting and heading-scoped retrieval', () => {
  it('scopes retrieval strictly to matching sections when the Brief names a specific part or chapter', async () => {
    const seeded = await seed([LONG_SOURCE]);
    const service = buildGroundingService([LONG_SOURCE]);

    const grounding = await service.ground({
      notebookId: seeded.notebookId,
      kind: 'quiz',
      brief: 'Focus on Part 6 toxin notes',
      sourceIds: [seeded.sourceIdByGoldenId.get('long')!],
    });

    expect(grounding.traces).toHaveLength(1);
    const chunks = grounding.sources[0].chunks;
    expect(chunks.length).toBeGreaterThan(0);
    expect(
      chunks.every(
        (chunk) => chunk.sectionPath.join(' > ') === 'Part 6 > toxin notes',
      ),
    ).toBe(true);
  });

  it('runs a single focused retrieval pass per Source and skips Query Understanding on a specific concept Brief', async () => {
    const onUnderstand = vi.fn();
    const seeded = await seed([LONG_SOURCE, SECOND_SOURCE]);
    const service = buildGroundingService([LONG_SOURCE, SECOND_SOURCE], {
      onUnderstand,
    });

    const grounding = await service.ground({
      notebookId: seeded.notebookId,
      kind: 'quiz',
      brief: 'Explain mycelium colonization and acid titration endpoints',
      sourceIds: [
        seeded.sourceIdByGoldenId.get('long')!,
        seeded.sourceIdByGoldenId.get('second')!,
      ],
    });

    // 1 pass per source = 2 traces total (instead of 16 passes), and 0 Query Understanding calls
    expect(grounding.traces).toHaveLength(2);
    expect(onUnderstand).not.toHaveBeenCalled();
    expect(grounding.sources).toHaveLength(2);
  });
});

describe('Ticket 04: Evidence deduplication, overlap stripping & compact prompt formatting', () => {
  it('strips overlapping boundary sentences when adjacent chunks from the same Source Version are selected', () => {
    const overlapSentence =
      'Oxidative phosphorylation establishes a proton motive force across the inner mitochondrial membrane.';
    const first: RetrievedChunk = {
      chunkId: 'c-0',
      chunkIndex: 0,
      sourceId: 'src-1',
      title: 'Cell Bio',
      content: `Source: "Cell Bio"\nGlycolysis oxidizes glucose to pyruvate in the cytosol. ${overlapSentence}`,
      score: 1,
      url: null,
      kind: 'text',
      sourceVersionId: 'ver-1',
      locator: null,
      sectionPath: ['Chapter 1', 'Bioenergetics'],
    };
    const second: RetrievedChunk = {
      chunkId: 'c-1',
      chunkIndex: 1,
      sourceId: 'src-1',
      title: 'Cell Bio',
      content: `Source: "Cell Bio"\n${overlapSentence}\n\nATP synthase then uses this proton gradient to phosphorylate ADP into ATP.`,
      score: 1,
      url: null,
      kind: 'text',
      sourceVersionId: 'ver-1',
      locator: null,
      sectionPath: ['Chapter 1', 'Bioenergetics'],
    };

    const grounding: GenerationGrounding = {
      sources: [
        {
          id: 'src-1',
          title: 'Cell Bio',
          kind: 'text',
          url: null,
          chunks: [first, second],
          promptChunks: [first, second],
        },
      ],
      evidence: [
        { ...first, citationKey: 'R1', rank: 1 },
        { ...second, citationKey: 'R2', rank: 2 },
      ],
      unavailableSources: [],
      degradedSources: [],
      traces: [],
    };

    const formatted = formatGroundedSourceText(grounding);
    const occurrences = formatted.text.split(overlapSentence).length - 1;
    expect(occurrences).toBe(1);
    expect(formatted.text).toContain(
      'ATP synthase then uses this proton gradient to phosphorylate ADP into ATP.',
    );

    // Consecutive blocks in the same section share a single Section header
    const sectionHeaderCount =
      formatted.text.split('Section: Chapter 1 > Bioenergetics').length - 1;
    expect(sectionHeaderCount).toBe(1);
    expect(formatted.text).toContain('[Evidence R1]');
    expect(formatted.text).toContain('[Evidence R2]');
    expect(formatted.renderedChunkIds).toEqual(['c-0', 'c-1']);

    // Citations still resolve accurately for both chunks
    const citations = attachGenerationCitations(
      { title: 'Bio Quiz' },
      extractGenerationCitations(
        'Proton gradient [ref:R1] drives ATP synthase [ref:R2].',
        grounding.evidence,
      ),
    ).citations;
    expect(citations.map((c) => c.citationKey)).toEqual(['R1', 'R2']);
  });

  it('collapses near-duplicate chunks (Jaccard >= 0.85) so every Evidence slot contributes distinct facts', async () => {
    const duplicateHeavySource: GoldenSource = {
      id: 'dup-src',
      title: 'Duplicate Lecture Notes',
      kind: 'text',
      processingStatus: 'ready',
      chunks: [
        {
          id: 'dup-1',
          headingPath: ['Section 1'],
          text: 'The sodium potassium pump actively transports three sodium ions out of the cell and two potassium ions into the cell per molecule of ATP hydrolyzed against their electrochemical gradients.',
        },
        {
          id: 'dup-2',
          headingPath: ['Section 1'],
          text: 'The sodium potassium pump actively transports three sodium ions out of the cell and two potassium ions into the cell per molecule of ATP hydrolyzed against their gradients.',
        },
        {
          id: 'dup-3',
          headingPath: ['Section 1'],
          text: 'Action potentials propagate along myelinated axons via saltatory conduction, jumping between Nodes of Ranvier where voltage-gated sodium channels are densely clustered.',
        },
      ],
    };

    const seeded = await seed([duplicateHeavySource]);
    const service = buildGroundingService([duplicateHeavySource]);

    const grounding = await service.ground({
      notebookId: seeded.notebookId,
      kind: 'quiz',
      brief: '',
      sourceIds: [seeded.sourceIdByGoldenId.get('dup-src')!],
    });

    const returnedIds = grounding.evidence.map((item) => item.chunkId);
    // dup-2 is a near-duplicate of dup-1 (Jaccard > 0.85) and is collapsed
    expect(returnedIds).toContain(seeded.chunkIdByGoldenId.get('dup-1'));
    expect(returnedIds).toContain(seeded.chunkIdByGoldenId.get('dup-3'));
    expect(returnedIds).not.toContain(seeded.chunkIdByGoldenId.get('dup-2'));
  });
});

describe('formatGroundedSourceText', () => {
  function chunkOf(id: string, body: string, chunkIndex = 0): RetrievedChunk {
    return {
      chunkId: id,
      chunkIndex,
      sourceId: 'source-1',
      title: 'Lecture Notes',
      content: body,
      score: 1,
      url: null,
      kind: 'text',
      sourceVersionId: null,
      locator: null,
      sectionPath: [],
    };
  }

  function sourceOf(
    id: string,
    title: string,
    chunks: RetrievedChunk[],
  ): GroundedSource {
    return {
      id,
      title,
      kind: 'text',
      url: null,
      chunks,
      promptChunks: chunks,
    };
  }

  function groundingOf(sources: GroundedSource[]): GenerationGrounding {
    return {
      sources,
      evidence: sources.flatMap((source, sourceIndex) =>
        source.chunks.map((chunk, index) => ({
          ...chunk,
          citationKey: `R${sourceIndex * 10 + index + 1}`,
          rank: sourceIndex * 10 + index + 1,
        })),
      ),
      unavailableSources: [],
      degradedSources: [],
      traces: [],
    };
  }

  it('labels every passage with its evidence key and only prints source ids when asked', () => {
    const source = sourceOf('source-1', 'Lecture Notes', [
      chunkOf('chunk-1', 'First body'),
    ]);
    const grounding = groundingOf([source]);

    const withoutIds = formatGroundedSourceText(grounding);
    expect(withoutIds.text).toContain('Source: "Lecture Notes"');
    expect(withoutIds.text).not.toContain('Source ID:');
    expect(withoutIds.text).toContain('[Evidence R1]');
    expect(withoutIds.text).toContain('First body');
    expect(withoutIds.renderedChunkIds).toEqual(['chunk-1']);

    const withIds = formatGroundedSourceText(grounding, {
      includeSourceId: true,
    });
    expect(withIds.text).toContain(
      'Source: "Lecture Notes" (Source ID: source-1)',
    );
  });

  it('never exceeds the cap, however many sources are selected', () => {
    const sources = Array.from({ length: 60 }, (_, sourceIndex) =>
      sourceOf(
        `source-${sourceIndex}`,
        `Source ${sourceIndex}`,
        Array.from({ length: 2 }, (_, chunkIndex) =>
          chunkOf(
            `source-${sourceIndex}-chunk-${chunkIndex}`,
            `Source ${sourceIndex} body ${chunkIndex} `.repeat(120),
            chunkIndex,
          ),
        ),
      ),
    );

    const formatted = formatGroundedSourceText(groundingOf(sources));

    expect(formatted.text.length).toBeLessThanOrEqual(
      GENERATION_MAX_PROMPT_SOURCE_CHARS,
    );
    expect(formatted.droppedBlocks).toBeGreaterThan(0);
    expect(formatted.truncatedSourceIds.length).toBeGreaterThan(0);
  });

  it('keeps a tail section when the budget cuts a source short', async () => {
    const seeded = await seed([LONG_SOURCE]);
    const service = buildGroundingService([LONG_SOURCE]);
    const grounding = await service.ground({
      notebookId: seeded.notebookId,
      kind: 'quiz',
      brief: 'Review the mushroom guide',
      sourceIds: [seeded.sourceIdByGoldenId.get('long')!],
    });

    // A budget that fits roughly one round of blocks: every section keeps its
    // first block, and the rest is dropped and reported.
    const formatted = formatGroundedSourceText(grounding, { maxChars: 4_000 });

    expect(formatted.text.length).toBeLessThanOrEqual(4_000);
    expect(formatted.droppedBlocks).toBeGreaterThan(0);
    for (const word of LONG_SECTION_WORDS) {
      expect(formatted.text).toContain(`${word} notes for part`);
    }
  });
});
