import type { CitationLocator, RetrievedChunk } from '../ai/retrieval.service';
import { chunkBody } from '../ai/evidence-assembly';

export { type CitationLocator } from '../ai/retrieval.service';

export const CITATION_SCHEMA_VERSION = 2;
export const MAX_CITATION_EXCERPT_LENGTH = 500;

/** Content words a reply segment needs before it can be a claim. */
const MIN_CLAIM_WORDS = 4;

/** Share of a claim's content words a passage must cover to be its evidence. */
const ATTRIBUTION_MIN_COVERAGE = 0.5;

/** How far the best passage must lead the runner-up to be trusted. */
const ATTRIBUTION_MARGIN = 0.1;

/**
 * How a citation was attached to the reply: the model emitted its key at the
 * end of a claim sentence, or the verifier attributed an unmarked claim to
 * the nearest Evidence passage.
 */
export type CitationAttribution = 'explicit' | 'nearest';

export interface CitationEvidence extends RetrievedChunk {
  citationKey: string;
  rank: number;
}

export interface CitedSourceEntry {
  schemaVersion: number;
  citationKey: string;
  sourceId: string;
  chunkId: string | null;
  chunkIndex: number | null;
  sourceVersionId: string | null;
  locator: CitationLocator | null;
  number: number;
  title: string | null;
  kind: string | null;
  url: string | null;
  description: string | null;
  /** The supporting span, not the whole chunk. */
  quote: string | null;
  /** Explicit marker or nearest-Evidence attribution. */
  attribution: CitationAttribution;
}

export type StoredCitedSourceEntry =
  | string
  | (Partial<CitedSourceEntry> & {
      sourceId: string;
      number?: number;
      quote?: string | null;
    });

export function createCitationEvidence(
  chunks: RetrievedChunk[],
): CitationEvidence[] {
  return chunks.map((chunk, index) => ({
    ...chunk,
    citationKey: `R${index + 1}`,
    rank: index + 1,
  }));
}

/**
 * The Evidence block the model reads. It carries the document title, the
 * section context assembly selected, and the passage body; the retrieval
 * score is deliberately absent, because the model cannot act on it and tends
 * to narrate it.
 */
export function formatCitationContext(evidence: CitationEvidence[]): string {
  return evidence
    .map((item) => {
      const lines = [
        `[Evidence ${item.citationKey}]`,
        `Source: "${item.title}"`,
      ];
      const sectionPath = item.sectionPath ?? [];
      if (sectionPath.length > 0) {
        lines.push(`Section: ${sectionPath.join(' > ')}`);
      }
      lines.push('Passage:', chunkBody(item.content));
      return lines.join('\n');
    })
    .join('\n\n---\n\n');
}

/** The outcome of the post-generation citation check. */
export interface CitationVerification {
  /** Verified entries in first-appearance order. */
  entries: CitedSourceEntry[];
  /** Keys the reply emitted that no retrieved chunk matched, deduped. */
  droppedKeys: string[];
  /**
   * Unmarked claims matched to a retrieved chunk. A claim whose passage is
   * already cited explicitly still counts; its entry is deduplicated.
   */
  attributedClaims: number;
}

/**
 * Verifies the citations of one reply against the Evidence it was given:
 * every emitted key must map to a retrieved chunk, every entry stores the
 * supporting span for its claim, and an unmarked claim is attributed to the
 * nearest Evidence passage when one clearly supports it. Unresolvable
 * references are dropped from the entries (the reply text itself is streamed
 * and only rendered through keys that resolve).
 *
 * A marker that trails its sentence ("The pressure depends on the gradient.
 * [ref:R1]") belongs to that sentence, not to the next one, so an explicit
 * citation always claims the text before it and only falls back to the
 * previous sentence when the marker opens a segment.
 */
