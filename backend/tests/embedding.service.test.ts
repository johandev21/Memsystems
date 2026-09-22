import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ServiceUnavailableError,
} from '../src/common/errors/domain-error';
import {
  CONTEXTUAL_EMBEDDING_MODEL,
  DEFAULT_EMBEDDING_CONFIG,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EmbeddingService,
  loadEmbeddingConfig,
  voyageApiKeyFromEnv,
  type EmbeddingConfig,
} from '../src/modules/ai/embedding.service';

const { voyageEmbedMock, voyageContextualEmbedMock } = vi.hoisted(() => ({
  voyageEmbedMock: vi.fn(),
  voyageContextualEmbedMock: vi.fn(),
}));

vi.mock('../src/modules/ai/providers/voyage.client', () => ({
  voyageEmbed: voyageEmbedMock,
  voyageContextualEmbed: voyageContextualEmbedMock,
}));

function service(voyageApiKey: string | null = null, config?: EmbeddingConfig) {
  return new EmbeddingService(
    {
      getVoyageApiKey: vi.fn().mockResolvedValue(voyageApiKey),
    } as never,
    config,
  );
}

const VOYAGE_ENV_KEY = 'VOYAGE_API_KEY';

describe('EmbeddingService', () => {
  afterEach(() => {
    delete process.env[VOYAGE_ENV_KEY];
    voyageEmbedMock.mockReset();
    voyageContextualEmbedMock.mockReset();
  });

  it('configures the contextual model as primary and voyage-4 as fallback at 1024 dimensions', () => {
    expect(EMBEDDING_MODEL).toBe('voyage-4');
    expect(CONTEXTUAL_EMBEDDING_MODEL).toBe('voyage-context-4');
    expect(EMBEDDING_DIMENSIONS).toBe(1024);
    expect(DEFAULT_EMBEDDING_CONFIG).toEqual({
      contextualEnabled: true,
      contextualModel: 'voyage-context-4',
      fallbackModel: 'voyage-4',
    });
  });

  it('reads the embedding path from the environment', () => {
    expect(loadEmbeddingConfig({})).toEqual(DEFAULT_EMBEDDING_CONFIG);
    expect(
      loadEmbeddingConfig({
        EMBEDDING_CONTEXTUAL_ENABLED: 'false',
        EMBEDDING_CONTEXTUAL_MODEL: 'voyage-context-3',
      }),
    ).toEqual({
      contextualEnabled: false,
      contextualModel: 'voyage-context-3',
      fallbackModel: 'voyage-4',
    });
  });

  it('reads the fallback key from the environment', () => {
    process.env[VOYAGE_ENV_KEY] = 'voy_env_key';
    expect(voyageApiKeyFromEnv()).toBe('voy_env_key');
    delete process.env[VOYAGE_ENV_KEY];
    expect(voyageApiKeyFromEnv()).toBeNull();
  });

  it('throws the notConfigured error when no key is stored or set in the environment', async () => {
    await expect(service().embedQuery('q')).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
    await expect(service().embedQuery('q')).rejects.toMatchObject({
      messageKey: 'errors.ai.embedding.notConfigured',
    });
    expect(voyageContextualEmbedMock).not.toHaveBeenCalled();
    expect(voyageEmbedMock).not.toHaveBeenCalled();
  });

  it('falls back to the environment key when nothing is stored', async () => {
    process.env[VOYAGE_ENV_KEY] = 'voy_env_key';
    voyageContextualEmbedMock.mockResolvedValue({
      embeddings: [[0.1, 0.2]],
      totalTokens: 3,
    });
    await expect(service().embedQuery('q')).resolves.toEqual([0.1, 0.2]);
    expect(voyageContextualEmbedMock).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'voy_env_key' }),
    );
  });

  it('prefers the stored settings key over the environment fallback', async () => {
    process.env[VOYAGE_ENV_KEY] = 'voy_env_key';
    voyageContextualEmbedMock.mockResolvedValue({
      embeddings: [[0.1]],
      totalTokens: 1,
    });
    await service('voy_stored_key').embedQuery('q');
    expect(voyageContextualEmbedMock).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'voy_stored_key' }),
    );
  });

  it('embeds a query through the contextualized endpoint as a one-chunk group', async () => {
    voyageContextualEmbedMock.mockResolvedValue({
      embeddings: [[0.3, 0.4]],
      totalTokens: 4,
    });
    await expect(
      service('voy_stored_key').embedQuery('search this'),
    ).resolves.toEqual([0.3, 0.4]);
    expect(voyageContextualEmbedMock).toHaveBeenCalledWith({
      apiKey: 'voy_stored_key',
      model: CONTEXTUAL_EMBEDDING_MODEL,
      groups: [['search this']],
      inputType: 'query',
    });
  });

  it('embeds a source’s ordered chunks as one contextual group', async () => {
    voyageContextualEmbedMock.mockResolvedValue({
      embeddings: [[0.1], [0.2], [0.3]],
      totalTokens: 9,
    });
    const result = await service('voy_stored_key').embedDocumentGroups([
      ['chunk one', 'chunk two'],
      ['chunk three'],
    ]);

    expect(result).toEqual({
      model: CONTEXTUAL_EMBEDDING_MODEL,
      embeddings: [[0.1], [0.2], [0.3]],
    });
    expect(voyageContextualEmbedMock).toHaveBeenCalledWith({
      apiKey: 'voy_stored_key',
      model: CONTEXTUAL_EMBEDDING_MODEL,
      groups: [
        ['chunk one', 'chunk two'],
        ['chunk three'],
      ],
      inputType: 'document',
    });
  });

  it('falls back to per-chunk voyage-4 embeddings when contextualization is disabled', async () => {
    const fallback = {
      contextualEnabled: false,
      contextualModel: CONTEXTUAL_EMBEDDING_MODEL,
      fallbackModel: EMBEDDING_MODEL,
    };
    voyageEmbedMock.mockResolvedValue([
      [0.1],
      [0.2],
      [0.3],
    ]);
    const result = await service('voy_stored_key', fallback).embedDocumentGroups(
      [['chunk one', 'chunk two'], ['chunk three']],
    );

    expect(result).toEqual({
      model: EMBEDDING_MODEL,
      embeddings: [[0.1], [0.2], [0.3]],
    });
    expect(voyageEmbedMock).toHaveBeenCalledWith({
      apiKey: 'voy_stored_key',
      model: EMBEDDING_MODEL,
      input: ['chunk one', 'chunk two', 'chunk three'],
      inputType: 'document',
    });
    expect(voyageContextualEmbedMock).not.toHaveBeenCalled();

    voyageEmbedMock.mockResolvedValue([[0.5, 0.6]]);
    await expect(
      service('voy_stored_key', fallback).embedQuery('search this'),
    ).resolves.toEqual([0.5, 0.6]);
    expect(voyageEmbedMock).toHaveBeenCalledWith({
      apiKey: 'voy_stored_key',
      model: EMBEDDING_MODEL,
      input: ['search this'],
      inputType: 'query',
    });
  });

  it('reports the model the vectors were produced with', () => {
    expect(service().documentEmbeddingModel()).toBe(
      CONTEXTUAL_EMBEDDING_MODEL,
    );
    expect(service().queryEmbeddingModel()).toBe(CONTEXTUAL_EMBEDDING_MODEL);
    expect(
      service(null, {
        contextualEnabled: false,
        contextualModel: CONTEXTUAL_EMBEDDING_MODEL,
        fallbackModel: EMBEDDING_MODEL,
      }).documentEmbeddingModel(),
    ).toBe(EMBEDDING_MODEL);
  });

  it('short-circuits empty document groups', async () => {
    await expect(service('voy_stored_key').embedDocumentGroups([])).resolves.toEqual(
      { model: CONTEXTUAL_EMBEDDING_MODEL, embeddings: [] },
    );
    await expect(
      service('voy_stored_key').embedDocumentGroups([[]]),
    ).resolves.toEqual({ model: CONTEXTUAL_EMBEDDING_MODEL, embeddings: [] });
    expect(voyageContextualEmbedMock).not.toHaveBeenCalled();
  });

  it('embeds documents with input_type document and short-circuits empty input', async () => {
    voyageEmbedMock.mockResolvedValue([
      [0.1],
      [0.2],
    ]);
    await expect(
      service('voy_stored_key').embedDocuments(['one', 'two']),
    ).resolves.toEqual([[0.1], [0.2]]);
    expect(voyageEmbedMock).toHaveBeenCalledWith({
      apiKey: 'voy_stored_key',
      model: EMBEDDING_MODEL,
      input: ['one', 'two'],
      inputType: 'document',
    });

    voyageEmbedMock.mockClear();
    await expect(service('voy_stored_key').embedDocuments([])).resolves.toEqual(
      [],
    );
    expect(voyageEmbedMock).not.toHaveBeenCalled();
  });
});
