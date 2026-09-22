import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  evaluateGenerationGate,
  evaluateGenerationGrounding,
  type GenerationEvalMetrics,
} from './eval/generation-eval';

const baselinePath = path.resolve(process.cwd(), 'tests/eval/baseline.json');

interface BaselineFile {
  version: number;
  tolerance: { metricRatio: number };
  metrics: Record<string, number>;
  generation?: GenerationEvalMetrics;
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as BaselineFile;

function generationBaseline() {
  if (!baseline.generation) {
    throw new Error(
      'baseline.json is missing the "generation" section; refresh it with RETRIEVAL_EVAL_UPDATE=1 pnpm exec vitest run tests/generation-eval.test.ts',
    );
  }
  return {
    metrics: baseline.generation,
    tolerance: baseline.tolerance,
  };
}

describe('generation grounding evaluation gate', () => {
  it('has a checked-in generation baseline', () => {
    // Without this, every gate check would compare against `undefined` and
    // pass silently.
    expect(baseline.generation).toBeDefined();
    for (const metric of [
      'sourceCoverage',
      'sectionCoverage',
      'citationAccuracy',
      'citationAttachment',
    ] as const) {
      expect(Number.isFinite(baseline.generation?.[metric]), metric).toBe(true);
    }
  });

  it('fails loudly when the generation baseline is missing a metric', () => {
    const report = {
      grounding: 'per-section' as const,
      rerank: true,
      hybrid: true,
      metrics: {
        sourceCoverage: 1,
        sectionCoverage: 1,
        citationAccuracy: 1,
        citationAttachment: 1,
      },
      requests: [],
    };
    const failures = evaluateGenerationGate(report, {
      metrics: {
        sourceCoverage: 1,
        sectionCoverage: 1,
        citationAccuracy: 1,
      } as never,
      tolerance: { metricRatio: 0.05 },
    });

    expect(failures.map((failure) => failure.metric)).toContain(
      'citationAttachment',
    );
    expect(failures[0].message).toContain('no checked-in baseline');
  });

  it('meets the checked-in generation baseline within the documented tolerance', async () => {
    const report = await evaluateGenerationGrounding();

    if (process.env.RETRIEVAL_EVAL_UPDATE === '1') {
      writeFileSync(
        baselinePath,
        `${JSON.stringify(
          { ...baseline, version: 1, generation: report.metrics },
          null,
          2,
        )}\n`,
      );
      return;
    }

    const failures = evaluateGenerationGate(report, generationBaseline());
    expect(
      failures,
      JSON.stringify(
        {
          failures,
          metrics: report.metrics,
          requests: report.requests,
        },
        null,
        2,
      ),
    ).toEqual([]);
  });

  it.skipIf(process.env.RETRIEVAL_EVAL_UPDATE === '1')(
    'detects retrieval being bypassed',
    async () => {
      // `raw-slice` skips the pipeline entirely and keeps only the first
      // bounded set of chunks per source, so the tail sections of the long
      // source are missing and their citations never attach.
      const bypassed = await evaluateGenerationGrounding({
        grounding: 'raw-slice',
      });
      const failures = evaluateGenerationGate(
        bypassed,
        generationBaseline(),
      ).map((failure) => failure.metric);
      expect(failures).toContain('sectionCoverage');
      expect(failures).toContain('citationAccuracy');
    },
  );

  it.skipIf(process.env.RETRIEVAL_EVAL_UPDATE === '1')(
    'represents the labeled sections that the bypass loses',
    async () => {
      const grounded = await evaluateGenerationGrounding();
      const bypassed = await evaluateGenerationGrounding({
        grounding: 'raw-slice',
      });
      const singlePass = await evaluateGenerationGrounding({
        grounding: 'single-pass',
      });

      for (const request of grounded.requests) {
        expect(request.sectionCoverage, request.requestId).toBe(1);
        expect(request.citationAccuracy, request.requestId).toBe(1);
        // The metrics come from what the real prompt builder rendered, not
        // from the grounding's chunk list alone.
        expect(request.promptChars, request.requestId).toBeGreaterThan(0);
        expect(
          request.renderedChunkIds.length,
          request.requestId,
        ).toBeGreaterThan(0);
        expect(request.droppedBlocks, request.requestId).toBe(0);
        // The per-section plan never loses a labeled section the pre-ticket
        // one-bounded-set plan could reach.
        const previous = singlePass.requests.find(
          (candidate) => candidate.requestId === request.requestId,
        )!;
        expect(request.sectionCoverage).toBeGreaterThanOrEqual(
          previous.sectionCoverage,
        );
      }
      const bypassedLongSource = bypassed.requests.find(
        (request) => request.requestId === 'g-long-source-guide',
      )!;
      // The metrics come from what the real prompt builder rendered, so a
      // prompt that loses the tail fails here even when the grounding shape
      // is intact.
      expect(bypassedLongSource.sectionCoverage).toBeLessThan(1);
      expect(bypassedLongSource.citationAccuracy).toBeLessThan(1);
      expect(bypassedLongSource.renderedChunkIds).not.toEqual(
        grounded.requests.find(
          (request) => request.requestId === 'g-long-source-guide',
        )!.renderedChunkIds,
      );
    },
  );
});
