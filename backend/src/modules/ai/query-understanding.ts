import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { clamp, parseBoolean, parsePositiveInt } from './config-parsing';
import {
  MAX_TRACE_HYPOTHETICAL_CHARS,
  type RetrievalTraceRewrite,
} from './retrieval-trace';

/**
 * Query understanding is the retrieval stage that runs before the search
 * legs. The user message is a packet of intent — a subject plus tone, length,
 * and format instructions, and sometimes references to the previous turn —
 * while the retrieval legs need a search query that expresses the subject.
 *
 * A lightweight model rewrites the message into that search query, resolves
 * references from the recent turns, and can return paraphrases and a
 * hypothetical answer. The model is optional: the stage decides when a
 * rewrite is worth paying for, records the decision in the retrieval trace,
 * and falls back to a deterministic heuristic when the model is unavailable,
 * times out, or fails. Retrieval never fails because rewriting did.
 */

/** One recent chat turn the rewrite may resolve references from. */
export interface RetrievalHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Why the pipeline rewrote the message. */
export type QueryRewriteTrigger =
  'meta_instructions' | 'follow_up' | 'ambiguous';

/**
 * Why the query that ran was not produced by the rewrite model. `disabled`,
 * `empty_message` and `search_ready` are decisions taken before any model
 * call; `no_provider`, `timeout` and `failed` are degradations, and the
 * heuristic stood in.
 */
export type RetrievalRewriteReason =
  | 'disabled'
  | 'empty_message'
  | 'search_ready'
  | 'no_provider'
  | 'timeout'
  | 'failed';

/** The recent turns one rewrite call may see, and how much of each. */
export const MAX_REWRITE_HISTORY_TURNS = 4;
export const MAX_REWRITE_HISTORY_CHARS = 600;

/** The deterministic heuristic's topic-expansion bounds. */
export const MAX_REWRITE_TOPIC_TERMS = 8;

/**
 * Content words below which a message is treated as too short to carry a
 * subject on its own: "osmosis?" or "the second one?" need expansion before
 * they make a usable search query.
 */
export const MIN_REWRITE_CONTENT_WORDS = 3;

/** The rewrite request seam. Implementations are the model client. */
export interface QueryRewriteRequest {
  message: string;
  /** Recent turns, oldest first, already trimmed to the stage's bounds. */
  history: RetrievalHistoryTurn[];
  /** How many paraphrases to return; 0 when multi-query is disabled. */
  variantCount: number;
  /** Whether to return a hypothetical answer passage for short queries. */
  hypotheticalAnswer: boolean;
  /** Aborted when the rewrite exceeds its latency budget. */
  signal?: AbortSignal;
}

export interface QueryRewriteResult {
  /** The search query the legs should run. Never empty. */
  query: string;
  /** Paraphrases of `query`, in the model's order; may be empty. */
  variants: string[];
  /** A passage that would answer the query, when it was requested. */
  hypotheticalAnswer: string | null;
  /** Provider-reported tokens, or an estimate when it reports none. */
  inputTokens: number;
  outputTokens: number;
}

/**
 * The rewrite model seam. Implementations return `null` when no model is
 * configured; provider failures throw. The query-understanding stage owns
 * the graceful degradation, so it can run the heuristic instead and record
 * why in the trace.
 */
export interface QueryRewriter {
  rewrite(request: QueryRewriteRequest): Promise<QueryRewriteResult | null>;
}

/**
 * Query understanding's knobs. The model is a gateway chat model; the
 * timeout is the whole latency budget of the stage, after which the raw
 * message proceeds through the heuristic.
 */
export interface RetrievalRewriteConfig {
  enabled: boolean;
  model: string;
  timeoutMs: number;
  /** Generate paraphrases that are fused as extra candidate lists. */
  multiQuery: boolean;
  /** How many paraphrases multi-query asks for, capped at 4. */
  variantCount: number;
  /** Ask for a hypothetical answer to embed for short queries (HyDE). */
  hypotheticalAnswer: boolean;
}

export const RETRIEVAL_REWRITE_CONFIG = 'RETRIEVAL_REWRITE_CONFIG';

