import { describe, expect, it } from 'vitest';
import { ChunkingService } from '../src/modules/ai/chunking.service';

describe('ChunkingService', () => {
  it('preserves source version provenance and segment locators', () => {
    const chunks = new ChunkingService().chunkSource({
      id: 'source-1',
      notebookId: 'notebook-1',
      title: 'Lecture notes',
      rawText: 'legacy fallback',
      sourceVersionId: 'version-1',
      segments: [
        {
          id: 'segment-1',
          content: 'The derivative measures instantaneous change.',
          locator: { pageNumber: 4 },
        },
      ],
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      sourceVersionId: 'version-1',
      segmentIds: ['segment-1'],
      locator: { pageNumber: 4 },
      chunkingVersion: 1,
    });
    expect(chunks[0].contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('falls back to raw text for legacy sources without segments', () => {
    const chunks = new ChunkingService().chunkSource({
      id: 'source-1',
      notebookId: 'notebook-1',
      title: 'Legacy',
      rawText: 'Existing source text.',
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain('Existing source text.');
    expect(chunks[0].segmentIds).toEqual([]);
    expect(chunks[0].locator).toEqual({});
  });
});
