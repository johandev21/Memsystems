import { chunkBody } from './evidence-assembly';

export const MAX_CITATION_EXCERPT_LENGTH = 500;
export const MIN_CITATION_SPAN_LENGTH = 35;
export const MIN_CITATION_SPAN_WORDS = 5;
export const MAX_PASSAGE_CONTEXT_LENGTH = 1000;

export interface SupportingSpan {
  text: string;
  coverage: number;
}

export interface SentenceSegment {
  text: string;
  start: number;
  end: number;
}

export const CLAIM_STOP_WORDS = new Set([
  'and',
  'are',
  'because',
  'but',
  'for',
  'from',
  'has',
  'have',
  'into',
  'its',
  'not',
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
  'was',
  'were',
  'which',
  'will',
  'with',
  'would',
  'you',
  'your',
]);

export function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}]+/gu) ?? []).length;
}

export function isAdequateSpan(text: string): boolean {
  return (
    text.trim().length >= MIN_CITATION_SPAN_LENGTH &&
    countWords(text) >= MIN_CITATION_SPAN_WORDS
  );
}

export function capSpan(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_CITATION_EXCERPT_LENGTH) return trimmed;
  const shortened = trimmed.slice(0, MAX_CITATION_EXCERPT_LENGTH);
  const boundary = Math.max(
    shortened.lastIndexOf(' '),
    shortened.lastIndexOf('\n'),
  );
  return boundary > 0 ? shortened.slice(0, boundary) : shortened;
}

export function findFallbackSpan(
  body: string,
  sentences: SentenceSegment[],
): string {
  if (sentences.length === 0) return capSpan(body);
  const firstSentence = body.slice(sentences[0].start, sentences[0].end).trim();
  if (isAdequateSpan(firstSentence)) return capSpan(firstSentence);

  let end = sentences[0].end;
  for (let i = 1; i < sentences.length; i++) {
    end = sentences[i].end;
    const combined = body.slice(sentences[0].start, end).trim();
    if (isAdequateSpan(combined)) return capSpan(combined);
  }
  return capSpan(body.slice(sentences[0].start, end));
}

export function contentTerms(text: string): Set<string> {
  const terms = new Set<string>();
  for (const token of text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) {
    if (token.length < 3 || CLAIM_STOP_WORDS.has(token)) continue;
    terms.add(token);
  }
  return terms;
}

export function coverageOf(
  claimTerms: Set<string>,
  spanTokens: Set<string>,
): number {
  if (claimTerms.size === 0) return 0;
  let hit = 0;
  for (const term of claimTerms) {
    if (spanTokens.has(term)) hit++;
  }
  return hit / claimTerms.size;
}

export function fencedRanges(text: string): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const open = text.indexOf('```', cursor);
    if (open === -1) break;
    const close = text.indexOf('```', open + 3);
    const end = close === -1 ? text.length : close + 3;
    ranges.push({ start: open, end });
    cursor = end;
  }
  return ranges;
}

export function sentenceSegments(text: string): SentenceSegment[] {
  const fenced = fencedRanges(text);
  const segments: SentenceSegment[] = [];
  let start = 0;

  const push = (end: number) => {
    const raw = text.slice(start, end);
    const leading = raw.length - raw.trimStart().length;
    const segmentStart = start + leading;
    const segment = raw.trim();
    if (segment) {
      segments.push({
        text: segment,
        start: segmentStart,
        end: segmentStart + segment.length,
      });
    }
    start = end;
  };

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '\n') {
      push(index);
      start = index + 1;
      continue;
    }
    if (char !== '.' && char !== '!' && char !== '?') continue;
    let end = index + 1;
    while (end < text.length && '.!?'.includes(text[end])) end++;
    if (end < text.length && !/\s/.test(text[end])) continue;
    push(end);
    start = end;
    index = end - 1;
  }
  push(text.length);

  return segments.filter(
    (segment) =>
      !fenced.some(
        (range) => segment.start < range.end && segment.end > range.start,
      ),
  );
}