/**
 * Injection token for the rewrite model. A separate token keeps the rewrite
 * client swappable (and the evaluation harness keyless) without the stage
 * depending on the gateway provider directly.
 */
export const QUERY_REWRITER = 'QUERY_REWRITER';

/**
 * Documented default rewrite model: a small, cheap chat model from the
 * gateway catalog. Rewriting is a bounded, low-stakes transformation, so
 * quality-per-latency matters more than raw model quality.
 */
export const DEFAULT_REWRITE_MODEL = 'openai/gpt-4o-mini';

/**
 * Documented default latency budget for the rewrite call. The stage runs on
 * the retrieval critical path, so the budget is deliberately smaller than a
 * chat turn's: a slow rewrite degrades to the heuristic instead of holding
 * the answer. See docs/retrieval-evaluation.md for the end-to-end budget.
 */
export const DEFAULT_REWRITE_TIMEOUT_MS = 1200;

/** Multi-query asks for two paraphrases by default. */
export const DEFAULT_REWRITE_VARIANT_COUNT = 2;

export const MAX_REWRITE_VARIANTS = 4;

/** The rewrite request's answer budget, which also bounds its latency. */
export const MAX_REWRITE_OUTPUT_TOKENS = 400;

/**
 * Caps on the text a rewrite may produce, so a runaway reply cannot bloat a query.
 */
export const MAX_REWRITE_QUERY_CHARS = 600;
export const MAX_REWRITE_HYPOTHETICAL_CHARS = 600;

export const DEFAULT_REWRITE_CONFIG: RetrievalRewriteConfig = {
  enabled: true,
  model: DEFAULT_REWRITE_MODEL,
  timeoutMs: DEFAULT_REWRITE_TIMEOUT_MS,
  multiQuery: true,
  variantCount: DEFAULT_REWRITE_VARIANT_COUNT,
  hypotheticalAnswer: false,
};

/**
 * Reads the query-understanding configuration from the environment, falling
 * back to the documented defaults for anything unset or unusable.
 */
export function loadRetrievalRewriteConfig(
  env: NodeJS.ProcessEnv = process.env,
): RetrievalRewriteConfig {
  return {
    enabled: parseBoolean(env.RETRIEVAL_REWRITE_ENABLED, true),
    model: env.RETRIEVAL_REWRITE_MODEL?.trim() || DEFAULT_REWRITE_MODEL,
    timeoutMs: clamp(
      parsePositiveInt(
        env.RETRIEVAL_REWRITE_TIMEOUT_MS,
        DEFAULT_REWRITE_TIMEOUT_MS,
      ),
      1,
      10000,
    ),
    multiQuery: parseBoolean(env.RETRIEVAL_REWRITE_MULTI_QUERY, true),
    variantCount: clamp(
      parsePositiveInt(
        env.RETRIEVAL_REWRITE_VARIANT_COUNT,
        DEFAULT_REWRITE_VARIANT_COUNT,
      ),
      1,
      MAX_REWRITE_VARIANTS,
    ),
    hypotheticalAnswer: parseBoolean(
      env.RETRIEVAL_REWRITE_HYPOTHETICAL_ANSWER,
      false,
    ),
  };
}

/**
 * Words that carry no retrieval signal: question words, articles, pronouns,
 * and the instruction verbs a user wraps around a subject. Shared by the
 * decision, the heuristic fallback, and the trace.
 */
