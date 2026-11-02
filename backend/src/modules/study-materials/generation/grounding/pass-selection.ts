import {
  jaccardSimilarity,
  textSignature,
} from '../../../ai/retrieval/text-similarity';
import type { RetrievedChunk } from '../../../ai/retrieval/retrieval.service';
import { NEAR_DUPLICATE_JACCARD_THRESHOLD } from './budgets';
import { stripChunkContentHeader } from '../../../ai/indexing/chunking.service';

function extractNumericTokens(text: string): Set<string> {
  return new Set(text.match(/\d+/g) ?? []);
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

export function isNearDuplicateChunk(
  candidate: RetrievedChunk,
  existing: RetrievedChunk,
): boolean {
  const bodyA = stripChunkContentHeader(candidate.content).trim();
  const bodyB = stripChunkContentHeader(existing.content).trim();
  if (!bodyA || !bodyB) return false;
  if (bodyA === bodyB) return true;

  const tokensA = textSignature(bodyA).tokens;
  const tokensB = textSignature(bodyB).tokens;
  const similarity = jaccardSimilarity(tokensA, tokensB);
  if (similarity < NEAR_DUPLICATE_JACCARD_THRESHOLD) {
    return false;
  }

  const sectionKeyA = (candidate.sectionPath ?? []).join(' > ');
  const sectionKeyB = (existing.sectionPath ?? []).join(' > ');
  const sameNonEmptySection =
    sectionKeyA.length > 0 && sectionKeyA === sectionKeyB;
  if (sameNonEmptySection) {
    return true;
  }

  const numsA = extractNumericTokens(bodyA);
  const numsB = extractNumericTokens(bodyB);
  if ((numsA.size > 0 || numsB.size > 0) && !setsEqual(numsA, numsB)) {
    return false;
  }

  return true;
}

export function selectPerPass(
  chunksByPass: RetrievedChunk[][],
  passIndexes: number[],
  budget: number,
): RetrievedChunk[] {
  const seenIds = new Set<string>();
  const selected: RetrievedChunk[] = [];
  const maxRounds = Math.max(
    0,
    ...passIndexes.map((index) => chunksByPass[index]?.length ?? 0),
  );
  for (let round = 0; round < maxRounds; round++) {
    for (const index of passIndexes) {
      const chunk = chunksByPass[index]?.[round];
      if (!chunk || seenIds.has(chunk.chunkId)) continue;
      if (selected.some((existing) => isNearDuplicateChunk(chunk, existing))) {
        seenIds.add(chunk.chunkId);
        continue;
      }
      seenIds.add(chunk.chunkId);
      selected.push(chunk);
      if (selected.length >= budget) return selected;
    }
  }
  return selected;
}