export function verifyCitations(
  text: string,
  evidence: CitationEvidence[],
  options: { attribution?: boolean } = {},
): CitationVerification {
  const attribution = options.attribution ?? true;
  const evidenceByKey = new Map(
    evidence.map((item) => [item.citationKey.toUpperCase(), item]),
  );
  const droppedKeys = new Set<string>();
  const candidates: CitationCandidate[] = [];
  let order = 0;
  let previousClaim = '';

  const segments = sentenceSegments(text);
  for (const segment of segments) {
    const segmentClaim = claimSentence(segment.text);
    for (const marker of markerOccurrences(segment.text)) {
      const item = evidenceByKey.get(marker.key);
      if (!item) {
        droppedKeys.add(marker.key);
        continue;
      }
      candidates.push({
        position: segment.start + marker.index,
        order: order++,
        citationKey: marker.key,
        item,
        claim:
          claimSentence(segment.text.slice(0, marker.index)) || previousClaim,
        attribution: 'explicit',
      });
    }
    previousClaim = segmentClaim || previousClaim;
  }

  let attributedClaims = 0;
  if (attribution) {
    for (const segment of segments) {
      // A segment the model marked is its own claim; only a marker that
      // resolves suppresses attribution, so a bogus marker does not hide the
      // sentence it was attached to.
      const resolvedMarker = markerOccurrences(segment.text).some((marker) =>
        evidenceByKey.has(marker.key),
      );
      if (resolvedMarker) continue;
      const claim = claimSentence(segment.text);
      if (!isClaim(claim)) continue;
      const match = nearestEvidence(claim, evidence);
      if (!match) continue;
      // The claim is grounded to the matched passage; when that passage is
      // already cited, the entry itself is deduplicated below, but the claim
      // still counts as attributed.
      candidates.push({
        position: segment.start,
        order: order++,
        citationKey: match.item.citationKey.toUpperCase(),
        item: match.item,
        claim,
        attribution: 'nearest',
      });
      attributedClaims++;
    }
  }

  // One entry per passage. When a claim is attributed before the model's own
  // explicit marker for the same passage appears, the explicit marker wins:
  // it is the model's own grounding, and the entry should carry the claim the
  // marker actually supports.
  const byKey = new Map<string, CitationCandidate>();
  for (const candidate of candidates) {
    const existing = byKey.get(candidate.citationKey);
    if (!existing) {
      byKey.set(candidate.citationKey, candidate);
      continue;
    }
    if (
      existing.attribution === 'nearest' &&
      candidate.attribution === 'explicit'
    ) {
      byKey.set(candidate.citationKey, candidate);
    }
  }

  const entries: CitedSourceEntry[] = [...byKey.values()]
    .sort((a, b) => a.position - b.position || a.order - b.order)
    .map((candidate, index) =>
      entryFromEvidence(
        candidate.item,
        candidate.claim,
        index + 1,
        candidate.attribution,
      ),
    );

  return { entries, droppedKeys: [...droppedKeys], attributedClaims };
}

interface CitationCandidate {
  position: number;
  order: number;
  citationKey: string;
  item: CitationEvidence;
  claim: string;
  attribution: CitationAttribution;
}

/** Compatibility wrapper: the verified entries of one reply. */
export function extractCitationEntries(
  text: string,
  evidence: CitationEvidence[],
): CitedSourceEntry[] {
  return verifyCitations(text, evidence).entries;
}

/** A supporting span of a chunk: the text a citation points at. */
export interface SupportingSpan {
  /** The span text, whitespace-normalized and capped for display. */
  text: string;
  /** Share of the claim's content words the span covers, in [0, 1]. */
  coverage: number;
}

/**
 * Selects the span of `content` that best supports `claim`. Spans are one
 * sentence or two adjacent ones; the best coverage wins, ties go to the
 * shorter and then the earlier span, so the result is deterministic. A claim
 * with no content words falls back to the start of the chunk.
 */