const REWRITE_STOP_WORDS = new Set([
  'a',
  'about',
  'above',
  'across',
  'after',
  'against',
  'along',
  'among',
  'an',
  'and',
  'answer',
  'are',
  'around',
  'as',
  'at',
  'be',
  'been',
  'being',
  'before',
  'behind',
  'below',
  'beneath',
  'beside',
  'between',
  'briefly',
  'but',
  'by',
  'can',
  'chapter',
  'chapters',
  'concise',
  'concern',
  'could',
  'describe',
  'detail',
  'did',
  'do',
  'does',
  'doing',
  'done',
  'during',
  'except',
  'explain',
  'explained',
  'explaining',
  'explains',
  'for',
  'from',
  'give',
  'go',
  'going',
  'he',
  'her',
  'here',
  'hers',
  'him',
  'his',
  'how',
  'i',
  'if',
  'in',
  'inside',
  'into',
  'is',
  'it',
  'its',
  'just',
  'like',
  'list',
  'me',
  'more',
  'most',
  'my',
  'near',
  'need',
  'no',
  'not',
  'of',
  'on',
  'only',
  'or',
  'our',
  'out',
  'outside',
  'over',
  'own',
  'please',
  'provide',
  'said',
  'same',
  'say',
  'says',
  'she',
  'short',
  'should',
  'show',
  'simple',
  'so',
  'some',
  'such',
  'summarize',
  'summarise',
  'summary',
  'tell',
  'than',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'through',
  'to',
  'too',
  'toward',
  'under',
  'until',
  'upon',
  'us',
  'use',
  'using',
  'very',
  'want',
  'was',
  'we',
  'were',
  'what',
  'when',
  'where',
  'which',
  'who',
  'whom',
  'why',
  'will',
  'with',
  'within',
  'without',
  'would',
  'write',
  'you',
  'your',
]);

/**
 * Words that point at something already said instead of naming it. A short
 * message containing one of these is a follow-up: the reference has to be
 * resolved from the recent turns before it can be searched.
 */
const REFERENCE_WORDS = new Set([
  'above',
  'another',
  'both',
  'detail',
  'details',
  'either',
  'elsewhere',
  'expand',
  'first',
  'following',
  'former',
  'fourth',
  'happen',
  'happens',
  'instead',
  'last',
  'latter',
  'mentioned',
  'next',
  'none',
  'one',
  'ones',
  'other',
  'others',
  'previous',
  'second',
  'sixth',
  'third',
  'fifth',
]);

/**
 * Directives about how to answer, which must not dominate the query. Shared by
 * the skip decision and the heuristic, so a message that is rewritten because
 * of one of these patterns has the pattern stripped as well.
 */
const TONE_WORDS =
  'friendly|casual|formal|professional|academic|conversational|humorous|playful|serious|encouraging|patient|enthusiastic|warm|reassuring|neutral';

const NARRATIVE_FORMS =
  'story|poem|dialogue|letter|email|news\\s+article|blog\\s+post|script|song|fable|parable|journey|scenario';

const AUDIENCES =
  'beginners?|children|kids?|students?|experts?|laypeople|layperson|novices?|general\\s+audience|five[- ]year[- ]olds?|\\d+[- ]year[- ]olds?';

