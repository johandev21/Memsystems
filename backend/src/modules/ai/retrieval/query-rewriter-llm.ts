import {
  MAX_REWRITE_HYPOTHETICAL_CHARS,
  MAX_REWRITE_QUERY_CHARS,
  type QueryRewriteRequest,
  type QueryRewriteResult,
  type QueryRewriter,
  type RetrievalHistoryTurn,
} from './query-understanding.config';

export const REWRITE_INSTRUCTIONS = `You turn a student's chat message into search queries for a study-notes retrieval system.

Rules:
- Return the subject the student wants material about, never instructions about tone, length, format, or language.
- Keep names, numbers, identifiers, and technical terms exactly as written.
- Resolve references such as "it", "that", or "the second chapter" using the recent turns.
- The latest message is the one to rewrite. Recent turns only supply context.
- Never answer the question and never invent a subject that is not implied by the message or the recent turns.
- Reply with JSON only, no markdown fences, exactly this shape:
{"query": string, "variants": string[], "hypotheticalAnswer": string}
- "variants": paraphrases of the query that use different vocabulary for the same subject. Empty when none were requested.
- "hypotheticalAnswer": a short textbook-style passage that would answer the query, written as if it came from the student's notes. Empty when none was requested.`;

export function buildRewritePrompt(request: {
  message: string;
  history: RetrievalHistoryTurn[];
  variantCount: number;
  hypotheticalAnswer: boolean;
}): string {
  const lines: string[] = [];
  if (request.history.length > 0) {
    lines.push('Recent turns (oldest first):');
    for (const turn of request.history) {
      lines.push(`${turn.role}: ${turn.content}`);
    }
    lines.push('');
  } else {
    lines.push('Recent turns: none.', '');
  }
  lines.push(
    `Requests: ${request.variantCount > 0 ? `up to ${request.variantCount} paraphrase variant(s)` : 'no variants'}; ${
      request.hypotheticalAnswer
        ? 'a hypothetical answer passage is requested'
        : 'no hypothetical answer'
    }.`,
    '',
    'Latest message to rewrite:',
    request.message,
  );
  return lines.join('\n');
}

export function sanitizeRewriteQuery(text: string): string | null {
  const cleaned = text
    .replace(/^["'`\s]+|["'`\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  return cleaned.length > MAX_REWRITE_QUERY_CHARS
    ? `${cleaned.slice(0, MAX_REWRITE_QUERY_CHARS).trimEnd()}`
    : cleaned;
}

export function sanitizeRewriteVariants(
  candidates: readonly unknown[],
  query: string,
  max: number,
): string[] {
  const variants: string[] = [];
  if (max < 1) return variants;
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const variant = sanitizeRewriteQuery(candidate);
    if (!variant || variant === query || variants.includes(variant)) continue;
    variants.push(variant);
    if (variants.length >= max) break;
  }
  return variants;
}

export interface ParsedRewriteResponse {
  query: string;
  variants: string[];
  hypotheticalAnswer: string | null;
}

export function parseRewriteResponse(
  text: string,
  options: { variantCount: number; hypotheticalAnswer: boolean },
): ParsedRewriteResponse | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  const query =
    typeof record.query === 'string'
      ? sanitizeRewriteQuery(record.query)
      : null;
  if (!query) return null;

  const variants = sanitizeRewriteVariants(
    Array.isArray(record.variants) ? record.variants : [],
    query,
    options.variantCount,
  );

  let hypotheticalAnswer: string | null = null;
  if (
    options.hypotheticalAnswer &&
    typeof record.hypotheticalAnswer === 'string'
  ) {
    const cleaned = record.hypotheticalAnswer.replace(/\s+/g, ' ').trim();
    if (cleaned) {
      hypotheticalAnswer =
        cleaned.length > MAX_REWRITE_HYPOTHETICAL_CHARS
          ? cleaned.slice(0, MAX_REWRITE_HYPOTHETICAL_CHARS).trimEnd()
          : cleaned;
    }
  }

  return { query, variants, hypotheticalAnswer };
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => void,
): Promise<{ timedOut: boolean; result: T | null }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise.then((result) => ({ timedOut: false, result })),
      new Promise<{ timedOut: true; result: null }>((resolve) => {
        timer = setTimeout(() => {
          onTimeout();
          resolve({ timedOut: true, result: null });
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type LlmRewriteOutcome =
  | { status: 'success'; result: QueryRewriteResult }
  | { status: 'timeout' }
  | { status: 'no_provider' }
  | { status: 'failed'; error?: unknown };

export async function executeLlmRewrite(
  rewriter: QueryRewriter,
  request: QueryRewriteRequest,
  timeoutMs: number,
): Promise<LlmRewriteOutcome> {
  const controller = new AbortController();
  try {
    const outcome = await withTimeout(
      rewriter.rewrite({ ...request, signal: controller.signal }),
      timeoutMs,
      () => controller.abort(),
    );
    if (controller.signal.aborted || outcome.timedOut) {
      return { status: 'timeout' };
    }
    if (outcome.result === null) {
      return { status: 'no_provider' };
    }
    return { status: 'success', result: outcome.result };
  } catch (error) {
    if (controller.signal.aborted) {
      return { status: 'timeout' };
    }
    return { status: 'failed', error };
  }
}