export function selectSupportingSpan(
  content: string,
  claim: string,
): SupportingSpan {
  const body = chunkBody(content);
  const claimTerms = contentTerms(claim);
  const sentences = sentenceSegments(body);

  if (sentences.length === 0) {
    return { text: '', coverage: 0 };
  }

  if (claimTerms.size === 0) {
    return {
      text: capSpan(body.slice(sentences[0].start, sentences[0].end)),
      coverage: 0,
    };
  }

  const windows: { start: number; end: number }[] = sentences.map(
    (sentence) => ({ start: sentence.start, end: sentence.end }),
  );
  for (let index = 0; index + 1 < sentences.length; index++) {
    windows.push({
      start: sentences[index].start,
      end: sentences[index + 1].end,
    });
  }

  let best: { start: number; end: number; coverage: number } | null = null;
  for (const window of windows) {
    const tokens = new Set(
      body
        .slice(window.start, window.end)
        .toLowerCase()
        .match(/[\p{L}\p{N}]+/gu) ?? [],
    );
    const coverage = coverageOf(claimTerms, tokens);
    if (
      !best ||
      coverage > best.coverage ||
      (coverage === best.coverage &&
        window.end - window.start < best.end - best.start) ||
      (coverage === best.coverage &&
        window.end - window.start === best.end - best.start &&
        window.start < best.start)
    ) {
      best = { ...window, coverage };
    }
  }

  const chosen = best ?? { start: 0, end: body.length, coverage: 0 };
  return {
    text: capSpan(body.slice(chosen.start, chosen.end)),
    coverage: chosen.coverage,
  };
}

/** One sentence or line of a text, with its offsets in that text. */
interface SentenceSegment {
  text: string;
  start: number;
  end: number;
}

/**
 * Splits a reply into claim-sized segments: sentence terminators and line
 * breaks end a segment, and fenced code blocks are skipped so code samples
 * are never attributed to a Source.
 */