const META_PATTERNS: RegExp[] = [
  // Length or count directives: "in two sentences", "in 300 words".
  /\b(?:in|as|using|with)\s+(?:a\s+|an\s+|the\s+)?(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|a\s+few|several)\s+(?:words?|sentences?|paragraphs?|bullets?|bullet\s+points?|points?|lines?|steps?|items?)\b/gi,
  // Format directives: "as a table", "with bullet points", "in an outline".
  /\b(?:in|as|using|with)\s+(?:a\s+|an\s+|the\s+)?(?:bullet\s+points?|bullets?|numbered\s+list|table|markdown|outline|essay|paragraph)\b/gi,
  // Degree adverbs that modify the answer, not the subject.
  /\b(?:briefly|concisely|succinctly|in\s+detail|in\s+short|in\s+simple\s+terms|step-by-step|in\s+depth)\b/gi,
  // A short answer noun with its modifier: "a short summary".
  /\b(?:short|brief|concise|quick|detailed|long|thorough|simple)\s+(?:chapter\s+|section\s+|article\s+|study\s+)?(?:summary|answer|explanation|overview|response|description|outline|notes?|paragraph|essay|report)\b/gi,
  /\b(?:bullet\s+points?|numbered\s+list)\b/gi,
  // Language directives: "answer in Spanish".
  /\b(?:answer|reply|respond|write|translate|format|give|explain)\s+(?:it\s+|this\s+|that\s+|the\s+answer\s+|your\s+answer\s+)?(?:in|as)\s+(?:spanish|english|french|german|portuguese|italian|dutch)\b/gi,
  /\bin\s+(?:spanish|english|french|german|portuguese|italian|dutch)\b/gi,
  // Tone, voice, or style requests: "in a friendly tone", "formal voice".
  new RegExp(
    `\\b(?:in|with|using)\\s+(?:a\\s+|an\\s+|the\\s+)?(?:${TONE_WORDS})\\s+(?:tone|voice|style|language|manner|way)\\b`,
    'gi',
  ),
  new RegExp(`\\b(?:${TONE_WORDS})\\s+(?:tone|voice|style)\\b`, 'gi'),
  // Narrative form requests: "as a story", "in the form of a poem".
  new RegExp(
    `\\b(?:as|in\\s+the\\s+form\\s+of|like)\\s+(?:a\\s+|an\\s+|the\\s+)?(?:short\\s+|brief\\s+|quick\\s+|simple\\s+)?(?:${NARRATIVE_FORMS})\\b`,
    'gi',
  ),
  // Audience requests: "for a beginner", "like I'm five".
  new RegExp(`\\bfor\\s+(?:a\\s+|an\\s+|the\\s+)?(?:${AUDIENCES})\\b`, 'gi'),
  /\blike\s+i(?:'m|\s+am)\s+(?:five|5|a\s+child|a\s+beginner|\d+)\b/gi,
];

/**
 * Leading request boilerplate. Stripped before the subject is searched, so
 * "Can you explain X" and "X" reach the legs as the same query.
 */
const META_PREFIX_PATTERN =
  /^(?:hi[,! ]+|hey[,! ]+|hello[,! ]+|please\s+|so\s+|now\s+|ok(?:ay)?[,! ]+|can\s+you\s+|could\s+you\s+|would\s+you\s+|will\s+you\s+|i\s+(?:want|need|would\s+like)\s+(?:you\s+)?to\s+|help\s+me\s+|give\s+me\s+|show\s+me\s+|tell\s+me\s+|write\s+|create\s+|make\s+|produce\s+|generate\s+|draft\s+|explain\s+|describe\s+|summari[sz]e\s+)/i;

/** Continuation phrases that only make sense against a previous turn. */
const CONTINUATION_PATTERN =
  /\b(?:expand|elaborate|continue|delve|go\s+on|keep\s+going|dig\s+deeper|say\s+more|tell\s+me\s+more|more\s+detail|more\s+about|same\s+thing)\b/i;

/** Question forms that defer their subject to the previous turn. */
const FOLLOW_UP_QUESTION_PATTERN =
  /\b(?:what|how|why|when|where|which)\s+about\b|\band\s+(?:what|how|why|when|where)\b/i;

/** A pronoun or an ordinal pointing at something already said. */
const ANAPHORA_PATTERN =
  /\b(?:it|its|they|them|their|this|that|these|those|one|ones|another|the\s+(?:first|second|third|fourth|fifth|sixth|last|next|previous|former|latter|above|same|other))\b/i;

/** Word tokens for the decision heuristics and the fallback rewrite. */
export function contentWords(text: string): string[] {
  const matches = text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu);
  if (!matches) return [];
  return matches.filter(
    (word) => word.length >= 2 && !REWRITE_STOP_WORDS.has(word),
  );
}

/**
 * True when the message asks for a tone, length, format, or language instead
 * of a subject. Such a message needs rewriting even when it is long.
 */
export function hasMetaInstructions(message: string): boolean {
  return META_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(message);
  });
}

/**
 * True when the message depends on an earlier turn: a continuation, a
 * "what about" question, or a short message built on a pronoun or ordinal.
 */
export function hasFollowUpReference(message: string): boolean {
  const words = contentWords(message);
  if (CONTINUATION_PATTERN.test(message)) {
    if (ANAPHORA_PATTERN.test(message)) return true;
    if (words.length <= MIN_REWRITE_CONTENT_WORDS) return true;
  }
  if (FOLLOW_UP_QUESTION_PATTERN.test(message)) return true;
  if (ANAPHORA_PATTERN.test(message) && words.length > 0) {
    if (words.length < MIN_REWRITE_CONTENT_WORDS + 2) return true;
  }
  return false;
}

