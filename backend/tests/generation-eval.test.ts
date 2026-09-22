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
  return {
    metrics: baseline.generation ?? {},
    tolerance: baseline.tolerance,
  } as { metrics: GenerationEvalMetrics; tolerance: { metricRatio: number } };
}

describe('generation grounding evaluation gate', () => {
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
      expect(bypassedLongSource.sectionCoverage).toBeLessThan(1);
      expect(bypassedLongSource.citationAccuracy).toBeLessThan(1);
    },
  );
});
