import { describe, expect, it } from 'vitest';
import { sourceChunks } from '../src/database/schema';
import { chunkContextHeader } from '../src/modules/ai/chunking.service';
import {
  DEFAULT_FUSION_K,
  RetrievalService,
} from '../src/modules/ai/retrieval.service';
import {
  GENERATION_EVIDENCE_CHUNKS_PER_SOURCE,
  GENERATION_MAX_RETRIEVAL_PASSES,
  GENERATION_MAX_SECTION_PASSES_PER_SOURCE,
  GenerationGroundingService,
  formatGroundedSourceText,
  type GroundedSource,
} from '../src/modules/study-materials/generation-grounding';
import { DeterministicEmbedder } from './eval/deterministic-embedder';
import { DeterministicReranker } from './eval/deterministic-reranker';
import { db } from './db';
import { seedNotebook, seedSource } from './fixtures';

interface SeedChunk {
  id: string;
  headingPath: string[];
  text: string;
}

interface SeedSource {
  id: string;
  title: string;
  kind: 'text' | 'file' | 'url';
  processingStatus?: 'ready' | 'degraded';
  chunks: SeedChunk[];
}

function contextualText(source: SeedSource, chunk: SeedChunk): string {
  return `${chunkContextHeader({
    title: source.title,
    kind: source.kind,
    headingPath: chunk.headingPath,
  })}${chunk.text}`;
}

/**
 * Seeds sources and chunks the way the indexing pipeline would, with the
 * contextual representation the retrieval legs index. Returns the ids the
 * grounding request uses.
 */
async function seedCorpus(sources: SeedSource[]) {
  const notebook = await seedNotebook({ title: 'Grounding test' });
  const sourceIdByGoldenId = new Map<string, string>();
  const embedder = new DeterministicEmbedder(
    sources.flatMap((source) =>
      source.chunks.map((chunk) => contextualText(source, chunk)),
    ),
  );

  for (const source of sources) {
    const seeded = await seedSource(notebook.id, {
      id: `seeded-${source.id}`,
      kind: source.kind,
      title: source.title,
      rawText: source.chunks.map((chunk) => chunk.text).join('\n\n'),
      processingStatus: source.processingStatus ?? 'ready',
    });
    sourceIdByGoldenId.set(source.id, seeded.id);

    await db.insert(sourceChunks).values(
      source.chunks.map((chunk, index) => {
        const contextHeader = chunkContextHeader({
          title: source.title,
          kind: source.kind,
          headingPath: chunk.headingPath,
        });
        const searchableText = `${contextHeader}${chunk.text}`;
        return {
          id: `chunk-${source.id}-${chunk.id}`,
          sourceId: seeded.id,
          notebookId: notebook.id,
          chunkIndex: index,
          content: chunk.text,
          searchableText,
          contextHeader,
          headingPath: chunk.headingPath,
          sourceKind: source.kind,
          embedding: embedder.embed(searchableText),
        };
      }),
    );
  }

  return { notebookId: notebook.id, sourceIdByGoldenId };
}

