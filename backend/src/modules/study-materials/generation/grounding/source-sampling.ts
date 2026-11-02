import {
  estimateChunkTokens,
  stripChunkContentHeader,
} from '../../../ai/indexing/chunking.service';
import type { RetrievedChunk } from '../../../ai/retrieval/retrieval.service';
import { tokenize } from '../../../ai/retrieval/text-similarity';
import { MIN_SUBSTANTIVE_CHUNK_CHARS } from './budgets';
import type {
  GenerationGrounding,
  IndexedChunkRow,
  SourceMetaRow,
  SourceSection,
} from './grounding.types';
import { applyAdjacentOverlapStripping } from './overlap-trimming';
import { selectPerPass } from './pass-selection';

export { buildSourceSections };

function buildSourceSections(chunks: IndexedChunkRow[]): SourceSection[] {
  const byKey = new Map<string, SourceSection>();
  for (const chunk of chunks) {
    const key = chunk.headingPath.join(' > ');
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        headingPath: chunk.headingPath,
        minChunkIndex: chunk.chunkIndex,
        maxChunkIndex: chunk.chunkIndex,
        chunkCount: 1,
      });
    } else {
      existing.minChunkIndex = Math.min(
        existing.minChunkIndex,
        chunk.chunkIndex,
      );
      existing.maxChunkIndex = Math.max(
        existing.maxChunkIndex,
        chunk.chunkIndex,
      );
      existing.chunkCount += 1;
    }
  }
  return [...byKey.values()].sort((a, b) => a.minChunkIndex - b.minChunkIndex);
}

function informationDensityScore(
  chunk: IndexedChunkRow,
  isSectionLead: boolean,
): number {
  const body = stripChunkContentHeader(chunk.content).trim();
  if (!body) return 0;
  const tokens = estimateChunkTokens(body);
  const sizeCloseness = Math.max(0, 1 - Math.abs(tokens - 300) / 400);
  const wordList = tokenize(body);
  const uniqueRatio =
    wordList.length > 0 ? new Set(wordList).size / wordList.length : 0;
  const leadBonus =
    isSectionLead && body.length >= MIN_SUBSTANTIVE_CHUNK_CHARS ? 1.5 : 0;
  return leadBonus + sizeCloseness * 0.7 + uniqueRatio * 0.3;
}

function toRetrievedChunk(
  source: SourceMetaRow,
  row: IndexedChunkRow,
  score = 1,
): RetrievedChunk {
  return {
    chunkId: row.chunkId,
    chunkIndex: row.chunkIndex,
    sourceId: source.id,
    title: source.title,
    content: row.content,
    sectionPath: row.headingPath ?? [],
    score,
    url: source.url,
    kind: source.kind,
    sourceVersionId: row.sourceVersionId,
    locator: row.locator,
  };
}

export function sampleStratifiedSource(
  source: SourceMetaRow,
  substantiveChunks: IndexedChunkRow[],
  budget: number,
): { chunks: RetrievedChunk[]; promptChunks: RetrievedChunk[] } {
  if (substantiveChunks.length === 0 || budget <= 0) {
    return { chunks: [], promptChunks: [] };
  }

  const sectionGroups: IndexedChunkRow[][] = [];
  const sectionIndexByKey = new Map<string, number>();
  for (const chunk of substantiveChunks) {
    const key = chunk.headingPath.join(' > ');
    let idx = sectionIndexByKey.get(key);
    if (idx === undefined) {
      idx = sectionGroups.length;
      sectionIndexByKey.set(key, idx);
      sectionGroups.push([]);
    }
    sectionGroups[idx].push(chunk);
  }

  const strata: IndexedChunkRow[][] = [];

  if (sectionGroups.length <= 1) {
    const stratumCount = Math.min(substantiveChunks.length, budget);
    for (let k = 0; k < stratumCount; k++) {
      const start = Math.floor((k * substantiveChunks.length) / stratumCount);
      const end = Math.max(
        start + 1,
        Math.floor(((k + 1) * substantiveChunks.length) / stratumCount),
      );
      const slice = substantiveChunks.slice(start, end);
      const ranked = [...slice].sort(
        (a, b) =>
          informationDensityScore(b, false) -
            informationDensityScore(a, false) || a.chunkIndex - b.chunkIndex,
      );
      strata.push(ranked);
    }
  } else if (sectionGroups.length <= budget) {
    for (const group of sectionGroups) {
      const ranked = [...group].sort((a, b) => {
        const aLead = a.chunkId === group[0].chunkId;
        const bLead = b.chunkId === group[0].chunkId;
        return (
          informationDensityScore(b, bLead) -
            informationDensityScore(a, aLead) || a.chunkIndex - b.chunkIndex
        );
      });
      strata.push(ranked);
    }
  } else {
    const S = sectionGroups.length;
    const K = budget;
    for (let k = 0; k < K; k++) {
      const anchorIndex = K === 1 ? 0 : Math.round((k * (S - 1)) / (K - 1));
      const bucketStart = Math.floor((k * S) / K);
      const bucketEnd = Math.max(
        bucketStart + 1,
        Math.floor(((k + 1) * S) / K),
      );
      const orderedSectionIndices = [
        anchorIndex,
        ...Array.from(
          { length: bucketEnd - bucketStart },
          (_, i) => bucketStart + i,
        ).filter((idx) => idx !== anchorIndex),
      ];
      const candidates: IndexedChunkRow[] = [];
      for (const secIdx of orderedSectionIndices) {
        const group = sectionGroups[secIdx] ?? [];
        const ranked = [...group].sort((a, b) => {
          const aLead = a.chunkId === group[0]?.chunkId;
          const bLead = b.chunkId === group[0]?.chunkId;
          return (
            informationDensityScore(b, bLead) -
              informationDensityScore(a, aLead) || a.chunkIndex - b.chunkIndex
          );
        });
        candidates.push(...ranked);
      }
      strata.push(candidates);
    }
  }

  const strataAsRetrieved = strata.map((stratum) =>
    stratum.map((row) => toRetrievedChunk(source, row, 1)),
  );
  const passIndexes = strataAsRetrieved.map((_, index) => index);
  const promptChunks = selectPerPass(strataAsRetrieved, passIndexes, budget);
  return applyAdjacentOverlapStripping(promptChunks);
}

export function emptyGrounding(): GenerationGrounding {
  return {
    sources: [],
    evidence: [],
    unavailableSources: [],
    degradedSources: [],
    traces: [],
  };
}
