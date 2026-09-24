# Gate study-material generation on Gateway-reported structured output

Study Material Generation and practice-problem evaluation need a Model that returns schema-conforming output. The app used to treat `structuredOutput` as a hint and always attempt native structured output first: for an untagged model the Gateway accepted the request, ignored the response format, and streamed prose, so the AI SDK produced no parsable frames and the Generation dead-aired until the 5-minute stall watchdog instead of failing. The hand-curated capability table that fed the hint disagreed with the Gateway's own catalog in both directions. We decided that a Model may start a Generation or evaluate a practice answer only when the Gateway's public model list tags it `structured-output`; Model Capabilities — all of them, not just structured output — now come from that list during catalog sync, the curated table is retired as a capability source, and a Model whose capability data is not Gateway-fresh counts as incapable. Non-capable models stay selectable for Chat, which does not need structured output. Native structured output remains the first attempt for capable models, with the strict-JSON prompt and staged repair kept as a safety net plus a bounded no-output guard.

## Considered Options

- **Optimistic try with JSON fallback (status quo):** assumes every model might work; produced the dead-air hang and gave the user no way to tell which models work.
- **Soft warning, allow the attempt:** named the risk but still burned the timeout and left the outcome to the fallback.
- **Gate on the curated capability table:** would have blocked models the Gateway supports (`xiaomi/mimo-v2.6-pro`, `alibaba/qwen3-coder`) and allowed models it does not (`zai/glm-5-turbo`, `openai/gpt-5-pro`, `anthropic/claude-opus-5.5`).
- **Gate per provider endpoint:** `GET /v1/models/{creator}/{model}/endpoints` carries per-provider tags, but the model-level list is the union of its active endpoints (verified against the live API), and the Gateway routes providers automatically, so it adds no gate value today.

## Consequences

- Generation surfaces must block before starting and offer to switch model in place; the backend rejects a non-capable model as defense against stale clients. Chat is unaffected.
- The catalog sync must fetch the Gateway REST list directly; the AI SDK's `getAvailableModels()` strips the capability fields.
- Seed and offline catalogs cannot gate, so generation requires a successful Gateway sync. Without a key nothing generates anyway.
- A stale `structured-output` tag can still fail at runtime; the JSON fallback and the no-output guard keep that case honest and bounded instead of silent and long.
