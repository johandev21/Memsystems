import { describe, expect, it, vi } from 'vitest';
import { RerankerService } from '../src/modules/ai/reranker.service';

const { voyageRerankMock } = vi.hoisted(() => ({
  voyageRerankMock: vi.fn(),
}));

vi.mock('../src/modules/ai/providers/voyage.client', () => ({
  voyageRerank: voyageRerankMock,
}));

function service(voyageApiKey: string | null = null) {
  return new RerankerService({
    getVoyageApiKey: vi.fn().mockResolvedValue(voyageApiKey),
  } as never);
}

describe('RerankerService', () => {
  it('returns null without calling the provider when no key is configured', async () => {
    await expect(
      service().rerank({
        query: 'osmosis',
        documents: ['a', 'b'],
        model: 'rerank-2.5',
      }),
    ).resolves.toBeNull();
    expect(voyageRerankMock).not.toHaveBeenCalled();
  });

  it('reranks with the stored key and maps the provider response', async () => {
    voyageRerankMock.mockResolvedValue({
      candidates: [
        { index: 1, relevanceScore: 0.9 },
        { index: 0, relevanceScore: 0.1 },
      ],
      totalTokens: 64,
    });

    await expect(
      service('voy_stored_key').rerank({
        query: 'osmosis',
        documents: ['a', 'b'],
        model: 'rerank-2.5-lite',
      }),
    ).resolves.toEqual({
      candidates: [
        { index: 1, relevanceScore: 0.9 },
        { index: 0, relevanceScore: 0.1 },
      ],
      inputTokens: 64,
    });
    expect(voyageRerankMock).toHaveBeenCalledWith({
      apiKey: 'voy_stored_key',
      model: 'rerank-2.5-lite',
      query: 'osmosis',
      documents: ['a', 'b'],
    });
  });
});
