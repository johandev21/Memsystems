import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { EvalEmbedder } from './eval/deterministic-embedder';
import {
  evaluateRetrieval,
  evaluateRetrievalGate,
  type RetrievalEvalBaseline,
} from './eval/retrieval-eval';

const baselinePath = path.resolve(process.cwd(), 'tests/eval/baseline.json');
const baseline = JSON.parse(
  readFileSync(baselinePath, 'utf8'),
) as RetrievalEvalBaseline;

/** An embedder that maps everything to the same vector, destroying ranking. */
const constantEmbedder: EvalEmbedder = {
  embed: () => Array.from({ length: 1024 }, () => 1),
};

describe('retrieval evaluation gate', () => {
  it('meets the checked-in baseline within the documented tolerance', async () => {
    const report = await evaluateRetrieval();

    if (process.env.RETRIEVAL_EVAL_UPDATE === '1') {
      writeFileSync(
        baselinePath,
        `${JSON.stringify(
          {
            version: 1,
            tolerance: baseline.tolerance,
            metrics: report.metrics,
          },
          null,
          2,
        )}\n`,
      );
      return;
    }

    const failures = evaluateRetrievalGate(report, baseline);
    expect(
      failures,
      JSON.stringify(
        {
          failures,
          metrics: report.metrics,
          queries: report.queries.map((query) => ({
            queryId: query.queryId,
            retrievedChunkIds: query.retrievedChunkIds,
            abstained: query.abstained,
          })),
        },
        null,
        2,
      ),
    ).toEqual([]);
  });

  it.skipIf(process.env.RETRIEVAL_EVAL_UPDATE === '1')(
    'detects a deliberately introduced retrieval regression',
    async () => {
      // The constant embedder destroys the candidate ranking the dense leg
      // feeds the reranker, so recall and citations fall even with the
      // reranker on. The lexical leg is disabled so the regression targets
      // the dense leg instead of being masked by hybrid retrieval.
      const constant = await evaluateRetrieval({
        embedder: constantEmbedder,
        hybrid: false,
      });
      const constantFailures = evaluateRetrievalGate(constant, baseline).map(
        (failure) => failure.metric,
      );
      expect(constantFailures).toContain('recallAtK');
      expect(constantFailures).toContain('citationAccuracy');

      // A disabled floor only regresses when reranking is also off: the
      // rerank threshold is what gates unanswerable queries otherwise.
      const floorless = await evaluateRetrieval({
        relevanceFloor: 0,
        rerank: false,
      });
      expect(
        evaluateRetrievalGate(floorless, baseline).map(
          (failure) => failure.metric,
        ),
      ).toContain('refusalAccuracy');
    },
  );

  it.skipIf(process.env.RETRIEVAL_EVAL_UPDATE === '1')(
    'detects the lexical leg being disabled',
    async () => {
      const denseOnly = await evaluateRetrieval({ hybrid: false });
      const failures = evaluateRetrievalGate(denseOnly, baseline).map(
        (failure) => failure.metric,
      );
      // The catalog answer is only reachable through the lexical leg: the
      // dense leg's cosine over-ranks the short prerequisite stubs and never
      // returns the long entry, so recall, citations, and refusals all fall.
      expect(failures).toContain('recallAtK');
      expect(failures).toContain('citationAccuracy');
      expect(failures).toContain('refusalAccuracy');
    },
  );

  it.skipIf(process.env.RETRIEVAL_EVAL_UPDATE === '1')(
    'detects the reranker being disabled',
    async () => {
      const unreranked = await evaluateRetrieval({ rerank: false });
      const failures = evaluateRetrievalGate(unreranked, baseline).map(
        (failure) => failure.metric,
      );
      // The dense leg over-ranks short glossary entries and returns fewer
      // relevant passages first, so disabling the reranker must fail the
      // ranking-quality and precision metrics the baseline protects.
      expect(failures).toContain('contextPrecision');
      expect(failures).toContain('mrr');
      expect(failures).toContain('ndcgAtK');
    },
  );
});
