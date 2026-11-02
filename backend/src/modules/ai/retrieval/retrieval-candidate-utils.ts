import { jaccardSimilarity, textSignature } from './text-similarity';
import type { RetrievalChunkRow } from './retrieval.types';
import type { FusedCandidate } from './rank-fusion';

const NEAR_DUPLICATE_SIMILARITY = 0.9;

export function mapRerankScores(
  candidates: { index: number; relevanceScore: number }[],
  count: number,
): number[] | null {
  if (candidates.length !== count) return null;
  const scores = new Array<number | undefined>(count).fill(undefined);
  for (const candidate of candidates) {
    if (
      !Number.isInteger(candidate.index) ||
      candidate.index < 0 ||
      candidate.index >= count ||
      !Number.isFinite(candidate.relevanceScore) ||
      scores[candidate.index] !== undefined
    ) {
      return null;
    }
    scores[candidate.index] = candidate.relevanceScore;
  }
  return scores as number[];
}

export function dedupeNearDuplicates(
  candidates: FusedCandidate<RetrievalChunkRow>[],
): FusedCandidate<RetrievalChunkRow>[] {
  const kept: {
    candidate: FusedCandidate<RetrievalChunkRow>;
    tokens: Set<string>;
  }[] = [];
  for (const candidate of candidates) {
    const tokens = textSignature(candidate.candidate.content).tokens;
    const duplicate = kept.some(
      (entry) =>
        jaccardSimilarity(entry.tokens, tokens) >= NEAR_DUPLICATE_SIMILARITY,
    );
    if (!duplicate) kept.push({ candidate, tokens });
  }
  return kept.map((entry) => entry.candidate);
}
