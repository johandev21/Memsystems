import { describe, expect, it, vi } from 'vitest';
import {
  VOYAGE_CONTEXTUAL_EMBEDDINGS_URL,
  voyageContextualEmbed,
} from '../src/modules/ai/providers/voyage.client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** A response that echoes one embedding per chunk in group order. */
function echoResponse(groups: string[][]) {
  return jsonResponse({
    data: groups.map((group, groupIndex) => ({
      index: groupIndex,
      data: group.map((_, chunkIndex) => ({
        index: chunkIndex,
        embedding: [groupIndex + 0.1, chunkIndex + 0.1],
      })),
    })),
    usage: { total_tokens: groups.flat().length * 4 },
  });
}

describe('voyageContextualEmbed', () => {
  it('posts grouped inputs to the contextualized endpoint and flattens the result', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string) as { inputs: string[][] };
      return echoResponse(body.inputs);
    });

    const result = await voyageContextualEmbed({
      apiKey: 'voy_key',
      model: 'voyage-context-4',
      groups: [
        ['doc one chunk one', 'doc one chunk two'],
        ['doc two chunk one'],
      ],
      inputType: 'document',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(VOYAGE_CONTEXTUAL_EMBEDDINGS_URL);
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer voy_key',
    });
    expect(JSON.parse(init?.body as string)).toEqual({
      model: 'voyage-context-4',
      inputs: [
        ['doc one chunk one', 'doc one chunk two'],
        ['doc two chunk one'],
      ],
      input_type: 'document',
    });
    // Group order, then chunk order, with both orders taken from `index`.
    expect(result.embeddings).toEqual([
      [0.1, 0.1],
      [0.1, 1.1],
      [1.1, 0.1],
    ]);
    expect(result.totalTokens).toBe(12);
  });

  it('honors out-of-order group and chunk indices', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        data: [
          {
            index: 1,
            data: [{ index: 0, embedding: [2] }],
          },
          {
            index: 0,
            data: [
              { index: 1, embedding: [1, 2] },
              { index: 0, embedding: [1, 1] },
            ],
          },
        ],
        usage: { total_tokens: 7 },
      }),
    );

    const result = await voyageContextualEmbed({
      apiKey: 'voy_key',
      model: 'voyage-context-4',
      groups: [['a', 'b'], ['c']],
      inputType: 'query',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.embeddings).toEqual([[1, 1], [1, 2], [2]]);
    expect(result.totalTokens).toBe(7);
  });

  it('splits documents into multiple requests when the token budget would be exceeded', async () => {
    let requestIndex = 0;
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string) as { inputs: string[][] };
      const index = requestIndex++;
      return jsonResponse({
        data: body.inputs.map((group, groupIndex) => ({
          index: groupIndex,
          data: group.map((_, chunkIndex) => ({
            index: chunkIndex,
            embedding: [index, groupIndex, chunkIndex],
          })),
        })),
        usage: { total_tokens: 4 },
      });
    });
    // ~100,000 estimated tokens each: one per request.
    const huge = 'x'.repeat(400_000);

    const result = await voyageContextualEmbed({
      apiKey: 'voy_key',
      model: 'voyage-context-4',
      groups: [[huge], [huge]],
      inputType: 'document',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.embeddings).toEqual([
      [0, 0, 0],
      [1, 0, 0],
    ]);
    expect(result.totalTokens).toBe(8);
  });

  it('short-circuits empty input and rejects a malformed response', async () => {
    const fetchImpl = vi.fn();
    await expect(
      voyageContextualEmbed({
        apiKey: 'voy_key',
        model: 'voyage-context-4',
        groups: [],
        inputType: 'document',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toEqual({ embeddings: [], totalTokens: 0 });
    expect(fetchImpl).not.toHaveBeenCalled();

    const malformed = vi.fn(async () => jsonResponse({ nope: true }));
    await expect(
      voyageContextualEmbed({
        apiKey: 'voy_key',
        model: 'voyage-context-4',
        groups: [['a']],
        inputType: 'document',
        fetchImpl: malformed as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({
      messageKey: 'errors.ai.voyage.invalidResponse',
    });
  });

  it('maps HTTP failures onto domain errors', async () => {
    const unauthorized = vi.fn(async () =>
      jsonResponse({ detail: 'invalid key' }, 401),
    );
    await expect(
      voyageContextualEmbed({
        apiKey: 'voy_key',
        model: 'voyage-context-4',
        groups: [['a']],
        inputType: 'document',
        fetchImpl: unauthorized as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({
      status: 401,
      messageKey: 'errors.ai.voyage.keyRejected',
    });
  });
});
