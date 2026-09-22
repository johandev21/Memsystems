import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { EvalEmbedder } from './eval/deterministic-embedder';
import {
  evaluateRetrieval,
  evaluateRetrievalGate,
  type RetrievalEvalBaseline,
} from './eval/retrieval-eval';
import { GOLDEN_QUERIES } from './eval/golden-set';

const baselinePath = path.resolve(process.cwd(), 'tests/eval/baseline.json');
const baseline = JSON.parse(
  readFileSync(baselinePath, 'utf8'),
) as RetrievalEvalBaseline;

function goldenQueryById(id: string) {
  return GOLDEN_QUERIES.find((query) => query.id === id);
}

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
            // Preserve other evaluation sections (Generation grounding) that
            // share this baseline file.
            ...baseline,
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
            searchedQuery: query.searchedQuery,
            rewriteStrategy: query.rewriteStrategy,
            rewriteReason: query.rewriteReason,
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
      // dense leg's cosine over-ranks the short prerequisite stubs that share
      // the course code and never returns the long entry, so recall,
      // citations, and ranking quality all fall. Dense-only retrieval may
      // still return a stub, so refusal accuracy is not asserted here.
      expect(failures).toContain('recallAtK');
      expect(failures).toContain('citationAccuracy');
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

  it.skipIf(process.env.RETRIEVAL_EVAL_UPDATE === '1')(
    'detects contextualization being disabled',
    async () => {
      // Without the document and section header, a passage that only makes
      // sense in its section is no longer retrievable: the section-dependent
      // queries miss and abstain, so recall and refusal accuracy fall.
      const withoutContext = await evaluateRetrieval({ contextualize: false });
      const failures = evaluateRetrievalGate(withoutContext, baseline).map(
        (failure) => failure.metric,
      );
      expect(failures).toContain('recallAtK');
      expect(failures).toContain('refusalAccuracy');
    },
  );

  it.skipIf(process.env.RETRIEVAL_EVAL_UPDATE === '1')(
    'detects query understanding being disabled',
    async () => {
      const unrewritten = await evaluateRetrieval({ rewrite: false });
      const failures = evaluateRetrievalGate(unrewritten, baseline).map(
        (failure) => failure.metric,
      );
      // The labeled meta, follow-up and ambiguous queries are only
      // answerable after the rewrite: without it they abstain or retrieve
      // the wrong chunk, so recall, citations and refusal accuracy all fall.
      expect(failures).toContain('recallAtK');
      expect(failures).toContain('citationAccuracy');
      expect(failures).toContain('refusalAccuracy');
      expect(failures).not.toContain('latencyMsP95');
    },
  );

  it.skipIf(process.env.RETRIEVAL_EVAL_UPDATE === '1')(
    'improves recall on the labeled query-understanding queries',
    async () => {
      const withRewrite = await evaluateRetrieval();
      const withoutRewrite = await evaluateRetrieval({ rewrite: false });
      const labeled = withRewrite.queries.filter((query) => {
        const golden = goldenQueryById(query.queryId);
        return golden?.understanding !== undefined;
      });
      expect(labeled.length).toBeGreaterThanOrEqual(3);

      for (const query of labeled) {
        const unrewritten = withoutRewrite.queries.find(
          (candidate) => candidate.queryId === query.queryId,
        )!;
        // Each labeled query is answerable only with query understanding.
        expect(query.recall, query.queryId).toBe(1);
        expect(unrewritten.recall, query.queryId).toBeLessThan(1);
        expect(query.rewriteStrategy, query.queryId).not.toBeNull();
      }
    },
  );

  it.skipIf(process.env.RETRIEVAL_EVAL_UPDATE === '1')(
    'keeps the gate green with paraphrase fusion and hypothetical answers enabled',
    async () => {
      const report = await evaluateRetrieval({
        multiQuery: true,
        hypotheticalAnswer: true,
      });
      expect(evaluateRetrievalGate(report, baseline)).toEqual([]);
    },
  );
});
