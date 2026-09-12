import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServiceUnavailableError } from '../src/common/errors/domain-error';
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EmbeddingService,
  voyageApiKeyFromEnv,
} from '../src/modules/ai/embedding.service';

const { voyageEmbedMock } = vi.hoisted(() => ({
  voyageEmbedMock: vi.fn(),
}));

vi.mock('../src/modules/ai/providers/voyage.client', () => ({
  voyageEmbed: voyageEmbedMock,
}));

function service(voyageApiKey: string | null = null) {
  return new EmbeddingService({
    getVoyageApiKey: vi.fn().mockResolvedValue(voyageApiKey),
  } as never);
}

const VOYAGE_ENV_KEY = 'VOYAGE_API_KEY';

describe('EmbeddingService', () => {
  afterEach(() => {
    delete process.env[VOYAGE_ENV_KEY];
    voyageEmbedMock.mockReset();
  });

  it('configures voyage-4 at 1024 dimensions', () => {
    expect(EMBEDDING_MODEL).toBe('voyage-4');
    expect(EMBEDDING_DIMENSIONS).toBe(1024);
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
    expect(voyageEmbedMock).not.toHaveBeenCalled();
  });

  it('falls back to the environment key when nothing is stored', async () => {
    process.env[VOYAGE_ENV_KEY] = 'voy_env_key';
    voyageEmbedMock.mockResolvedValue([[0.1, 0.2]]);
    await expect(service().embedQuery('q')).resolves.toEqual([0.1, 0.2]);
    expect(voyageEmbedMock).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'voy_env_key' }),
    );
  });

  it('prefers the stored settings key over the environment fallback', async () => {
    process.env[VOYAGE_ENV_KEY] = 'voy_env_key';
    voyageEmbedMock.mockResolvedValue([[0.1]]);
    await service('voy_stored_key').embedQuery('q');
    expect(voyageEmbedMock).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'voy_stored_key' }),
    );
  });

  it('embeds queries with input_type query', async () => {
    voyageEmbedMock.mockResolvedValue([[0.3, 0.4]]);
    await expect(service('voy_stored_key').embedQuery('search this')).resolves.toEqual([
      0.3, 0.4,
    ]);
    expect(voyageEmbedMock).toHaveBeenCalledWith({
      apiKey: 'voy_stored_key',
      model: EMBEDDING_MODEL,
      input: ['search this'],
      inputType: 'query',
    });
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
    await expect(service('voy_stored_key').embedDocuments([])).resolves.toEqual([]);
    expect(voyageEmbedMock).not.toHaveBeenCalled();
  });
});