/** A message with too few content words to carry a subject on its own. */
export function isAmbiguousQuery(message: string): boolean {
  return contentWords(message).length < MIN_REWRITE_CONTENT_WORDS;
}

export interface RewriteDecision {
  shouldRewrite: boolean;
  trigger: QueryRewriteTrigger | null;
  skipReason: 'disabled' | 'empty_message' | 'search_ready' | null;
}

/**
 * The skip decision. Rewriting costs a model call on the retrieval critical
 * path, so it runs only when it can change the query's meaning: the message
 * carries meta-instructions, points at a previous turn, or is too short to
 * be a search query. A single-shot factual question that already reads as a
 * search query is skipped (`search_ready`) and the trace records it.
 */
export function decideRewrite(
  message: string,
  config: Pick<RetrievalRewriteConfig, 'enabled'>,
): RewriteDecision {
  if (!config.enabled) {
    return { shouldRewrite: false, trigger: null, skipReason: 'disabled' };
  }
  if (!message.trim()) {
    return { shouldRewrite: false, trigger: null, skipReason: 'empty_message' };
  }
  if (hasMetaInstructions(message)) {
    return {
      shouldRewrite: true,
      trigger: 'meta_instructions',
      skipReason: null,
    };
  }
  if (hasFollowUpReference(message)) {
    return { shouldRewrite: true, trigger: 'follow_up', skipReason: null };
  }
  if (isAmbiguousQuery(message)) {
    return { shouldRewrite: true, trigger: 'ambiguous', skipReason: null };
  }
  return { shouldRewrite: false, trigger: null, skipReason: 'search_ready' };
}

/**
 * Removes the tone, length, format, and language directives from a message
 * and collapses what is left. Used by the heuristic fallback and, through
 * the shared helpers, by the evaluation harness's deterministic rewriter.
 * Returns the original text when stripping would leave nothing to search.
 */
export function stripMetaInstructions(message: string): string {
  let text = message.replace(/\s+/g, ' ').trim();
  let previous = '';
  // Prefixes and directives can nest ("can you give me a short summary…"),
  // so strip until the text stops changing.
  while (previous !== text) {
    previous = text;
    text = text.replace(META_PREFIX_PATTERN, '').trim();
    for (const pattern of META_PATTERNS) {
      text = text.replace(pattern, ' ');
    }
    text = text
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .trim();
  }
  text = text.replace(/^[\s,.;:!?–—-]+|[\s,.;:!?–—-]+$/g, '').trim();
  // Never hand back a string with no subject left: "Give me a short summary."
  // has nothing to search, so the original message stands.
  if (contentWords(text).length === 0) {
    return message.replace(/\s+/g, ' ').trim();
  }
  return text;
}

/**
 * The subject terms of the most recent turn that has any. Real chats have an
 * assistant reply after the user's question, so the search walks back to the
 * last user turn and only falls back to the last message when there is none.
 */
export function historyTopicTerms(
  history: RetrievalHistoryTurn[],
  maxTerms = MAX_REWRITE_TOPIC_TERMS,
): string[] {
  const turns = history.slice(-MAX_REWRITE_HISTORY_TURNS);
  const source =
    [...turns]
      .reverse()
      .find(
        (turn) => turn.role === 'user' && contentWords(turn.content).length > 0,
      ) ??
    [...turns].reverse().find((turn) => contentWords(turn.content).length > 0);
  if (!source) return [];

  const terms: string[] = [];
  for (const word of contentWords(source.content)) {
    if (REFERENCE_WORDS.has(word)) continue;
    if (!terms.includes(word)) terms.push(word);
    if (terms.length >= maxTerms) break;
  }
  return terms;
}

/**
 * The deterministic fallback rewrite: strip the directives, drop the words
 * that point at a previous turn, and prepend the previous turn's subject
 * terms when the message cannot stand on its own. It is what the pipeline
 * runs when the model is disabled, unavailable, slow, or broken, and it is
 * what the evaluation harness's keyless rewriter is built from.
 */
