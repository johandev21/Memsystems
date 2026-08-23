import type { RetrievedChunk } from '../ai/retrieval.service';

export const CITATION_SCHEMA_VERSION = 1;
export const MAX_CITATION_EXCERPT_LENGTH = 500;

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
  number: number;
  title: string | null;
  kind: string | null;
  url: string | null;
  description: string | null;
  quote: string | null;
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

export function formatCitationContext(evidence: CitationEvidence[]): string {
  return evidence
    .map(
      (item) =>
        `[Evidence ${item.citationKey}]\nSource: "${item.title}"\nRelevance: ${item.score.toFixed(2)}\nPassage:\n${item.content}`,
    )
    .join('\n\n---\n\n');
}

export function extractCitationEntries(
  text: string,
  evidence: CitationEvidence[],
): CitedSourceEntry[] {
  const evidenceByKey = new Map(
    evidence.map((item) => [item.citationKey.toUpperCase(), item]),
  );
  const seenKeys = new Set<string>();
  const entries: CitedSourceEntry[] = [];

  for (const match of text.matchAll(/\[ref:([a-zA-Z0-9_-]+)\]/g)) {
    const citationKey = match[1].toUpperCase();
    if (seenKeys.has(citationKey)) continue;

    const item = evidenceByKey.get(citationKey);
    if (!item) continue;

    seenKeys.add(citationKey);
    entries.push({
      schemaVersion: CITATION_SCHEMA_VERSION,
      citationKey: item.citationKey,
      sourceId: item.sourceId,
      chunkId: item.chunkId,
      chunkIndex: item.chunkIndex,
      number: entries.length + 1,
      title: item.title,
      kind: item.kind,
      url: sanitizeReferenceUrl(item.url),
      description: null,
      quote: normalizeExcerpt(item.content),
    });
  }

  return entries;
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
      number: index + 1,
      title: null,
      kind: null,
      url: null,
      description: null,
      quote: null,
    };
  }

  return {
    schemaVersion: entry.schemaVersion ?? 0,
    citationKey: entry.citationKey ?? `legacy-${index + 1}`,
    sourceId: entry.sourceId,
    chunkId: entry.chunkId ?? null,
    chunkIndex: entry.chunkIndex ?? null,
    number: entry.number && entry.number > 0 ? entry.number : index + 1,
    title: entry.title ?? null,
    kind: entry.kind ?? null,
    url: sanitizeReferenceUrl(entry.url ?? null),
    description: entry.description ?? null,
    quote: entry.quote ?? null,
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

function normalizeExcerpt(content: string): string | null {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  if (normalized.length <= MAX_CITATION_EXCERPT_LENGTH) return normalized;

  const shortened = normalized.slice(0, MAX_CITATION_EXCERPT_LENGTH - 1);
  const lastWordBoundary = shortened.lastIndexOf(' ');
  const excerpt =
    lastWordBoundary > 0 ? shortened.slice(0, lastWordBoundary) : shortened;
  return `${excerpt.trimEnd()}...`;
}