function sentenceSegments(text: string): SentenceSegment[] {
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

function fencedRanges(text: string): { start: number; end: number }[] {
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

/** The claim sentence of a segment, without the markers it carries. */
function claimSentence(text: string): string {
  return text.replace(CITATION_PATTERN, ' ').replace(/\s+/g, ' ').trim();
}

interface MarkerOccurrence {
  key: string;
  index: number;
}

/** The marker occurrences of a segment, in text order. */
function markerOccurrences(text: string): MarkerOccurrence[] {
  const occurrences: MarkerOccurrence[] = [];
  for (const match of text.matchAll(CITATION_PATTERN)) {
    const rawKey = match[1] ?? match[3];
    if (rawKey) {
      occurrences.push({ key: rawKey.toUpperCase(), index: match.index ?? 0 });
    }
  }
  return occurrences;
}

/** A sentence worth attributing: long enough and not a question. */
function isClaim(text: string): boolean {
  const sentence = claimSentence(text);
  if (sentence.endsWith('?')) return false;
  return contentTerms(sentence).size >= MIN_CLAIM_WORDS;
}

/**
 * The Evidence passage whose best span covers the claim most completely, if
 * it clears the coverage floor and is clearly ahead of the runner-up.
 */
function nearestEvidence(
  claim: string,
  evidence: CitationEvidence[],
): { item: CitationEvidence; coverage: number } | null {
  let best: { item: CitationEvidence; coverage: number } | null = null;
  let runnerUp = 0;

  for (const item of evidence) {
    const coverage = selectSupportingSpan(item.content, claim).coverage;
    if (!best || coverage > best.coverage) {
      runnerUp = best?.coverage ?? 0;
      best = { item, coverage };
    } else if (coverage > runnerUp) {
      runnerUp = coverage;
    }
  }

  if (!best || best.coverage < ATTRIBUTION_MIN_COVERAGE) return null;
  if (best.coverage - runnerUp < ATTRIBUTION_MARGIN) return null;
  return best;
}

function entryFromEvidence(
  item: CitationEvidence,
  claim: string,
  number: number,
  attribution: CitationAttribution,
): CitedSourceEntry {
  const span = selectSupportingSpan(item.content, claim);
  return {
    schemaVersion: CITATION_SCHEMA_VERSION,
    citationKey: item.citationKey,
    sourceId: item.sourceId,
    chunkId: item.chunkId,
    chunkIndex: item.chunkIndex,
    sourceVersionId: item.sourceVersionId ?? null,
    locator: normalizeCitationLocator(item.locator),
    number,
    title: item.title,
    kind: item.kind,
    url: sanitizeReferenceUrl(item.url),
    description: null,
    quote: span.text || null,
    attribution,
  };
}

/** The marker shapes the model emits, optionally wrapped in backticks. */
const CITATION_PATTERN =
  /`?\[ref:([a-zA-Z0-9_-]+)\]`?|`?\[(\d+)\]\(#reference-([a-zA-Z0-9_-]+)\)`?/gi;

/** Short or ubiquitous words carry no attribution signal. */
const CLAIM_STOP_WORDS = new Set([
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

/** Content words of a claim or span: word tokens with the stop words out. */
function contentTerms(text: string): Set<string> {
  const terms = new Set<string>();
  for (const token of text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) {
    if (token.length < 3 || CLAIM_STOP_WORDS.has(token)) continue;
    terms.add(token);
  }
  return terms;
}

function coverageOf(claimTerms: Set<string>, spanTokens: Set<string>): number {
  if (claimTerms.size === 0) return 0;
  let hit = 0;
  for (const term of claimTerms) {
    if (spanTokens.has(term)) hit++;
  }
  return hit / claimTerms.size;
}

/** Caps a span at the excerpt limit without cutting a word in half. */
function capSpan(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= MAX_CITATION_EXCERPT_LENGTH) return normalized;
  const shortened = normalized.slice(0, MAX_CITATION_EXCERPT_LENGTH - 1);
  const lastWordBoundary = shortened.lastIndexOf(' ');
  const excerpt =
    lastWordBoundary > 0 ? shortened.slice(0, lastWordBoundary) : shortened;
  return `${excerpt.trimEnd()}...`;
}

export function normalizeStoredCitation(
  entry: StoredCitedSourceEntry,
  index: number,
): CitedSourceEntry {
  if (typeof entry === 'string') {
    return {
      schemaVersion: 0,
      citationKey: `legacy-${index + 1}`,
      sourceId: entry,
      chunkId: null,
      chunkIndex: null,
      sourceVersionId: null,
      locator: null,
      number: index + 1,
      title: null,
      kind: null,
      url: null,
      description: null,
      quote: null,
      attribution: 'explicit',
    };
  }

  return {
    schemaVersion: entry.schemaVersion ?? 0,
    citationKey: entry.citationKey ?? `legacy-${index + 1}`,
    sourceId: entry.sourceId,
    chunkId: entry.chunkId ?? null,
    chunkIndex: entry.chunkIndex ?? null,
    sourceVersionId: entry.sourceVersionId ?? null,
    locator: normalizeCitationLocator(entry.locator),
    number: entry.number && entry.number > 0 ? entry.number : index + 1,
    title: entry.title ?? null,
    kind: entry.kind ?? null,
    url: sanitizeReferenceUrl(entry.url ?? null),
    description: entry.description ?? null,
    quote: entry.quote ?? null,
    attribution: entry.attribution ?? 'explicit',
  };
}

export function sanitizeReferenceUrl(url: string | null): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

/** Keep only the location fields understood by the citation contract. */
export function normalizeCitationLocator(
  locator: unknown,
): CitationLocator | null {
  if (!locator || typeof locator !== 'object' || Array.isArray(locator)) {
    return null;
  }

  const value = locator as Record<string, unknown>;
  const normalized: CitationLocator = {};
  const numericFields = [
    'pageNumber',
    'slideNumber',
    'startOffsetMs',
    'endOffsetMs',
    'lineStart',
    'lineEnd',
  ] as const;

  for (const field of numericFields) {
    const fieldValue = value[field];
    if (typeof fieldValue === 'number' && Number.isFinite(fieldValue)) {
      normalized[field] = fieldValue;
    }
  }

  for (const field of [
    'speaker',
    'sheetName',
    'cellRange',
    'symbol',
  ] as const) {
    const fieldValue = value[field];
    if (typeof fieldValue === 'string' && fieldValue.trim()) {
      normalized[field] = fieldValue;
    }
  }

  const imageRegion = value.imageRegion;
  if (
    imageRegion &&
    typeof imageRegion === 'object' &&
    !Array.isArray(imageRegion)
  ) {
    const region = imageRegion as Record<string, unknown>;
    const coordinates = ['x', 'y', 'width', 'height'] as const;
    if (
      coordinates.every(
        (field) =>
          typeof region[field] === 'number' && Number.isFinite(region[field]),
      )
    ) {
      normalized.imageRegion = {
        x: region.x as number,
        y: region.y as number,
        width: region.width as number,
        height: region.height as number,
      };
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}