export function buildHeuristicRewrite(
  message: string,
  history: RetrievalHistoryTurn[] = [],
): string {
  const stripped = stripMetaInstructions(message);
  const subject = contentWords(stripped).filter(
    (word) => !REFERENCE_WORDS.has(word),
  );
  // Only a message that points at a previous turn borrows its subject from
  // history: a short standalone question is better searched as written than
  // padded with a topic it never referenced.
  const topic = hasFollowUpReference(message) ? historyTopicTerms(history) : [];
  const rewritten = [...subject, ...topic].join(' ').trim();
  return rewritten || message.replace(/\s+/g, ' ').trim();
}

/** Collapses whitespace and caps a model-produced query. */
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

/**
 * Sanitizes, dedupes, and caps the model's paraphrases: blanks, copies of the
 * primary query, and repeats are dropped, and no more than `max` survive.
 * Shared by the reply parser and the stage, so a custom rewriter gets the
 * same contract as the gateway client.
 */
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

/**
 * Parses the rewrite model's JSON reply defensively. Unknown shapes, a
 * missing query, and unparseable text return null, which the stage treats as
 * a failed rewrite and degrades to the heuristic.
 */
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

/**
 * The instructions for the rewrite model. Kept next to the parser so the
 * contract (JSON, no answering, keep identifiers, resolve references) is
 * defined in one place.
 */
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

/** Builds the user-facing part of the rewrite prompt. */
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

/** The outcome of one understanding call, ready to trace and search. */
export interface QueryUnderstanding {
  /** Whether the rewrite stage was enabled for the call. */
  enabled: boolean;
  /** The query the legs run, primary first; never empty. */
  queries: string[];
  /** Text the primary dense leg embeds instead of the query, if any. */
  hypotheticalAnswer: string | null;
  trigger: QueryRewriteTrigger | null;
  strategy: 'model' | 'heuristic' | null;
  reason: RetrievalRewriteReason | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * The stage outcome when query understanding is not wired: the message is
 * searched as sent and the trace records that rewriting was disabled.
 */
export function passthroughUnderstanding(query: string): QueryUnderstanding {
  return {
    enabled: false,
    queries: [query],
    hypotheticalAnswer: null,
    trigger: null,
    strategy: null,
    reason: 'disabled',
    model: DEFAULT_REWRITE_CONFIG.model,
    inputTokens: 0,
    outputTokens: 0,
  };
}

/**
 * Maps the stage outcome onto the trace block. The hypothetical answer is
 * kept (bounded) rather than reduced to a flag, so a turn can be replayed.
 */
export function traceRewrite(
  understanding: QueryUnderstanding,
  original: string,
): RetrievalTraceRewrite {
  return {
    enabled: understanding.enabled,
    original,
    query: understanding.queries[0],
    variants: understanding.queries.slice(1),
    hypotheticalAnswer: understanding.hypotheticalAnswer
      ? understanding.hypotheticalAnswer.slice(0, MAX_TRACE_HYPOTHETICAL_CHARS)
      : null,
    trigger: understanding.trigger,
    strategy: understanding.strategy,
    reason: understanding.reason,
    model: understanding.model,
  };
}

/**
 * The query-understanding stage. It decides whether the message is worth
 * rewriting, asks the rewrite model within a latency budget, validates the
 * reply, and degrades to the deterministic heuristic. The pipeline records
 * the returned decision in the retrieval trace.
 */
@Injectable()
export class QueryUnderstandingService {
  private readonly logger = new Logger(QueryUnderstandingService.name);
  private readonly config: RetrievalRewriteConfig;

  constructor(
    @Optional()
    @Inject(RETRIEVAL_REWRITE_CONFIG)
    config?: RetrievalRewriteConfig,
    @Optional()
    @Inject(QUERY_REWRITER)
    private readonly rewriter?: QueryRewriter,
  ) {
    this.config = config ?? DEFAULT_REWRITE_CONFIG;
  }

  async understand(input: {
    message: string;
    history?: RetrievalHistoryTurn[];
  }): Promise<QueryUnderstanding> {
    const message = input.message.trim();
    const history = (input.history ?? [])
      .slice(-MAX_REWRITE_HISTORY_TURNS)
      .map((turn): RetrievalHistoryTurn => ({
        role: turn.role,
        content: turn.content
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, MAX_REWRITE_HISTORY_CHARS),
      }));
    const decision = decideRewrite(message, this.config);
    const base = {
      enabled: this.config.enabled,
      model: this.config.model,
      trigger: decision.trigger,
      inputTokens: 0,
      outputTokens: 0,
      hypotheticalAnswer: null,
    };

