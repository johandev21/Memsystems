import { describe, expect, it, vi } from 'vitest';
import {
  RetrievalService,
  type CitationLocator,
} from '../src/modules/ai/retrieval.service';

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
      { generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2]) } as never,
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
      { generateEmbedding: vi.fn().mockResolvedValue([0.1]) } as never,
    );

    const [chunk] = await service.retrieveRelevantChunks(
      'notebook-1',
      'legacy',
    );
    expect(chunk.sourceVersionId).toBeNull();
    expect(chunk.locator).toBeNull();
  });
});
