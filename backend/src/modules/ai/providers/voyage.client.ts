import {
  BadRequestError,
  DomainError,
  RateLimitedError,
  ServiceUnavailableError,
  UnauthorizedError,
} from '../../../common/errors/domain-error';

export const VOYAGE_EMBEDDINGS_URL = 'https://api.voyageai.com/v1/embeddings';
export const VOYAGE_RERANK_URL = 'https://api.voyageai.com/v1/rerank';

/** Voyage accepts at most 1,000 texts per request; stay well under it. */
const MAX_TEXTS_PER_REQUEST = 256;

/**
 * Voyage caps rerank requests at 1,000 documents. The retrieval pipeline
 * clamps its candidate depth to this limit and skips reranking when a
 * selected-source scope still exceeds it, so an over-limit request is never
 * sent. A request that stays under the document cap but exceeds the model's
 * token budget fails and degrades to fused order.
 */
export const MAX_RERANK_DOCUMENTS = 1000;

/**
 * Rerank is on the critical path of a Chat turn. Its request timeout is
 * shorter than the embeddings timeout so an unresponsive reranker degrades
 * to fused order quickly instead of stalling the turn.
 */
const RERANK_TIMEOUT_MS = 15_000;

/**
 * Voyage caps tokens per request at 320K (voyage-4) or 120K
 * (voyage-4-large). Batches stay under 240K estimated tokens — below
 * either cap — with tokens estimated at ~4 chars each. Estimation is only
 * used to split batches; the API truncates real over-length inputs.
 */
const MAX_ESTIMATED_TOKENS_PER_REQUEST = 240_000;
const CHARS_PER_TOKEN = 4;
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Estimates Voyage input tokens from text length (~4 chars each). Batch
 * splitting uses it, and retrieval traces record it as the query's token
 * cost without a second provider call.
 */
export function estimateVoyageTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

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

export interface VoyageRerankOptions {
  apiKey: string;
  model: string;
  query: string;
  documents: string[];
  /** Test seam; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export interface VoyageRerankCandidate {
  /** Position of the document in the request list. */
  index: number;
  /** Cross-encoder relevance score, higher is more relevant. */
  relevanceScore: number;
}

export interface VoyageRerankResponse {
  /** Every requested document, ordered by descending relevance score. */
  candidates: VoyageRerankCandidate[];
  /** Provider-reported tokens spent reranking. */
  totalTokens: number;
}

/**
 * Thin client for Voyage AI's reranker endpoint. The cross-encoder scores
 * each query-document pair jointly, which is why retrieval uses it to refine
 * the fused candidate order. HTTP failures map onto the same localized
 * domain errors as embeddings; the pipeline treats them as a signal to fall
 * back to the fused order.
 */
export async function voyageRerank(
  options: VoyageRerankOptions,
): Promise<VoyageRerankResponse> {
  if (options.documents.length === 0) {
    return { candidates: [], totalTokens: 0 };
  }

  const payload = await postVoyageJson<{
    data?: { index?: unknown; relevance_score?: unknown }[];
    usage?: { total_tokens?: unknown };
  }>({
    url: VOYAGE_RERANK_URL,
    apiKey: options.apiKey,
    subject: 'rerank',
    timeoutMs: RERANK_TIMEOUT_MS,
    fetchImpl: options.fetchImpl ?? fetch,
    body: {
      model: options.model,
      query: options.query,
      documents: options.documents,
      truncation: true,
    },
  });
  if (!payload.data || !Array.isArray(payload.data)) {
    throw malformedResponse('rerank');
  }

  const candidates = payload.data.map((entry) => {
    if (
      typeof entry.index !== 'number' ||
      typeof entry.relevance_score !== 'number'
    ) {
      throw malformedResponse('rerank');
    }
    return { index: entry.index, relevanceScore: entry.relevance_score };
  });

  return {
    candidates,
    totalTokens:
      typeof payload.usage?.total_tokens === 'number'
        ? payload.usage.total_tokens
        : 0,
  };
}

/**
 * POSTs JSON to a Voyage endpoint and maps transport and HTTP failures onto
 * domain errors. Callers validate the payload shape; a body that is not JSON
 * at all is rejected here.
 */
async function postVoyageJson<T>(options: {
  url: string;
  apiKey: string;
  body: unknown;
  timeoutMs: number;
  subject: 'embeddings' | 'rerank';
  fetchImpl: typeof fetch;
}): Promise<T> {
  let response: Response;
  try {
    response = await options.fetchImpl(options.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options.body),
      signal: AbortSignal.timeout(options.timeoutMs),
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
    throw voyageHttpError(response.status, detail, options.subject);
  }

  const payload = (await response.json().catch(() => null)) as T | null;
  if (!payload) throw malformedResponse(options.subject);
  return payload;
}

function malformedResponse(subject: 'embeddings' | 'rerank'): DomainError {
  return new ServiceUnavailableError(
    `Voyage returned a malformed ${subject} response.`,
    { messageKey: 'errors.ai.voyage.invalidResponse' },
  );
}

function splitIntoBatches(input: string[]): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let estimatedTokens = 0;
  for (const text of input) {
    const textTokens = estimateVoyageTokens(text);
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
  const payload = await postVoyageJson<{
    data?: { index?: number; embedding?: unknown }[];
  }>({
    url: VOYAGE_EMBEDDINGS_URL,
    apiKey: deps.apiKey,
    subject: 'embeddings',
    timeoutMs: REQUEST_TIMEOUT_MS,
    fetchImpl: deps.fetchImpl,
    body: {
      model: deps.model,
      input: deps.batch,
      input_type: deps.inputType,
      truncation: true,
    },
  });
  if (!payload.data || !Array.isArray(payload.data)) {
    throw malformedResponse('embeddings');
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
      throw malformedResponse('embeddings');
    }
    return entry.embedding as number[];
  });
}

function voyageHttpError(
  status: number,
  detail: string,
  subject: 'embeddings' | 'rerank',
): DomainError {
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
    `Voyage rejected the ${subject} request.${summary ? ` (${summary})` : ''}`,
    { messageKey: 'errors.ai.voyage.requestFailed' },
  );
}