function buildGroundingService(sources: SeedSource[]) {
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

const LONG_SOURCE: SeedSource = {
  id: 'long',
  title: 'Mushroom Field Guide',
  kind: 'file',
  chunks: LONG_SECTION_WORDS.flatMap((word, section) =>
    Array.from({ length: 3 }, (_, part) => ({
      id: `long-s${section}-${part}`,
      headingPath: [`Part ${section + 1}`, `${word} notes`],
      text:
        part === 0
          ? `${word} notes for part ${section + 1}: this ${word} passage carries the ${word} vocabulary of the section and repeats ${word} so the section's own retrieval pass ranks it first. Detail ${section}${part}.`
          : `Supplementary note ${section}${part} for the same part of the guide, with filler words about procedures, measurements, and observations that never name the section's subject directly.`,
    })),
  ).flat(),
};

const SECOND_SECTION_WORDS = [
  'glassware',
  'reagent',
  'titration',
  'filtration',
  'notebook',
];

const SECOND_SOURCE: SeedSource = {
  id: 'second',
  title: 'Laboratory Manual',
  kind: 'file',
  chunks: SECOND_SECTION_WORDS.flatMap((word, section) =>
    Array.from({ length: 3 }, (_, part) => ({
      id: `second-s${section}-${part}`,
      headingPath: [`Experiment ${section + 1}`, `${word} procedure`],
      text:
        part === 0
          ? `${word} procedure for experiment ${section + 1}: this ${word} passage carries the ${word} vocabulary of the section and repeats ${word} so the section's own retrieval pass ranks it first. Detail ${section}${part}.`
          : `Supplementary note ${section}${part} for the same experiment, with filler words about bench work, timings, and observations that never name the section's subject directly.`,
    })),
  ).flat(),
};

describe('GenerationGroundingService long-source coverage', () => {
  it('represents every section of a long source instead of one bounded set', async () => {
    const seeded = await seedCorpus([LONG_SOURCE]);
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
    const chunks = grounding.sources[0].chunks;
    expect(chunks.length).toBeLessThanOrEqual(
      GENERATION_EVIDENCE_CHUNKS_PER_SOURCE,
    );
    // Every one of the eight sections contributes evidence.
    const sections = new Set(
      chunks.map((chunk) => chunk.chunkId.match(/-s(\d+)-\d+$/)?.[1]),
    );
    expect([...sections].sort()).toEqual([
      '0',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
    ]);
    // Chunks are ordered by position for the prompt.
    expect(chunks.map((chunk) => chunk.chunkIndex)).toEqual(
      [...chunks.map((chunk) => chunk.chunkIndex)].sort((a, b) => a - b),
    );
    // One trace per retrieval pass, capped per source.
    expect(grounding.traces.length).toBe(
      Math.min(8, GENERATION_MAX_SECTION_PASSES_PER_SOURCE),
    );
    expect(grounding.evidence.map((item) => item.chunkId)).toEqual(
      chunks.map((chunk) => chunk.chunkId),
    );
    expect(
      new Set(grounding.evidence.map((item) => item.citationKey)).size,
    ).toBe(grounding.evidence.length);
  });
});

describe('GenerationGroundingService multi-source coverage', () => {
  it('keeps every selected source, including the tail of the selection order', async () => {
    const seeded = await seedCorpus([LONG_SOURCE, SECOND_SOURCE]);
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

    const longChunks = grounding.sources[1].chunks;
    const longSections = new Set(
      longChunks.map((chunk) => chunk.chunkId.match(/-s(\d+)-\d+$/)?.[1]),
    );
    expect(longSections.has('7')).toBe(true);
    const secondChunks = grounding.sources[0].chunks;
    const secondSections = new Set(
      secondChunks.map((chunk) => chunk.chunkId.match(/-s(\d+)-\d+$/)?.[1]),
    );
    expect(secondSections.has('4')).toBe(true);
    // The shared pass budget is split across the selected sources.
    expect(grounding.traces.length).toBeLessThanOrEqual(
      GENERATION_MAX_RETRIEVAL_PASSES,
    );
  });
});

describe('GenerationGroundingService reporting', () => {
  it('reports a degraded selected source as unavailable', async () => {
    const degraded: SeedSource = {
      ...SECOND_SOURCE,
      processingStatus: 'degraded',
    };
    const seeded = await seedCorpus([LONG_SOURCE, degraded]);
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
    const seeded = await seedCorpus([LONG_SOURCE]);
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
    const seeded = await seedCorpus([LONG_SOURCE]);
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
  function groundedSource(
    id: string,
    title: string,
    bodies: string[],
  ): GroundedSource {
    return {
      id,
      title,
      kind: 'text',
      url: null,
      chunks: bodies.map((body, index) => ({
        chunkId: `${id}-chunk-${index}`,
        chunkIndex: index,
        sourceId: id,
        title,
        content: body,
        score: 1,
        url: null,
        kind: 'text',
        sourceVersionId: null,
        locator: null,
      })),
    };
  }

  it('labels every passage with its evidence key and source id', () => {
    const source = groundedSource('source-1', 'Lecture Notes', ['First body']);
    const evidence = [
      {
        ...source.chunks[0],
        citationKey: 'R1',
        rank: 1,
      },
    ];

    const text = formatGroundedSourceText({ sources: [source], evidence });

    expect(text).toContain('Source: "Lecture Notes" (Source ID: source-1)');
    expect(text).toContain('[Evidence R1]');
    expect(text).toContain('First body');
  });

  it('keeps every source when the prompt budget is tight', () => {
    const sources = [1, 2, 3].map((index) =>
      groundedSource(`source-${index}`, `Source ${index}`, [
        `Source ${index} body `.repeat(200),
      ]),
    );
    const evidence = sources.flatMap((source, index) => [
      {
        ...source.chunks[0],
        citationKey: `R${index + 1}`,
        rank: index + 1,
      },
    ]);

    const text = formatGroundedSourceText({ sources, evidence }, 2_500);

    for (const index of [1, 2, 3]) {
      expect(text).toContain(`Source ID: source-${index}`);
    }
  });
});
