export interface FusionLeg<T> {
  weight: number;
  candidates: T[];
}

export interface FusedCandidate<T> {
  candidate: T;
  score: number;
  bestRank: number;
}

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
