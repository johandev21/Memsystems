import { describe, expect, it, vi } from 'vitest';
import {
  BadRequestError,
  RateLimitedError,
  ServiceUnavailableError,
  UnauthorizedError,
} from '../src/common/errors/domain-error';
import {
  VOYAGE_EMBEDDINGS_URL,
  VOYAGE_RERANK_URL,
  voyageEmbed,
  voyageRerank,
} from '../src/modules/ai/providers/voyage.client';

type FetchMock = ReturnType<typeof vi.fn>;

/** JSON response with `data` entries in a controllable order. */
function embeddingResponse(
  entries: { index: number; embedding: number[] }[],
  status = 200,
): Response {
  return new Response(
    JSON.stringify({
      object: 'list',
      model: 'voyage-4',
      usage: { total_tokens: 1 },
      data: entries.map((entry) => ({
        object: 'embedding',
        index: entry.index,
        embedding: entry.embedding,
      })),
    }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
}

/** Default ok-fetch: echoes one vector per requested input, in order. */
function okFetch(): FetchMock {
  return vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { input: string[] };
    return embeddingResponse(
      body.input.map((_text, index) => ({ index, embedding: [index] })),
    );
  });
}

async function embed(
  input: string[],
  inputType: 'query' | 'document',
  fetchImpl: FetchMock,
  apiKey = 'voy_test_key',
): Promise<number[][]> {
  return voyageEmbed({
    apiKey,
    model: 'voyage-4',
    input,
    inputType,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
}

describe('voyageEmbed', () => {
  it('returns an empty array without calling the API for empty input', async () => {
    const fetchImpl = vi.fn();
    await expect(
      embed([], 'document', fetchImpl),
    ).resolves.toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('posts to the Voyage embeddings endpoint with bearer auth and the query input type', async () => {
    const fetchImpl = vi.fn(async () =>
      embeddingResponse([{ index: 0, embedding: [0.5, 0.25] }]),
    );
    await expect(
      embed(['hello world'], 'query', fetchImpl, 'voy_live_key'),
    ).resolves.toEqual([[0.5, 0.25]]);

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(VOYAGE_EMBEDDINGS_URL);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer voy_live_key',
    );
    expect(JSON.parse(String(init.body))).toEqual({
      model: 'voyage-4',
      input: ['hello world'],
      input_type: 'query',
      truncation: true,
    });
  });

  it('orders results by the response index, not array order', async () => {
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { input: string[] };
      const entries = body.input.map((_text, index) => ({
        index,
        embedding: [index * 10],
      }));
      return embeddingResponse([...entries].reverse());
    });
    await expect(
      embed(['a', 'b', 'c'], 'document', fetchImpl),
    ).resolves.toEqual([[0], [10], [20]]);
  });

  it('splits inputs larger than the per-request text limit into ordered batches', async () => {
    // Echo the number embedded in each text so batch results carry their
    // global position and concatenation order is observable.
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { input: string[] };
      return embeddingResponse(
        body.input.map((text, index) => ({
          index,
          embedding: [Number(text.replace('chunk-', ''))],
        })),
      );
    });
    const input = Array.from({ length: 257 }, (_v, i) => `chunk-${i}`);
    const result = await embed(input, 'document', fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const sizes = fetchImpl.mock.calls.map(
      (call) => (JSON.parse(String(call[1]?.body)) as { input: string[] }).input.length,
    );
    expect(sizes).toEqual([256, 1]);
    expect(result).toHaveLength(257);
    expect(result[0]).toEqual([0]);
    expect(result[255]).toEqual([255]);
    // The second batch's only result lands after all of the first batch's.
    expect(result[256]).toEqual([256]);
  });

  it('splits inputs whose estimated token count exceeds the per-request cap', async () => {
    const fetchImpl = okFetch();
    // ~4 chars/token: 960_001 chars ≈ 240_001 estimated tokens, above the
    // 240K batch budget, so each oversized text goes in its own request.
    const huge = 'x'.repeat(960_001);
    await embed([huge, huge], 'document', fetchImpl);

    const sizes = fetchImpl.mock.calls.map(
      (call) => (JSON.parse(String(call[1]?.body)) as { input: string[] }).input.length,
    );
    expect(sizes).toEqual([1, 1]);
  });

  it('maps a 401 onto an auth error', async () => {
    const fetchImpl = vi.fn(async () => new Response('unauthorized', { status: 401 }));
    await expect(
      embed(['q'], 'query', fetchImpl),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(
      embed(['q'], 'query', fetchImpl),
    ).rejects.toMatchObject({ messageKey: 'errors.ai.voyage.keyRejected' });
  });

  it('maps a 429 onto a rate-limit error', async () => {
    const fetchImpl = vi.fn(async () => new Response('slow down', { status: 429 }));
    await expect(
      embed(['q'], 'query', fetchImpl),
    ).rejects.toBeInstanceOf(RateLimitedError);
  });

  it('maps a 5xx onto a service-unavailable error', async () => {
    const fetchImpl = vi.fn(async () => new Response('boom', { status: 503 }));
    await expect(
      embed(['q'], 'query', fetchImpl),
    ).rejects.toBeInstanceOf(ServiceUnavailableError);
  });

  it('maps other 4xx onto a bad-request error', async () => {
    const fetchImpl = vi.fn(async () => new Response('bad input', { status: 400 }));
    await expect(
      embed(['q'], 'query', fetchImpl),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('maps network failures onto an unreachable error', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(
      embed(['q'], 'query', fetchImpl),
    ).rejects.toMatchObject({ messageKey: 'errors.ai.voyage.unreachable' });
  });

  it('rejects a malformed response body', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ object: 'list' }), { status: 200 }),
    );
    await expect(
      embed(['q'], 'query', fetchImpl),
    ).rejects.toMatchObject({
      messageKey: 'errors.ai.voyage.invalidResponse',
    });
  });
});