export function selectSupportingSpan(
  content: string,
  claim: string,
): SupportingSpan {
  const body = chunkBody(content);
  const claimTerms = contentTerms(claim);
  const sentences = sentenceSegments(body);

  if (sentences.length === 0) return { text: '', coverage: 0 };
  if (claimTerms.size === 0) {
    return { text: findFallbackSpan(body, sentences), coverage: 0 };
  }

  const windows: { start: number; end: number }[] = sentences.map((s) => ({
    start: s.start,
    end: s.end,
  }));
  for (let i = 0; i + 1 < sentences.length; i++) {
    windows.push({ start: sentences[i].start, end: sentences[i + 1].end });
  }

  let best: {
    start: number;
    end: number;
    coverage: number;
    adequate: boolean;
  } | null = null;

  for (const window of windows) {
    const spanText = body.slice(window.start, window.end);
    const tokens = new Set(
      spanText.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [],
    );
    const coverage = coverageOf(claimTerms, tokens);
    if (coverage === 0) continue;
    const adequate = isAdequateSpan(spanText);

    const isBetter =
      !best ||
      coverage > best.coverage ||
      (coverage === best.coverage &&
        ((adequate && !best.adequate) ||
          (adequate === best.adequate &&
            (window.end - window.start < best.end - best.start ||
              (window.end - window.start === best.end - best.start &&
                window.start < best.start)))));
    if (isBetter) best = { ...window, coverage, adequate };
  }

  if (!best || best.coverage === 0) {
    return { text: findFallbackSpan(body, sentences), coverage: 0 };
  }

  let chosenStart = best.start;
  let chosenEnd = best.end;

  if (!best.adequate) {
    const candidate2Sentence = windows.find(
      (w) =>
        w.start <= best.start &&
        w.end >= best.end &&
        w.end - w.start > best.end - best.start &&
        isAdequateSpan(body.slice(w.start, w.end)),
    );
    if (candidate2Sentence) {
      chosenStart = candidate2Sentence.start;
      chosenEnd = candidate2Sentence.end;
    } else {
      return {
        text: findFallbackSpan(body, sentences),
        coverage: best.coverage,
      };
    }
  }

  return {
    text: capSpan(body.slice(chosenStart, chosenEnd)),
    coverage: best.coverage,
  };
}

export function capSpanToLength(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const shortened = text.slice(0, maxLength);
  const boundary = Math.max(
    shortened.lastIndexOf(' '),
    shortened.lastIndexOf('\n'),
  );
  return boundary > 0 ? shortened.slice(0, boundary).trim() : shortened.trim();
}

export function extractPassageContext(
  content: string,
  spanText: string | null,
): string {
  const body = chunkBody(content).trim();
  if (body.length <= MAX_PASSAGE_CONTEXT_LENGTH) return body;
  if (!spanText || !spanText.trim()) {
    return capSpanToLength(body, MAX_PASSAGE_CONTEXT_LENGTH);
  }

  const cleanSpan = spanText.trim();
  const spanIndex = body.indexOf(cleanSpan);
  if (spanIndex === -1)
    return capSpanToLength(body, MAX_PASSAGE_CONTEXT_LENGTH);

  const spanLength = cleanSpan.length;
  if (spanLength >= MAX_PASSAGE_CONTEXT_LENGTH) {
    return cleanSpan.slice(0, MAX_PASSAGE_CONTEXT_LENGTH);
  }

  const remainingBudget = MAX_PASSAGE_CONTEXT_LENGTH - spanLength;
  const targetBefore = Math.floor(remainingBudget / 2);
  let start = Math.max(0, spanIndex - targetBefore);
  let end = Math.min(body.length, start + MAX_PASSAGE_CONTEXT_LENGTH);

  if (end === body.length)
    start = Math.max(0, end - MAX_PASSAGE_CONTEXT_LENGTH);

  if (start > 0) {
    const nextSpace = body.indexOf(' ', start);
    if (nextSpace !== -1 && nextSpace < spanIndex) start = nextSpace + 1;
  }
  if (end < body.length) {
    const prevSpace = body.lastIndexOf(' ', end);
    if (prevSpace > spanIndex + spanLength) end = prevSpace;
  }

  return body.slice(start, end).trim();
}
