# Retrieval evaluation

Retrieval is measured, not guessed. The golden set and the evaluation runner
live with the backend tests, and the runner is a continuous integration gate:
a retrieval change that regresses a metric beyond the documented tolerance
fails `pnpm run test`.

The gate covers the retrieval pipeline (query embedding, dense and lexical
search legs, reciprocal rank fusion, dedupe, reranking, relevance thresholds,
Evidence selection). The later retrieval tickets — chunking, query
understanding, Generation grounding — are expected to move these metrics and
to update the baseline with evidence.

## Pieces

| Path | Purpose |
| --- | --- |
| `backend/tests/eval/golden-set.ts` | The corpus of Sources and Source Chunks and the labeled queries. |
| `backend/tests/eval/deterministic-embedder.ts` | A deterministic lexical embedder used instead of Voyage, so the gate runs keyless in CI. |
| `backend/tests/eval/deterministic-reranker.ts` | A deterministic cross-encoder stand-in, so the gate exercises the rerank stage keylessly. |
| `backend/tests/eval/retrieval-eval.ts` | Seeds the corpus, runs every query through `RetrievalService`, and computes the metrics and the gate. |
| `backend/tests/eval/baseline.json` | The checked-in baseline metrics and the documented tolerance. |
| `backend/tests/retrieval-eval.test.ts` | The Vitest gate, plus the tests that prove a deliberate regression and a disabled reranker are caught. |

The runner calls the real retrieval pipeline against the disposable test
database (see [testing.md](testing.md)). It does not call Voyage: the
deterministic embedder maps text to 1024-dimension vectors by hashing TF-IDF
weighted tokens, so a query stays close to chunks that share its distinctive
vocabulary. Its score scale is compressed compared with Voyage, and the
harness uses thresholds calibrated for it (`EVAL_RELEVANCE_FLOOR`,
`EVAL_RERANK_THRESHOLD` in `retrieval-eval.ts`). The metrics protect against
relative regressions; they are not a statement about production relevance.

The deterministic reranker scores each query-document pair by the share of the
query's IDF mass the document contains, reduced for fragments too short to
carry an answer. It is deliberately different from the dense leg, whose cosine
normalization lets a short glossary stub outrank a longer passage that answers
the query. The golden corpus contains such stubs, so the gate can tell reranked
from unreranked retrieval: with reranking disabled, `mrr`, `nDCG`, and
`contextPrecision` all fall below the baseline and the gate fails. The harness
over-fetches fewer candidates than production (`EVAL_CANDIDATE_DEPTH`) so a
broken dense leg still shows up in recall even while reranking is on.

Hybrid retrieval runs the dense leg and a lexical full-text leg as separate
candidate lists and fuses them with Reciprocal Rank Fusion, so the harness also
needs a query the dense leg cannot answer. The course-catalog source provides
it: a long catalog entry shares several query terms but dilutes its dense
cosine, while eight short prerequisite lines mention the same course code and
fill the dense candidate depth. The lexical leg ranks the long entry first and
fusion carries it into the reranked set; with the lexical leg disabled, the
entry never becomes a candidate, recall and citation accuracy fall, and the
answerable query abstains. The harness runs each leg at the same over-fetch
depth (`EVAL_LEXICAL_CANDIDATE_DEPTH`), so neither leg masks the other. Fusion
is a rank-based stage, so its ordering is covered directly by
`backend/tests/rank-fusion.test.ts` and end to end through the pipeline.

## Metrics

| Metric | Meaning | Direction |
| --- | --- | --- |
| `recallAtK` | Share of labeled relevant chunks retrieved, averaged over answerable queries. | higher is better |
| `mrr` | Mean reciprocal rank of the first relevant chunk. | higher is better |
| `ndcgAtK` | Binary-relevance nDCG over the retrieved order. | higher is better |
| `contextPrecision` | Share of retrieved chunks labeled relevant, over queries that retrieved something. | higher is better |
| `citationAccuracy` | Share of expected citations that resolve to the labeled relevant chunk. The harness plays an ideal answer citing each labeled relevant chunk through its Evidence key, plus an invented key that must be dropped by the real citation extractor. | higher is better |
| `refusalAccuracy` | Share of queries whose abstention matched the label: answerable queries must answer, unanswerable ones must abstain. | higher is better |
| `faithfulness` | Deterministic proxy: share of answered queries whose top-ranked chunk is relevant. A model-judged faithfulness check needs provider calls and is out of scope for the keyless gate. | higher is better |
| `latencyMsP50`, `latencyMsP95` | Wall-clock retrieval duration per query. | reported; p95 is gated by an absolute ceiling |
| `costTokensPerQuery` | Estimated query cost: embedding tokens plus reranker tokens (about 4 characters per token), averaged over queries so adding a labeled query does not move the metric by itself. Hybrid retrieval reranks the fused candidates from both legs, so it costs more than dense-only retrieval. | lower is better |

## Tolerance and baseline

`baseline.json` holds the metrics and the tolerance:

- Quality metrics fail when they drop more than 5% relative to the baseline.
- `costTokensPerQuery` fails when it grows more than 20% relative to the
  baseline.
- `latencyMsP95` fails above the absolute 2000 ms ceiling, chosen to avoid
  flaking on shared CI runners while still catching pathological regressions.

Refresh the baseline only after an intentional retrieval change and after
confirming the new metrics are the ones you want:

```bash
RETRIEVAL_EVAL_UPDATE=1 pnpm --filter backend exec vitest run tests/retrieval-eval.test.ts
```

Review the `baseline.json` diff before committing. A metric that moved the
wrong way is a regression, not a new baseline.

## Adding a labeled query

1. Add a `GoldenQuery` to `GOLDEN_QUERIES` in
   `backend/tests/eval/golden-set.ts`. Use a real study question, and set
   `answerable: false` when the corpus cannot answer it.
2. Point `relevantChunkIds` at the existing golden chunk ids that answer it,
   or at `[]` when unanswerable.
3. Run the gate once without refreshing the baseline. A new query that
   retrieval already answers may still be inside tolerance; a query it misses
   fails `recallAtK` or `refusalAccuracy` and shows what to fix.
4. Once the retrieval behavior is right, refresh the baseline.

Adding a Source or a chunk follows the same shape: append it to
`GOLDEN_SOURCES` and keep its `id` stable, because labels and the baseline
refer to chunk ids. Never reuse or rename an id. Any corpus change also shifts
the deterministic embedder's IDF weights, so expect metrics to move a little
even for unchanged queries; refresh the baseline after reviewing the report.

## Running locally

Prerequisites are the same as any backend test: a disposable pgvector
database (see [testing.md](testing.md)). Then:

```bash
pnpm --filter backend exec vitest run tests/retrieval-eval.test.ts   # the gate
pnpm run test                                                        # the whole suite, gate included
```

## Continuous integration

`.github/workflows/quality.yml` starts a `pgvector/pgvector:pg17` service,
applies migrations to the test database, and runs `lint`, `typecheck`, and
`test`. The retrieval gate lives inside the test step, so a regression fails
the workflow.

The gate test also runs deliberately broken configurations — a constant
embedder, a disabled floor, a disabled reranker, and a disabled lexical leg —
and asserts that the gate reports failures, so the gate itself is tested rather
than assumed. Disabling the lexical leg is expected to fail `recallAtK`,
`citationAccuracy`, and `refusalAccuracy`: the catalog answer is only reachable
through fusion.
