# Retrieval evaluation

Retrieval is measured, not guessed. The golden set and the evaluation runner
live with the backend tests, and the runner is a continuous integration gate:
a retrieval change that regresses a metric beyond the documented tolerance
fails `pnpm run test`.

The gate covers the retrieval pipeline (query understanding, query embedding,
dense and lexical search legs, reciprocal rank fusion, dedupe, reranking,
The gate covers the retrieval pipeline (query understanding, query embedding,
dense and lexical search legs, reciprocal rank fusion, dedupe, reranking,
relevance thresholds, Evidence assembly) and the post-generation citation
check (supporting spans, unresolvable-key removal, nearest-Evidence
attribution), plus the contextual chunk representation the pipeline retrieves
over. A second gate covers Generation grounding over the same corpus (see
[Generation grounding](#generation-grounding)); both share `baseline.json`.

## Pieces

| Path | Purpose |
| --- | --- |
| `backend/tests/eval/golden-set.ts` | The corpus of Sources and Source Chunks and the labeled queries. |
| `backend/tests/eval/deterministic-embedder.ts` | A deterministic lexical embedder used instead of Voyage, so the gate runs keyless in CI. |
| `backend/tests/eval/deterministic-reranker.ts` | A deterministic cross-encoder stand-in, so the gate exercises the rerank stage keylessly. |
| `backend/tests/eval/retrieval-eval.ts` | Seeds the corpus, runs every query through `RetrievalService`, and computes the metrics and the gate. |
| `backend/tests/eval/deterministic-rewriter.ts` | A deterministic rewrite model over the golden corpus, so the gate exercises query understanding keylessly. |
| `backend/tests/eval/baseline.json` | The checked-in baseline metrics and the documented tolerance. |
| `backend/tests/retrieval-eval.test.ts` | The Vitest gate, plus the tests that prove a deliberate regression, a disabled reranker, a disabled lexical leg, a disabled contextual header, disabled query understanding, disabled attribution, and a citation mapping that accepts an invented key are caught. |
| `backend/tests/eval/generation-eval.ts` | Seeds the same corpus plus the long `mushroom-guide` source, runs the real Generation grounding, and computes the Generation metrics. |
| `backend/tests/generation-eval.test.ts` | The Generation gate, plus the test that proves a bypassed retrieval fails it. |

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
carry an answer. It scores the chunk's contextual searchable text, the same
text the retrieval legs index, so a passage that only makes sense inside its
section is judged with that section in view. It is deliberately different from
the dense leg, whose cosine normalization lets a short glossary stub outrank a
longer passage that answers the query. The golden corpus contains such stubs,
so the gate can tell reranked from unreranked retrieval: with reranking
disabled, `mrr`, `nDCG`, and `contextPrecision` all fall below the baseline and
the gate fails. The harness over-fetches fewer candidates than production
(`EVAL_CANDIDATE_DEPTH`) so a broken dense leg still shows up in recall even
while reranking is on.

Hybrid retrieval runs the dense leg and a lexical full-text leg as separate
candidate lists and fuses them with Reciprocal Rank Fusion, so the harness also
needs a query the dense leg cannot answer. The course-catalog source provides
it: a long catalog entry shares several query terms but dilutes its dense
cosine, while eight short prerequisite lines mention the same course code and
fill the dense candidate depth. The lexical leg ranks the long entry first and
fusion carries it into the reranked set; with the lexical leg disabled, the
entry never becomes a candidate and recall and citation accuracy fall. Dense
only retrieval may still return a prerequisite stub, so the gate does not
assert refusal accuracy for that configuration. The harness runs each leg at
the same over-fetch depth (`EVAL_LEXICAL_CANDIDATE_DEPTH`), so neither leg
masks the other. Fusion is a rank-based stage, so its ordering is covered
directly by `backend/tests/rank-fusion.test.ts` and end to end through the
pipeline.

## Contextual representation

Chunks carry a document and section context header in their searchable text:
the source title, the source kind, and the segment heading path. The lexical
leg indexes it, the dense leg embeds it (in production through Voyage's
contextualized chunk embeddings), and the reranker scores it. The gate proves
the header is load-bearing with the `lab-manual` source: a long, section
dependent corpus whose bodies share generic laboratory vocabulary, with
labeled queries that name the section rather than the body wording. With the
header the passages are retrieved; with `evaluateRetrieval({ contextualize:
false })` the header is absent from the searchable text and the embedding, the
section tokens disappear from the chunk representation, both queries abstain,
and `recallAtK` and `refusalAccuracy` drop far below the baseline.

The deterministic embedder cannot simulate the model's learned document
context, so `contextualize` proxies contextualization with the header it can
represent. The IDF vocabulary is always built from the contextual text, even
when a run disables the header, so a chunk that loses its section tokens
genuinely loses ranking signal instead of the tokens being ignored as unknown.

The gate seeds its chunks directly, so the `contextualize` toggle isolates the
representation from the chunker. `backend/tests/chunking.service.test.ts`
covers the real `ChunkingService` over this same corpus: it asserts that each
section keeps its heading path and body, that a long document is split into
chunks that respect the minimum and target, and that the split loses no text.
Sections shorter than the minimum stay their own chunk (a citation keeps its
locator); only fragments within a section merge.

## Query understanding

Query understanding runs before the legs: it decides whether a rewrite is
worth a model call, rewrites the message into a search query, resolves
follow-up references from the recent turns, and can return paraphrases (fused
through the same RRF) and a hypothetical answer for short queries. The
harness runs the real stage. Because CI has no gateway key, the rewrite model
is `deterministic-rewriter.ts`, a stand-in that runs the pipeline's own
heuristic (strip meta-instructions, resolve history references) and then maps
colloquial terms to the golden corpus's vocabulary (for example
"respiration" to "mitochondria triphosphate", because the corpus spells ATP
out). It is a test double, not a rewriter; the production path is exercised at
the unit level (`tests/query-understanding.test.ts`,
`tests/query-rewriter.service.test.ts`) and through `RetrievalService`
(`tests/retrieval.service.test.ts`).

Three labeled queries carry an `understanding` label and are answerable only
after the rewrite:

- `q-meta-summary` wraps its subject in "detailed chapter summary", words
  that only occur in the degraded study guide. Without stripping them, the
  query's own words outweigh its subject and nothing clears the rerank
  threshold.
- `q-followup-expand` is a bare reference ("Can you expand on that in more
  detail?") whose history supplies the subject; without resolution the query
  has no corpus vocabulary at all and retrieval abstains.
- `q-ambiguous-respiration` asks a short question whose only corpus term
  ("respiration") lives in a glossary stub; the rewrite expands it into the
  material's vocabulary.

`RetrievalEvalOptions` keeps the switch used by the gate (`rewrite: false`
runs the pipeline on the original messages), plus `multiQuery` and
`hypotheticalAnswer` for measuring those knobs. The gate test
`detects query understanding being disabled` fails `recallAtK`,
`citationAccuracy`, and `refusalAccuracy` when rewriting is off, and
`improves recall on the labeled query-understanding queries` asserts each
labeled query improves from a miss to a full recall.

The rewrite shares the pipeline's 2000 ms p95 latency ceiling. Its model call
is bounded by `RETRIEVAL_REWRITE_TIMEOUT_MS` (default 1200 ms); a message that
already reads as a search query never pays for it. The harness's
`costTokensPerQuery` includes the rewrite model's input and output tokens
alongside the query embedding and rerank tokens, so enabling rewriting shows
up in the cost metric rather than hiding behind it.

## Evidence assembly and citations

After the threshold, `RetrievalService` assembles the final Evidence set
(`backend/src/modules/ai/evidence-assembly.ts`): a passage a better-ranked
passage contains is dropped (order-sensitive token-bigram containment, so a
passage whose words merely appear elsewhere in another arrangement survives),
one Source cannot fill the set (`RETRIEVAL_MAX_PER_SOURCE`, with backfill when
other Sources run out), selected passages carry their section heading path,
and the set is bounded by `RETRIEVAL_EVIDENCE_TOKEN_BUDGET` instead of a
character slice. "Section context" here means the heading path attached to
the model-facing passage, not neighbouring chunk text: every passage stays
the chunk the reranker judged and citations stay per chunk, and the header's
tokens count against the budget. A caller that knows its model's context
window can pass a per-request `tokenBudget`; the model catalog exposes none
today, so the documented default is the conservative bound and the Chat
renders the assembled block without a character slice. The assembly is pure
and deterministic, and the run exposes the resolved knobs through the trace's
`evidence` block. `tests/evidence-assembly.test.ts` covers dedupe (including
reordered and longer passages), the diversity cap, the budget, section
expansion, and determinism; `tests/retrieval.service.test.ts` proves the
assembled set and its drops reach the trace and the returned chunks.

The citation metric plays an ideal answer against the real post-generation
check: an explicit marker per labeled relevant chunk, one unmarked claim
copied from a relevant passage, and an invented `R99` key. A query scores as
the share of expected citations that

- resolve to a labeled chunk through an explicit marker,
- store a supporting span of that chunk (a substring that shares a content
  word with the played claim), and
- are attributed from the unmarked claim when attribution is enabled.

An invented key that resolves scores the query zero, because every citation
on that turn is untrustworthy. The denominator is the labeled chunks plus the
unmarked claim, so a relevant chunk retrieval missed counts as a failed
citation instead of dropping out of the metric. Two gate tests keep the check
honest: `detects grounding attribution being disabled` fails
`citationAccuracy` when the verifier no longer attributes unmarked claims,
and `detects a citation mapping that lets an invented key resolve` fails it
when unresolvable keys are accepted. `tests/chat-citations.test.ts` covers
span extraction and trailing markers, invalid-citation removal, attribution,
and the Evidence block (no retrieval score, section context rendered).

The measured improvement over the pre-ticket check, from the same runner
(`citationAccuracy`, tolerance floor 0.95):

| Configuration | `citationAccuracy` |
| --- | --- |
| Verification and attribution enabled (checked-in baseline) | 1.0 |
| Attribution disabled (`citationAttribution: false`) | 0.5 |
| Regressed verifier that accepts the invented key | 0.0 |

Every answerable query plays two expected citations (an explicit marker for
its labeled chunk and an unmarked claim copied from it) plus the invented
`R99`; attribution disabled leaves only the explicit citation resolving, and
a verifier that accepts `R99` scores the query zero. This is also why the
metric is stricter than its pre-ticket form, where the quote was the whole
chunk and no unmarked claim was attributed: that check could not tell either
regression apart.

## Generation grounding

`backend/tests/eval/generation-eval.ts` covers the other consumer of the
pipeline: Study Material Generation. It seeds the same corpus plus a long,
sectioned source (`mushroom-guide`, eight sections of three chunks) and runs
the real `GenerationGroundingService` over labeled Generation requests. Each
request names the brief, the selected sources in order, and the sections the
material must be able to draw on and cite. The tail sections sit past the
sixteenth chunk, so a grounding that returns one bounded set per source
cannot reach them.

| Metric | Meaning | Direction |
| --- | --- | --- |
| `sourceCoverage` | Share of selected sources that contributed evidence. | higher is better |
| `sectionCoverage` | Share of the labeled sections represented in the evidence. | higher is better |
| `citationAccuracy` | Share of the labeled sections the material carries a citation for. The harness plays an ideal grounded answer that cites the first retrieved chunk of each labeled section, and runs the real citation extractor and attachment; a section with no evidence never gets a citation. | higher is better |
| `citationAttachment` | Share of requests whose material carries at least one citation. | higher is better |

The gate runs one deliberate regression: `grounding: 'raw-slice'` bypasses the
retrieval pipeline and keeps only the first bounded set of chunks per source
in index order, which loses the tail sections, so `sectionCoverage` and
`citationAccuracy` fall below the baseline and the gate fails. Both the shipped
grounding and the regression are formatted by the production
`formatGroundedSourceText`, and the metrics are computed from the chunks that
prompt actually renders, so a regression in the prompt builder fails the gate
too. The harness also reports `grounding: 'single-pass'` — the pre-ticket query
plan, one brief query per source with no section passes — for comparison. On a
corpus this small a single bounded set still spreads across the sections, which
is why the gated regression is the raw slice rather than the single pass.

The gate fails loudly when `baseline.json` has no `generation` section or is
missing one of its metrics, instead of comparing against `undefined` and
passing.

## Metrics

| Metric | Meaning | Direction |
| --- | --- | --- |
| `recallAtK` | Share of labeled relevant chunks retrieved, averaged over answerable queries. | higher is better |
| `mrr` | Mean reciprocal rank of the first relevant chunk. | higher is better |
| `ndcgAtK` | Binary-relevance nDCG over the retrieved order. | higher is better |
| `contextPrecision` | Share of retrieved chunks labeled relevant, over queries that retrieved something. | higher is better |
| `citationAccuracy` | Share of expected citations that resolve to the labeled relevant chunk with a supporting span, plus the unmarked claim when the verifier attributes it. The harness plays an ideal answer citing each labeled relevant chunk through its Evidence key, adding one unmarked claim copied from a relevant passage and an invented key that must be dropped; a resolved invented key scores the query zero. | higher is better |
| `refusalAccuracy` | Share of queries whose abstention matched the label: answerable queries must answer, unanswerable ones must abstain. | higher is better |
| `faithfulness` | Deterministic proxy: share of answered queries whose top-ranked chunk is relevant. A model-judged faithfulness check needs provider calls and is out of scope for the keyless gate. | higher is better |
| `latencyMsP50`, `latencyMsP95` | Wall-clock retrieval duration per query. | reported; p95 is gated by an absolute ceiling |
| `costTokensPerQuery` | Estimated query cost: rewrite-model input and output tokens plus embedding tokens plus reranker tokens (about 4 characters per token), averaged over queries so adding a labeled query does not move the metric by itself. Hybrid retrieval reranks the fused candidates from both legs, so it costs more than dense-only retrieval; query understanding adds one bounded rewrite call per rewritten message. | lower is better |

## Tolerance and baseline

`baseline.json` holds the metrics and the tolerance:

- Quality metrics fail when they drop more than 5% relative to the baseline.
- `costTokensPerQuery` fails when it grows more than 20% relative to the
  baseline.
- `latencyMsP95` fails above the absolute 2000 ms ceiling, chosen to avoid
  flaking on shared CI runners while still catching pathological regressions.

One baseline move is expected from the contextual representation: when chunks
began carrying the header, `contextPrecision` went from 1.0 to about 0.9167.
The glossary stub for Operation Barbarossa gained header tokens, which count
toward the deterministic reranker's substantive-token floor, so it now clears
the rerank threshold for `q-barbarossa` alongside the relevant passage. The
metric still protects its job: with the reranker disabled, `contextPrecision`
drops well below the new baseline and the gate fails.

Refresh the baseline only after an intentional retrieval change and after
confirming the new metrics are the ones you want. The Chat and Generation
gates share `baseline.json`, so refresh both files together:

```bash
RETRIEVAL_EVAL_UPDATE=1 pnpm --filter backend exec vitest run tests/retrieval-eval.test.ts tests/generation-eval.test.ts
```

Review the `baseline.json` diff before committing. A metric that moved the
wrong way is a regression, not a new baseline. Each update path preserves the
other gate's section.

## Adding a labeled query

1. Add a `GoldenQuery` to `GOLDEN_QUERIES` in
   `backend/tests/eval/golden-set.ts`. Use a real study question, and set
   `answerable: false` when the corpus cannot answer it.
2. Point `relevantChunkIds` at the existing golden chunk ids that answer it,
   or at `[]` when unanswerable.
3. Add `history` when the query is a follow-up that must be resolved from the
   recent turns, and set `understanding` to the trigger the query is labeled
   to exercise (`meta_instructions`, `follow_up`, or `ambiguous`). The
   `improves recall on the labeled query-understanding queries` gate test
   asserts every labeled query improves when rewriting is enabled.
4. Run the gate once without refreshing the baseline. A new query that
   retrieval already answers may still be inside tolerance; a query it misses
   fails `recallAtK` or `refusalAccuracy` and shows what to fix.
5. Once the retrieval behavior is right, refresh the baseline.

Adding a Source or a chunk follows the same shape: append it to
`GOLDEN_SOURCES` and keep its `id` stable, because labels and the baseline
refer to chunk ids. Never reuse or rename an id. Any corpus change also shifts
the deterministic embedder's IDF weights, so expect metrics to move a little
even for unchanged queries; refresh the baseline after reviewing the report.

## Running locally

Prerequisites are the same as any backend test: a disposable pgvector
database (see [testing.md](testing.md)). Then:

```bash
pnpm --filter backend exec vitest run tests/retrieval-eval.test.ts   # the Chat gate
pnpm --filter backend exec vitest run tests/generation-eval.test.ts  # the Generation gate
pnpm run test                                                        # the whole suite, gates included
```

## Continuous integration

`.github/workflows/quality.yml` starts a `pgvector/pgvector:pg17` service,
applies migrations to the test database, and runs `lint`, `typecheck`, and
`test`. The retrieval gate lives inside the test step, so a regression fails
the workflow.

The gate test also runs deliberately broken configurations — a constant
embedder, a disabled floor, a disabled reranker, a disabled lexical leg, a
disabled contextual header, disabled query understanding, disabled grounding
attribution, and a citation mapping that accepts an invented key — and
asserts that the gate reports failures, so the gate itself is tested rather
than assumed. Disabling the lexical leg is expected to fail `recallAtK`,
`citationAccuracy`, and `refusalAccuracy`: the catalog answer is only
reachable through fusion. Disabling the contextual header is expected to fail
`recallAtK` and `refusalAccuracy`: the section-dependent lab-manual queries
lose the tokens that make them retrievable and abstain. Disabling query
understanding fails the same three metrics as the lexical leg: the labeled
meta, follow-up, and ambiguous queries are only answerable after a rewrite.
Disabling attribution and accepting an invented key both fail
`citationAccuracy`, which is what makes the citation metric load-bearing.
