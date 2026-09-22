/**
 * Seeds the golden corpus into the test database for the retrieval and
 * Generation evaluation harnesses. Both gates use the same representation the
 * indexing pipeline writes, so the runs differ only in what they measure.
 */

import { createId } from '@paralleldrive/cuid2';
import { sourceChunks } from '../../src/database/schema';
import { chunkContextHeader } from '../../src/modules/ai/chunking.service';
import { db } from '../db';
import { seedNotebook, seedSource } from '../fixtures';
import type { EvalEmbedder } from './deterministic-embedder';
import {
  GOLDEN_SOURCES,
  type GoldenChunk,
  type GoldenSource,
} from './golden-set';

export interface SeededGoldenCorpus {
  notebookId: string;
  sourceIdByGoldenId: Map<string, string>;
  chunkIdByGoldenId: Map<string, string>;
  chunkByGoldenId: Map<string, GoldenChunk>;
  sourceByGoldenId: Map<string, GoldenSource>;
}

export interface SeedGoldenCorpusOptions {
  /** Sources to seed; defaults to the Chat golden set. */
  sources?: GoldenSource[];
  /** Defaults to the contextual representation the pipeline indexes. */
  contextualize?: boolean;
  /** Notebook title, so a failure names the gate that seeded it. */
  title?: string;
}

/** The document plus section context a golden chunk is represented with. */
export function contextualText(
  source: GoldenSource,
  chunk: GoldenChunk,
): string {
  return `${chunkContextHeader({
    title: source.title,
    kind: source.kind,
    headingPath: chunk.headingPath ?? [],
  })}${chunk.text}`;
}

/**
 * Persists the golden corpus and returns the golden-id to seeded-id maps. With
 * `contextualize` false the chunks are seeded with the pre-contextual
 * representation: the searchable text and the embedding are the bare body,
 * with no document or section header.
 */
export async function seedGoldenCorpus(
  embedder: EvalEmbedder,
  options: SeedGoldenCorpusOptions = {},
): Promise<SeededGoldenCorpus> {
  const sources = options.sources ?? GOLDEN_SOURCES;
  const contextualize = options.contextualize ?? true;
  const notebook = await seedNotebook({
    title: options.title ?? 'Retrieval Evaluation Corpus',
  });
  // Unique per run: a harness may seed the corpus more than once in a test.
  const runId = createId();
  const sourceIdByGoldenId = new Map<string, string>();
  const chunkIdByGoldenId = new Map<string, string>();
  const chunkByGoldenId = new Map<string, GoldenChunk>();
  const sourceByGoldenId = new Map<string, GoldenSource>();

  for (const source of sources) {
    const seeded = await seedSource(notebook.id, {
      id: `eval-${runId}-source-${source.id}`,
      kind: source.kind,
      title: source.title,
      rawText: source.chunks.map((chunk) => chunk.text).join('\n\n'),
      processingStatus: source.processingStatus,
      url: source.kind === 'url' ? `https://example.test/${source.id}` : null,
    });
    sourceIdByGoldenId.set(source.id, seeded.id);
    sourceByGoldenId.set(source.id, source);

    await db.insert(sourceChunks).values(
      source.chunks.map((chunk, index) => {
        const id = `eval-${runId}-chunk-${chunk.id}`;
        chunkIdByGoldenId.set(chunk.id, id);
        chunkByGoldenId.set(chunk.id, chunk);
        const contextHeader = contextualize
          ? chunkContextHeader({
              title: source.title,
              kind: source.kind,
              headingPath: chunk.headingPath ?? [],
            })
          : '';
        const searchableText = `${contextHeader}${chunk.text}`;
        return {
          id,
          sourceId: seeded.id,
          notebookId: notebook.id,
          chunkIndex: index,
          content: chunk.text,
          searchableText,
          contextHeader,
          headingPath: chunk.headingPath ?? [],
          sourceKind: source.kind,
          embedding: embedder.embed(searchableText),
        };
      }),
    );
  }

  return {
    notebookId: notebook.id,
    sourceIdByGoldenId,
    chunkIdByGoldenId,
    chunkByGoldenId,
    sourceByGoldenId,
  };
}
