import {
  BadRequestError,
  DomainError,
  RateLimitedError,
  ServiceUnavailableError,
  UnauthorizedError,
} from '../../../common/errors/domain-error';

export const VOYAGE_EMBEDDINGS_URL = 'https://api.voyageai.com/v1/embeddings';

/** Voyage accepts at most 1,000 texts per request; stay well under it. */
const MAX_TEXTS_PER_REQUEST = 256;

/**
 * Voyage caps tokens per request at 320K (voyage-4) or 120K
 * (voyage-4-large). Batches stay under 240K estimated tokens — below
 * either cap — with tokens estimated at ~4 chars each. Estimation is only
 * used to split batches; the API truncates real over-length inputs.
 */
const MAX_ESTIMATED_TOKENS_PER_REQUEST = 240_000;
const CHARS_PER_TOKEN = 4;
const REQUEST_TIMEOUT_MS = 60_000;

export type VoyageInputType = 'query' | 'document';

export interface VoyageEmbedOptions {
  apiKey: string;
  model: string;
  input: string[];
  inputType: VoyageInputType;
  /** Test seam; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

/**
 * Thin client for Voyage AI's embeddings endpoint. Splits large inputs into
 * API-sized batches, preserves input order, and maps HTTP failures onto
 * localized domain errors. No SDK dependency: the endpoint is a single POST.
 */
export async function voyageEmbed(
  options: VoyageEmbedOptions,
): Promise<number[][]> {
  if (options.input.length === 0) return [];
  const fetchImpl = options.fetchImpl ?? fetch;
  const batches = splitIntoBatches(options.input);

  const results: number[][][] = [];
  for (const batch of batches) {
    results.push(
      await requestBatch({
        fetchImpl,
        apiKey: options.apiKey,
        model: options.model,
        inputType: options.inputType,
        batch,
      }),
    );
  }
  return results.flat();
}

function splitIntoBatches(input: string[]): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let estimatedTokens = 0;
  for (const text of input) {
    const textTokens = Math.ceil(text.length / CHARS_PER_TOKEN);
    if (
      current.length > 0 &&
      (current.length >= MAX_TEXTS_PER_REQUEST ||
        estimatedTokens + textTokens > MAX_ESTIMATED_TOKENS_PER_REQUEST)
    ) {
      batches.push(current);
      current = [];
      estimatedTokens = 0;
    }
    current.push(text);
    estimatedTokens += textTokens;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

async function requestBatch(deps: {
  fetchImpl: typeof fetch;
  apiKey: string;
  model: string;
  inputType: VoyageInputType;
  batch: string[];
}): Promise<number[][]> {
  let response: Response;
  try {
    response = await deps.fetchImpl(VOYAGE_EMBEDDINGS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${deps.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: deps.model,
        input: deps.batch,
        input_type: deps.inputType,
        truncation: true,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new ServiceUnavailableError(
      `Voyage is unreachable: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { messageKey: 'errors.ai.voyage.unreachable' },
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw voyageHttpError(response.status, detail);
  }

  const payload = (await response.json().catch(() => null)) as {
    data?: { index?: number; embedding?: unknown }[];
  } | null;
  if (!payload?.data || !Array.isArray(payload.data)) {
    throw new ServiceUnavailableError(
      'Voyage returned a malformed embeddings response.',
      { messageKey: 'errors.ai.voyage.invalidResponse' },
    );
  }

  // The API documents an `index` per embedding; honor it instead of array
  // order so batch results always line up with the input texts.
  const embeddings = payload.data.map((entry, position) => ({
    index: typeof entry.index === 'number' ? entry.index : position,
    embedding: entry.embedding,
  }));
  embeddings.sort((a, b) => a.index - b.index);
  return embeddings.map((entry) => {
    if (!Array.isArray(entry.embedding)) {
      throw new ServiceUnavailableError(
        'Voyage returned a malformed embeddings response.',
        { messageKey: 'errors.ai.voyage.invalidResponse' },
      );
    }
    return entry.embedding as number[];
  });
}

function voyageHttpError(status: number, detail: string): DomainError {
  const summary = detail.trim().slice(0, 300);
  if (status === 401 || status === 403) {
    return new UnauthorizedError(
      `That Voyage API key was rejected. Check the key and try again.${
        summary ? ` (${summary})` : ''
      }`,
      { messageKey: 'errors.ai.voyage.keyRejected' },
    );
  }
  if (status === 429) {
    return new RateLimitedError(
      'Voyage is rate-limiting requests right now. The job will retry automatically.',
      { messageKey: 'errors.ai.voyage.rateLimited' },
    );
  }
  if (status >= 500) {
    return new ServiceUnavailableError(
      `Voyage had a server error.${summary ? ` (${summary})` : ''}`,
      { messageKey: 'errors.ai.voyage.serverError' },
    );
  }
  return new BadRequestError(
    `Voyage rejected the embeddings request.${summary ? ` (${summary})` : ''}`,
    { messageKey: 'errors.ai.voyage.requestFailed' },
  );
}
