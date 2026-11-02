import type { CitationLocator, RetrievedChunk } from './retrieval.service';
import {
  extractPassageContext,
  selectSupportingSpan,
  sentenceSegments,
  contentTerms,
} from './citation-spans';

export { type CitationLocator } from './retrieval.service';
export * from './citation-spans';

export const CITATION_SCHEMA_VERSION = 3;

export const MIN_CLAIM_WORDS = 4;
export const ATTRIBUTION_MIN_COVERAGE = 0.5;
export const ATTRIBUTION_MARGIN = 0.1;

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
  quote: string | null;
  attribution: CitationAttribution;
  sectionPath?: string[] | null;
  context?: string | null;
}

export interface CitationVerification {
  entries: CitedSourceEntry[];
  droppedKeys: string[];
  attributedClaims: number;
}

export interface CitationCandidate {
  position: number;
  order: number;
  citationKey: string;
  item: CitationEvidence;
  claim: string;
  attribution: CitationAttribution;
}

export interface MarkerOccurrence {
  key: string;
  index: number;
}

export const CITATION_PATTERN =
  /`?\[ref:([a-zA-Z0-9_-]+)\]`?|`?\[(\d+)\]\(#reference-([a-zA-Z0-9_-]+)\)`?/gi;

export function claimSentence(text: string): string {
  return text.replace(CITATION_PATTERN, ' ').replace(/\s+/g, ' ').trim();
}

export function markerOccurrences(text: string): MarkerOccurrence[] {
  const occurrences: MarkerOccurrence[] = [];
  for (const match of text.matchAll(CITATION_PATTERN)) {
    const rawKey = match[1] ?? match[3];
    if (rawKey) {
      occurrences.push({ key: rawKey.toUpperCase(), index: match.index ?? 0 });
    }
  }
  return occurrences;
}

export function isClaim(text: string): boolean {
  const sentence = claimSentence(text);
  if (sentence.endsWith('?')) return false;
  return contentTerms(sentence).size >= MIN_CLAIM_WORDS;
}

export function nearestEvidence(
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

export function attachScrollToTextFragment(
  url: string | null,
  quote: string | null,
  kind: string | null,
): string | null {
  if (!url || !quote || !quote.trim()) return url;
  if (kind === 'pdf' || url.toLowerCase().split('?')[0].endsWith('.pdf'))
    return url;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return url;
  } catch {
    return url;
  }

  if (url.includes(':~:text=')) return url;

  const cleanQuote = quote.trim().replace(/\s+/g, ' ');
  const words = cleanQuote.split(' ');
  const directive =
    words.length > 8
      ? `text=${encodeURIComponent(words.slice(0, 4).join(' '))},${encodeURIComponent(words.slice(-4).join(' '))}`
      : `text=${encodeURIComponent(cleanQuote)}`;

  return url.includes('#') ? `${url}:~:${directive}` : `${url}#:~:${directive}`;
}

export function normalizeCitationLocator(
  locator: unknown,
): CitationLocator | null {
  if (!locator || typeof locator !== 'object' || Array.isArray(locator))
    return null;

  const value = locator as Record<string, unknown>;
  const normalized: CitationLocator = {};

  for (const field of [
    'pageNumber',
    'slideNumber',
    'startOffsetMs',
    'endOffsetMs',
    'lineStart',
    'lineEnd',
  ] as const) {
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
    const coords = ['x', 'y', 'width', 'height'] as const;
    if (
      coords.every(
        (f) => typeof region[f] === 'number' && Number.isFinite(region[f]),
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

export function entryFromEvidence(
  item: CitationEvidence,
  claim: string,
  number: number,
  attribution: CitationAttribution,
): CitedSourceEntry {
  const span = selectSupportingSpan(item.content, claim);
  const quote = span.text || null;
  const context = extractPassageContext(item.content, quote);
  const sectionPath =
    item.sectionPath && item.sectionPath.length > 0 ? item.sectionPath : null;
  const rawUrl = sanitizeReferenceUrl(item.url);
  const url = attachScrollToTextFragment(rawUrl, quote, item.kind);

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
    url,
    description: null,
    quote,
    attribution,
    sectionPath,
    context,
  };
}

export function verifyCitations(
  text: string,
  evidence: CitationEvidence[],
  options: { attribution?: boolean } = {},
): CitationVerification {
  const attribution = options.attribution ?? false;
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
      const resolvedMarker = markerOccurrences(segment.text).some((marker) =>
        evidenceByKey.has(marker.key),
      );
      if (resolvedMarker) continue;
      const claim = claimSentence(segment.text);
      if (!isClaim(claim)) continue;
      const match = nearestEvidence(claim, evidence);
      if (!match) continue;
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

export function extractCitationEntries(
  text: string,
  evidence: CitationEvidence[],
): CitedSourceEntry[] {
  return verifyCitations(text, evidence).entries;
}
