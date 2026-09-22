/**
 * Reciprocal Rank Fusion (Cormack, Clarke & Buettcher, 2009).
 *
 * Hybrid retrieval runs the dense and lexical legs as separate candidate
 * lists whose scores live on different scales: a cosine similarity and a
 * `ts_rank_cd` value are not comparable. RRF only uses the rank each leg gave
 * a candidate, contributing `weight / (k + rank)` and summing across legs, so
 * the fused order needs no score normalization and a candidate that both legs
 * rank highly rises to the top.
 */

/** One ranked candidate list taking part in the fusion. */
export interface FusionLeg<T> {
  /**
   * The leg's contribution multiplier. A weight of zero (or less) removes
   * the leg from the fusion entirely.
   */
  weight: number;
  /** Candidates in the leg's own order, best first. */
  candidates: T[];
}

export interface FusedCandidate<T> {
  candidate: T;
  /** The summed Reciprocal Rank Fusion score. */
  score: number;
  /** The best (lowest) rank the candidate reached, used to break ties. */
  bestRank: number;
}

/**
 * Fuses the legs into one ranked list. Ties are broken by the best rank in
 * any leg and then by first appearance, so the order is deterministic for a
 * given set of legs.
 */
export function reciprocalRankFusion<T>(
  legs: FusionLeg<T>[],
  idOf: (candidate: T) => string,
  smoothing: number,
): FusedCandidate<T>[] {
  const byId = new Map<
    string,
    { candidate: T; score: number; bestRank: number; order: number }
  >();
  let insertion = 0;

  for (const leg of legs) {
    if (leg.weight <= 0) continue;
    leg.candidates.forEach((candidate, index) => {
      const rank = index + 1;
      const contribution = leg.weight / (smoothing + rank);
      const id = idOf(candidate);
      const existing = byId.get(id);
      if (!existing) {
        byId.set(id, {
          candidate,
          score: contribution,
          bestRank: rank,
          order: insertion++,
        });
        return;
      }
      existing.score += contribution;
      if (rank < existing.bestRank) existing.bestRank = rank;
    });
  }

  return [...byId.values()]
    .sort(
      (a, b) =>
        b.score - a.score || a.bestRank - b.bestRank || a.order - b.order,
    )
    .map(({ candidate, score, bestRank }) => ({ candidate, score, bestRank }));
}
