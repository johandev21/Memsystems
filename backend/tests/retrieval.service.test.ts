import { describe, expect, it, vi } from 'vitest';
import { sourceChunks } from '../src/database/schema';
import {
  RetrievalService,
  type CitationLocator,
} from '../src/modules/ai/retrieval.service';
import { db } from './db';
import { seedNotebook, seedSource } from './fixtures';

describe('RetrievalService citation locations', () => {
  it('returns source version and locator metadata with each retrieved chunk', async () => {
    const execute = vi.fn().mockResolvedValue({
      rows: [
        {
          chunk_id: 'chunk-1',
          chunk_index: 2,
          source_id: 'source-1',
          title: 'Lecture notes',
          url: null,
          kind: 'file',
          source_version_id: 'version-4',
          locator: { pageNumber: 7 } satisfies CitationLocator,
          content: 'The derivative measures instantaneous change.',
          score: '0.93',
        },
      ],
    });
    const service = new RetrievalService(
      { execute } as never,
      { embedQuery: vi.fn().mockResolvedValue([0.1, 0.2]) } as never,
    );

    await expect(
      service.retrieveRelevantChunks('notebook-1', 'derivative'),
    ).resolves.toEqual([
      {
        chunkId: 'chunk-1',
        chunkIndex: 2,
        sourceId: 'source-1',
        title: 'Lecture notes',
        content: 'The derivative measures instantaneous change.',
        score: 0.93,
        url: null,
        kind: 'file',
        sourceVersionId: 'version-4',
        locator: { pageNumber: 7 },
      },
    ]);
    expect(execute).toHaveBeenCalledOnce();
  });

  it('maps legacy chunks with missing location metadata to nulls', async () => {
    const service = new RetrievalService(
      {
        execute: vi.fn().mockResolvedValue({
          rows: [
            {
              chunk_id: 'chunk-legacy',
              chunk_index: 0,
              source_id: 'source-legacy',
              title: 'Legacy source',
              url: null,
              kind: 'text',
              content: 'Legacy content',
              score: 0.4,
            },
          ],
        }),
      } as never,
      { embedQuery: vi.fn().mockResolvedValue([0.1]) } as never,
    );

    const [chunk] = await service.retrieveRelevantChunks(
      'notebook-1',
      'legacy',
    );
    expect(chunk.sourceVersionId).toBeNull();
    expect(chunk.locator).toBeNull();
  });

  it('never returns chunks from a degraded source as Evidence', async () => {
    const notebook = await seedNotebook();
    const ready = await seedSource(notebook.id, {
      kind: 'text',
      title: 'Ready source',
      rawText: 'Substantive ready content',
      processingStatus: 'ready',
    });
    const degraded = await seedSource(notebook.id, {
      kind: 'url',
      title: 'Navigation-only source',
      rawText: 'Chapter 1 Chapter 2 Chapter 3',
      processingStatus: 'degraded',
    });

    const embedding = Array.from({ length: 1024 }, () => 0.01);
    await db.insert(sourceChunks).values([
      {
        id: 'chunk-ready-1',
        sourceId: ready.id,
        notebookId: notebook.id,
        chunkIndex: 0,
        content: 'Substantive ready content',
        embedding,
      },
      {
        id: 'chunk-degraded-1',
        sourceId: degraded.id,
        notebookId: notebook.id,
        chunkIndex: 0,
        content: 'Chapter 1 Chapter 2 Chapter 3',
        embedding,
      },
    ]);

    const service = new RetrievalService(
      db as never,
      { embedQuery: vi.fn().mockResolvedValue(embedding) } as never,
    );

    const chunks = await service.retrieveRelevantChunks(notebook.id, 'content');

    expect(chunks.map((chunk) => chunk.chunkId)).toEqual(['chunk-ready-1']);
  });
});
