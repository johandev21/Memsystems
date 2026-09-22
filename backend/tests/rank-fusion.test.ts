import { describe, expect, it } from 'vitest';
import { reciprocalRankFusion } from '../src/modules/ai/rank-fusion';

interface Item {
  id: string;
}

const item = (id: string): Item => ({ id });
const idOf = (candidate: Item): string => candidate.id;

describe('reciprocalRankFusion', () => {
  it('sums the rank contributions of every leg that ranked a candidate', () => {
    const fused = reciprocalRankFusion(
      [
        { weight: 1, candidates: [item('a'), item('b')] },
        { weight: 1, candidates: [item('b'), item('c')] },
      ],
      idOf,
      60,
    );

    expect(fused.map((entry) => entry.candidate.id)).toEqual(['b', 'a', 'c']);
    expect(fused[0].score).toBeCloseTo(1 / 62 + 1 / 61, 12);
    expect(fused[1].score).toBeCloseTo(1 / 61, 12);
    expect(fused[2].score).toBeCloseTo(1 / 62, 12);
  });

  it('promotes a candidate that only one leg ranked first over a single-leg leader', () => {
    // The classic RRF property: a document both legs rank well beats a
    // document a single leg ranked first.
    const fused = reciprocalRankFusion(
      [
        { weight: 1, candidates: [item('dense-only'), item('both')] },
        {
          weight: 1,
          candidates: [item('both'), item('lexical-second')],
        },
      ],
      idOf,
      60,
    );

    expect(fused.map((entry) => entry.candidate.id)).toEqual([
      'both',
      'dense-only',
      'lexical-second',
    ]);
  });

  it('flattens the top-rank advantage as the smoothing constant grows', () => {
    // `first-and-fourth` leads one leg but sits low in the other;
    // `both-second` is consistently second. A small k rewards the single
    // first place, while a large k rewards the candidate both legs rank well.
    const legs = [
      {
        weight: 1,
        candidates: [item('first-and-fourth'), item('both-second')],
      },
      {
        weight: 1,
        candidates: [
          item('other-first'),
          item('both-second'),
          item('other-third'),
          item('first-and-fourth'),
        ],
      },
    ];
    const sharp = reciprocalRankFusion(legs, idOf, 1);
    const flat = reciprocalRankFusion(legs, idOf, 100);

    expect(sharp[0].candidate.id).toBe('first-and-fourth');
    expect(flat[0].candidate.id).toBe('both-second');
  });

  it('weights the legs so one can be favored', () => {
    const fused = reciprocalRankFusion(
      [
        { weight: 0.5, candidates: [item('dense-first')] },
        { weight: 1, candidates: [item('lexical-first')] },
      ],
      idOf,
      60,
    );

    expect(fused[0].candidate.id).toBe('lexical-first');
  });

  it('drops a leg whose weight is zero or negative', () => {
    const fused = reciprocalRankFusion(
      [
        { weight: 0, candidates: [item('ignored')] },
        { weight: -1, candidates: [item('also-ignored')] },
        { weight: 1, candidates: [item('kept')] },
      ],
      idOf,
      60,
    );

    expect(fused.map((entry) => entry.candidate.id)).toEqual(['kept']);
  });

  it('keeps the first-seen candidate instance and breaks ties by best rank', () => {
    const first = item('shared');
    const second = item('shared');
    const fused = reciprocalRankFusion(
      [
        { weight: 1, candidates: [first] },
        { weight: 1, candidates: [second] },
      ],
      idOf,
      60,
    );

    expect(fused).toHaveLength(1);
    expect(fused[0].candidate).toBe(first);
    expect(fused[0].bestRank).toBe(1);
  });

  it('returns an empty list when no leg contributes', () => {
    expect(reciprocalRankFusion([], idOf, 60)).toEqual([]);
    expect(
      reciprocalRankFusion([{ weight: 0, candidates: [item('a')] }], idOf, 60),
    ).toEqual([]);
  });
});
