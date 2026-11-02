import type { RetrievedChunk } from '../ai/retrieval/retrieval.service';
import { chunkBody } from '../ai/retrieval/evidence-assembly';
import {
  type CitationEvidence,
  type CitedSourceEntry,
  normalizeCitationLocator,
  sanitizeReferenceUrl,
} from '../ai/retrieval/citation-verification';

export * from '../ai/retrieval/citation-verification';

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
      sectionPath: null,
      context: null,
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
    sectionPath: Array.isArray(entry.sectionPath)
      ? entry.sectionPath.filter((p): p is string => typeof p === 'string')
      : null,
    context: typeof entry.context === 'string' ? entry.context : null,
  };
}

export interface CitedSourceDisplayMeta {
  title?: string | null;
  kind?: string | null;
  url?: string | null;
}

export function mapCitedSourcesForDisplay(
  entries: (CitedSourceEntry | StoredCitedSourceEntry)[],
  citedMetaMap: Map<string, CitedSourceDisplayMeta>,
) {
  return entries
    .map((entry, index) =>
      typeof entry === 'string' || !('schemaVersion' in entry)
        ? normalizeStoredCitation(entry, index)
        : entry,
    )
    .map((entry) => {
      const meta = citedMetaMap.get(entry.sourceId);
      return {
        id: entry.sourceId,
        schemaVersion: entry.schemaVersion,
        citationKey: entry.citationKey,
        chunkId: entry.chunkId,
        chunkIndex: entry.chunkIndex,
        sourceVersionId: entry.sourceVersionId,
        locator: entry.locator,
        number: entry.number,
        title: entry.title ?? meta?.title ?? 'Unavailable reference',
        kind: entry.kind ?? meta?.kind ?? 'unknown',
        url: entry.url ?? meta?.url ?? null,
        description: entry.description,
        quote: entry.quote,
        isAvailable: !!meta,
        sectionPath: entry.sectionPath ?? null,
        context: entry.context ?? null,
      };
    });
}
