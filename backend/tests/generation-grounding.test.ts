import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FUSION_K,
  RetrievalService,
} from '../src/modules/ai/retrieval.service';
import type { RetrievedChunk } from '../src/modules/ai/retrieval.service';
import {
  GENERATION_EVIDENCE_CHUNKS_PER_SOURCE,
  GENERATION_MAX_PROMPT_SOURCE_CHARS,
  GENERATION_MAX_RETRIEVAL_PASSES,
  GENERATION_MAX_SECTION_PASSES_PER_SOURCE,
  GenerationGroundingService,
  formatGroundedSourceText,
  type GenerationGrounding,
  type GroundedSource,
} from '../src/modules/study-materials/generation-grounding';
import { DeterministicEmbedder } from './eval/deterministic-embedder';
import { DeterministicReranker } from './eval/deterministic-reranker';
import { contextualText, seedGoldenCorpus } from './eval/seed-corpus';
import { db } from './db';
import type { GoldenChunk, GoldenSource } from './eval/golden-set';

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

function buildGroundingService(sources: GoldenSource[]) {
  const corpus = sources.flatMap((source) =>
    source.chunks.map((chunk) => contextualText(source, chunk)),
  );
  const embedder = new DeterministicEmbedder(corpus);
  const retrieval = new RetrievalService(
    db as never,
    {
      embedQuery: async (text: string) => embedder.embed(text),
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
    new DeterministicReranker(corpus) as never,
    {
      enabled: true,
      fusionK: DEFAULT_FUSION_K,
      denseWeight: 1,
      lexicalWeight: 1,
      denseCandidateDepth: 8,
      lexicalCandidateDepth: 8,
    },
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
      kind: 'study_guide',
      // The brief names only the head topic; section passes still reach the
      // tail, which is the behavior under test.
      brief: 'Explain the first section of the mushroom guide',
      sourceIds: [seeded.sourceIdByGoldenId.get('long')!],
    });

    expect(grounding.sources).toHaveLength(1);
    const source = grounding.sources[0];
    expect(source.chunks.length).toBeLessThanOrEqual(
      GENERATION_EVIDENCE_CHUNKS_PER_SOURCE,
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
    // The shared pass budget is split across the selected sources.
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
      brief: 'Review everything',
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
      kind: 'study_guide',
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
      kind: 'study_guide',
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