/** JSON rerank response with controllable entries and usage. */
function rerankResponse(
  entries: { index: number; relevance_score: number }[],
  status = 200,
  totalTokens = 128,
): Response {
  return new Response(
    JSON.stringify({
      object: 'list',
      model: 'rerank-2.5',
      usage: { total_tokens: totalTokens },
      data: entries,
    }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
}

async function rerank(
  documents: string[],
  fetchImpl: FetchMock,
  apiKey = 'voy_test_key',
): Promise<Awaited<ReturnType<typeof voyageRerank>>> {
  return voyageRerank({
    apiKey,
    model: 'rerank-2.5',
    query: 'how do mitochondria make atp',
    documents,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
}

describe('voyageRerank', () => {
  it('returns no candidates without calling the API for empty documents', async () => {
    const fetchImpl = vi.fn();
    await expect(rerank([], fetchImpl)).resolves.toEqual({
      candidates: [],
      totalTokens: 0,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('posts to the Voyage rerank endpoint with bearer auth and the documents', async () => {
    const fetchImpl = vi.fn(async () =>
      rerankResponse([
        { index: 1, relevance_score: 0.9 },
        { index: 0, relevance_score: 0.2 },
      ]),
    );

    await expect(
      rerank(['first document', 'second document'], fetchImpl, 'voy_live_key'),
    ).resolves.toEqual({
      candidates: [
        { index: 1, relevanceScore: 0.9 },
        { index: 0, relevanceScore: 0.2 },
      ],
      totalTokens: 128,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(VOYAGE_RERANK_URL);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer voy_live_key',
    );
    expect(JSON.parse(String(init.body))).toEqual({
      model: 'rerank-2.5',
      query: 'how do mitochondria make atp',
      documents: ['first document', 'second document'],
      truncation: true,
    });
  });

  it('reports zero tokens when the response omits usage', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            object: 'list',
            data: [{ index: 0, relevance_score: 0.5 }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    );
    await expect(rerank(['doc'], fetchImpl)).resolves.toEqual({
      candidates: [{ index: 0, relevanceScore: 0.5 }],
      totalTokens: 0,
    });
  });

  it('maps a 401 onto an auth error', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('unauthorized', { status: 401 }),
    );
    await expect(rerank(['doc'], fetchImpl)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('maps a 429 onto a rate-limit error', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('slow down', { status: 429 }),
    );
    await expect(rerank(['doc'], fetchImpl)).rejects.toBeInstanceOf(
      RateLimitedError,
    );
  });

  it('maps a 5xx onto a service-unavailable error', async () => {
    const fetchImpl = vi.fn(async () => new Response('boom', { status: 503 }));
    await expect(rerank(['doc'], fetchImpl)).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
  });

  it('maps other 4xx onto a bad-request error', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('bad input', { status: 400 }),
    );
    await expect(rerank(['doc'], fetchImpl)).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });

  it('maps network failures onto an unreachable error', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(rerank(['doc'], fetchImpl)).rejects.toMatchObject({
      messageKey: 'errors.ai.voyage.unreachable',
    });
  });

  it('rejects a malformed response body', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ object: 'list' }), { status: 200 }),
    );
    await expect(rerank(['doc'], fetchImpl)).rejects.toMatchObject({
      messageKey: 'errors.ai.voyage.invalidResponse',
    });
  });

  it('rejects a response entry without a numeric score', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            object: 'list',
            data: [{ index: 0 }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    );
    await expect(rerank(['doc'], fetchImpl)).rejects.toMatchObject({
      messageKey: 'errors.ai.voyage.invalidResponse',
    });
  });
});
