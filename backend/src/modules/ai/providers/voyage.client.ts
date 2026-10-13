import {
  BadRequestError,
  DomainError,
  RateLimitedError,
  ServiceUnavailableError,
  UnauthorizedError,
} from '../../../common/errors/domain-error';

export const VOYAGE_EMBEDDINGS_URL = 'https://api.voyageai.com/v1/embeddings';
export const VOYAGE_CONTEXTUAL_EMBEDDINGS_URL =
  'https://api.voyageai.com/v1/contextualizedembeddings';
export const VOYAGE_RERANK_URL = 'https://api.voyageai.com/v1/rerank';

const MAX_TEXTS_PER_REQUEST = 256;

const MAX_CONTEXTUAL_INPUTS_PER_REQUEST = 256;
const MAX_CONTEXTUAL_CHUNKS_PER_REQUEST = 1_024;
const MAX_CONTEXTUAL_TOKENS_PER_REQUEST = 30_000;

export const MAX_RERANK_DOCUMENTS = 1000;

const RERANK_TIMEOUT_MS = 15_000;

const MAX_ESTIMATED_TOKENS_PER_REQUEST = 240_000;

export const VOYAGE_CHARS_PER_TOKEN = 4;

const REQUEST_TIMEOUT_MS = 60_000;

export function estimateVoyageTokens(text: string): number {
  return Math.ceil(text.length / VOYAGE_CHARS_PER_TOKEN);
}

export type VoyageInputType = 'query' | 'document';

export interface VoyageEmbedOptions {
  apiKey: string;
  model: string;
  input: string[];
  inputType: VoyageInputType;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

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
        timeoutMs: options.timeoutMs,
        batch,
      }),
    );
  }
  return results.flat();
}

export interface VoyageContextualEmbedOptions {
  apiKey: string;
  model: string;
  groups: string[][];
  inputType: VoyageInputType;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface VoyageContextualEmbedResponse {
  embeddings: number[][];
  totalTokens: number;
}

export async function voyageContextualEmbed(
  options: VoyageContextualEmbedOptions,
): Promise<VoyageContextualEmbedResponse> {
  const totalChunks = options.groups.reduce(
    (sum, group) => sum + group.length,
    0,
  );
  if (totalChunks === 0) return { embeddings: [], totalTokens: 0 };

  const fetchImpl = options.fetchImpl ?? fetch;
  const batches = splitIntoGroupBatches(options.groups);
  const embeddings: number[][] = [];
  let totalTokens = 0;
  for (const batch of batches) {
    const result = await requestContextualBatch({
      fetchImpl,
      apiKey: options.apiKey,
      model: options.model,
      inputType: options.inputType,
      timeoutMs: options.timeoutMs,
      batch,
    });
    embeddings.push(...result.embeddings);
    totalTokens += result.totalTokens;
  }
  return { embeddings, totalTokens };
}

export interface VoyageRerankOptions {
  apiKey: string;
  model: string;
  query: string;
  documents: string[];
  fetchImpl?: typeof fetch;
}

export interface VoyageRerankCandidate {
  index: number;
  relevanceScore: number;
}

export interface VoyageRerankResponse {
  candidates: VoyageRerankCandidate[];
  totalTokens: number;
}

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

async function postVoyageJson<T>(options: {
  url: string;
  apiKey: string;
  body: unknown;
  timeoutMs: number;
  subject: 'embeddings' | 'contextual embeddings' | 'rerank';
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

function malformedResponse(
  subject: 'embeddings' | 'contextual embeddings' | 'rerank',
): DomainError {
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
  timeoutMs?: number;
  batch: string[];
}): Promise<number[][]> {
  const payload = await postVoyageJson<{
    data?: { index?: number; embedding?: unknown }[];
  }>({
    url: VOYAGE_EMBEDDINGS_URL,
    apiKey: deps.apiKey,
    subject: 'embeddings',
    timeoutMs: deps.timeoutMs ?? REQUEST_TIMEOUT_MS,
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

function splitIntoGroupBatches(groups: string[][]): string[][][] {
  const fitted: string[][] = [];
  for (const group of groups) {
    if (group.length === 0) continue;
    let current: string[] = [];
    let estimatedTokens = 0;
    for (const text of group) {
      const textTokens = estimateVoyageTokens(text);
      if (
        current.length > 0 &&
        estimatedTokens + textTokens > MAX_CONTEXTUAL_TOKENS_PER_REQUEST
      ) {
        fitted.push(current);
        current = [];
        estimatedTokens = 0;
      }
      current.push(text);
      estimatedTokens += textTokens;
    }
    if (current.length > 0) fitted.push(current);
  }

  const batches: string[][][] = [];
  let current: string[][] = [];
  let estimatedTokens = 0;
  let chunks = 0;
  for (const group of fitted) {
    const groupTokens = group.reduce(
      (sum, text) => sum + estimateVoyageTokens(text),
      0,
    );
    if (
      current.length > 0 &&
      (current.length >= MAX_CONTEXTUAL_INPUTS_PER_REQUEST ||
        chunks + group.length > MAX_CONTEXTUAL_CHUNKS_PER_REQUEST ||
        estimatedTokens + groupTokens > MAX_CONTEXTUAL_TOKENS_PER_REQUEST)
    ) {
      batches.push(current);
      current = [];
      estimatedTokens = 0;
      chunks = 0;
    }
    current.push(group);
    estimatedTokens += groupTokens;
    chunks += group.length;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

async function requestContextualBatch(deps: {
  fetchImpl: typeof fetch;
  apiKey: string;
  model: string;
  inputType: VoyageInputType;
  timeoutMs?: number;
  batch: string[][];
}): Promise<VoyageContextualEmbedResponse> {
  const payload = await postVoyageJson<{
    data?: {
      index?: number;
      data?: { index?: number; embedding?: unknown }[];
    }[];
    usage?: { total_tokens?: unknown };
  }>({
    url: VOYAGE_CONTEXTUAL_EMBEDDINGS_URL,
    apiKey: deps.apiKey,
    subject: 'contextual embeddings',
    timeoutMs: deps.timeoutMs ?? REQUEST_TIMEOUT_MS,
    fetchImpl: deps.fetchImpl,
    body: {
      model: deps.model,
      inputs: deps.batch,
      input_type: deps.inputType,
    },
  });
  if (!payload.data || !Array.isArray(payload.data)) {
    throw malformedResponse('contextual embeddings');
  }

  const groups = payload.data.map((entry, position) => ({
    index: typeof entry.index === 'number' ? entry.index : position,
    chunks: Array.isArray(entry.data) ? entry.data : [],
  }));
  groups.sort((a, b) => a.index - b.index);

  const embeddings: number[][] = [];
  for (const group of groups) {
    const chunks = group.chunks.map((entry, position) => ({
      index: typeof entry.index === 'number' ? entry.index : position,
      embedding: entry.embedding,
    }));
    chunks.sort((a, b) => a.index - b.index);
    for (const chunk of chunks) {
      if (!Array.isArray(chunk.embedding)) {
        throw malformedResponse('contextual embeddings');
      }
      embeddings.push(chunk.embedding as number[]);
    }
  }
  if (embeddings.length === 0) {
    throw malformedResponse('contextual embeddings');
  }

  return {
    embeddings,
    totalTokens:
      typeof payload.usage?.total_tokens === 'number'
        ? payload.usage.total_tokens
        : 0,
  };
}

function voyageHttpError(
  status: number,
  detail: string,
  subject: 'embeddings' | 'contextual embeddings' | 'rerank',
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