    if (!decision.shouldRewrite) {
      return {
        ...base,
        queries: [message],
        strategy: null,
        reason: decision.skipReason,
      };
    }

    const wantsHypothetical =
      this.config.hypotheticalAnswer && isAmbiguousQuery(message);
    // Paraphrases are for short or ambiguous questions, where a single query
    // string carries too little signal; a message that was rewritten for its
    // meta-instructions or its references already runs a usable query.
    const variantCount =
      this.config.multiQuery && decision.trigger === 'ambiguous'
        ? this.config.variantCount
        : 0;
    const request: QueryRewriteRequest = {
      message,
      history,
      variantCount,
      hypotheticalAnswer: wantsHypothetical,
    };

    if (this.rewriter) {
      const controller = new AbortController();
      try {
        const outcome = await withTimeout(
          this.rewriter.rewrite({ ...request, signal: controller.signal }),
          this.config.timeoutMs,
          () => controller.abort(),
        );
        // A rewrite that raced the deadline may settle after the abort; the
        // aborted signal is the authoritative timeout signal.
        if (controller.signal.aborted || outcome.timedOut) {
          this.logger.warn(
            `Rewrite exceeded its ${this.config.timeoutMs}ms budget; using the heuristic.`,
          );
          return this.heuristic(message, history, base, 'timeout');
        }
        if (outcome.result === null) {
          return this.heuristic(message, history, base, 'no_provider');
        }
        // The rewriter service validates its own model's reply, but the stage
        // owns the contract: a custom rewriter that returns a blank query
        // degrades instead of searching for nothing.
        const query = sanitizeRewriteQuery(outcome.result.query);
        if (!query) {
          this.logger.warn(
            'Rewrite returned an empty query; using the heuristic.',
          );
          return this.heuristic(message, history, base, 'failed');
        }
        // Only the paraphrases that were asked for are fused; a model that
        // volunteers variants for a message that did not need them is
        // ignored rather than trusted.
        const variants = sanitizeRewriteVariants(
          outcome.result.variants,
          query,
          variantCount,
        );
        return {
          ...base,
          queries: [query, ...variants],
          hypotheticalAnswer: outcome.result.hypotheticalAnswer,
          strategy: 'model',
          reason: null,
          inputTokens: outcome.result.inputTokens,
          outputTokens: outcome.result.outputTokens,
        };
      } catch (error) {
        if (controller.signal.aborted) {
          this.logger.warn(
            `Rewrite exceeded its ${this.config.timeoutMs}ms budget; using the heuristic.`,
          );
          return this.heuristic(message, history, base, 'timeout');
        }
        this.logger.warn(
          `Rewrite failed; using the heuristic: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return this.heuristic(message, history, base, 'failed');
      }
    }

    return this.heuristic(message, history, base, 'no_provider');
  }

  /** The degraded path: a deterministic rewrite, no model call. */
  private heuristic(
    message: string,
    history: RetrievalHistoryTurn[],
    base: Pick<
      QueryUnderstanding,
      | 'enabled'
      | 'model'
      | 'trigger'
      | 'inputTokens'
      | 'outputTokens'
      | 'hypotheticalAnswer'
    >,
    reason: 'no_provider' | 'timeout' | 'failed',
  ): QueryUnderstanding {
    const rewritten = buildHeuristicRewrite(message, history);
    return {
      ...base,
      queries: [rewritten],
      strategy: 'heuristic',
      reason,
    };
  }
}

/**
 * Races the rewrite against its latency budget. The timeout is observable in
 * the returned shape, so the caller records `timeout` rather than inferring it
 * from the aborted signal; `onTimeout` still aborts the underlying call.
 */
async function withTimeout(
  promise: Promise<QueryRewriteResult | null>,
  timeoutMs: number,
  onTimeout: () => void,
): Promise<{ timedOut: boolean; result: QueryRewriteResult | null }> {
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
