# Vercel AI SDK Codex harness research

**Date:** 2026-08-26  
**Scope:** official Vercel AI SDK, Vercel Sandbox, and OpenAI Codex documentation/source; no application code changed.

## Conclusion

Codex must not be added to the existing OpenAI `LanguageModel` factory as if it were another model provider. Vercel defines harnesses as a separate abstraction: model providers are passed to `generateText`/`streamText`, while agent runtimes such as Codex are passed to `HarnessAgent`. A Codex turn is invoked with `HarnessAgent.generate()` or `HarnessAgent.stream()` and requires an explicit live session and network sandbox. Those methods return AI SDK-compatible `GenerateTextResult` and `StreamTextResult` shapes, so the app can normalize both execution paths at its stream/UI boundary rather than pretending they share the same invocation contract. ([Harness overview](https://ai-sdk.dev/docs/ai-sdk-harnesses/overview); [HarnessAgent](https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-agent))

The recommended architecture is therefore a discriminated runtime boundary:

```text
model runtime   -> LanguageModel -> streamText / generateText
harness runtime -> HarnessAgent  -> agent.stream / agent.generate + session
                                      |
                                      v
                         shared AI SDK stream/UI projection
```

The harness packages are explicitly **experimental** and may introduce breaking changes between releases. Any implementation should pin a tested package set and hide the experimental API behind an app-owned adapter. ([Codex harness](https://ai-sdk.dev/providers/ai-sdk-harnesses/codex#codex-harness))

## Package and runtime baseline

The documented installation is:

```bash
pnpm add @ai-sdk/harness @ai-sdk/harness-codex @ai-sdk/sandbox-vercel
```

The canonical imports and constructor shape are:

```ts
import { HarnessAgent } from '@ai-sdk/harness/agent';
import { codex, createCodex } from '@ai-sdk/harness-codex';
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel';

const agent = new HarnessAgent({
  harness: createCodex({
    model: 'gpt-5.5',
    reasoningEffort: 'high',
  }),
  sandbox: createVercelSandbox({
    runtime: 'node24',
    ports: [4000],
  }),
  permissionMode: 'allow-all',
});
```

`codex` is equivalent to `createCodex()` with defaults. The first session bootstraps the Codex bridge, `@openai/codex-sdk`, and the Codex CLI inside the sandbox. ([Codex harness](https://ai-sdk.dev/providers/ai-sdk-harnesses/codex#codex-harness); [adapter README](https://github.com/vercel/ai/tree/main/packages/harness-codex#readme))

Registry versions observed on 2026-08-26 form this known-compatible baseline:

| Package | Published version | Relevant constraint |
| --- | ---: | --- |
| `@ai-sdk/harness-codex` | `1.0.89` | depends on `@ai-sdk/harness@1.0.87`; Node `>=22` |
| `@ai-sdk/harness` | `1.0.87` | depends on `ai@7.0.79`; Node `>=22` |
| `@ai-sdk/sandbox-vercel` | `1.0.87` | depends on `@ai-sdk/harness@1.0.87`; Node `>=22` |
| Embedded `@openai/codex-sdk` bridge dependency | `0.144.5` | installed in the sandbox by the adapter bootstrap |

These values are a dated compatibility snapshot, not floating recommendations; re-check the registry and changelogs immediately before implementation. ([harness-codex registry metadata](https://registry.npmjs.org/@ai-sdk%2fharness-codex/1.0.89); [harness registry metadata](https://registry.npmjs.org/@ai-sdk%2fharness/1.0.87); [sandbox-vercel registry metadata](https://registry.npmjs.org/@ai-sdk%2fsandbox-vercel/1.0.87); [adapter package source](https://github.com/vercel/ai/blob/main/packages/harness-codex/package.json))

## Codex adapter settings

`createCodex(settings)` currently exposes:

- `auth`: `auto`, `direct`, or `ai-gateway`.
- `credentialForwarding`: sync/async transformation immediately before a credential is forwarded into the sandbox. It does **not** prevent discovery or reading of host credentials by the adapter.
- `codexConfig`: pass-through native Codex settings using the snake_case keys from `config.toml`; adapter-managed values win conflicts.
- `mcpServers`: native Codex MCP definitions keyed by server name.
- `model`: an OpenAI model ID string; omission selects the adapter's pinned default.
- `reasoningEffort`: `low`, `medium`, or `high` at this adapter surface.
- `webSearch`: enables live web search.
- `port` and, for a basic sandbox session, `portEndpoint`: bridge networking overrides.
- `startupTimeoutMs`: bridge startup timeout; current source defaults to 120 seconds.
- `mintBridgeToken`: custom bridge-token factory; otherwise the adapter creates a random 32-byte token.

The adapter supports schema-backed structured output by passing JSON Schema to the Codex SDK's native `outputSchema` turn option. ([Codex harness](https://ai-sdk.dev/providers/ai-sdk-harnesses/codex#codex-harness); [adapter source](https://github.com/vercel/ai/blob/main/packages/harness-codex/src/codex-harness.ts); [Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference))

## Authentication

The harness documentation lists these supported environment variables:

- Sandbox: `VERCEL_OIDC_TOKEN`.
- Gateway: `AI_GATEWAY_API_KEY`, `AI_GATEWAY_BASE_URL`, or Vercel OIDC where supported.
- Direct/OpenAI-compatible: `OPENAI_API_KEY` or `CODEX_API_KEY`, plus optional `OPENAI_BASE_URL`, `OPENAI_ORGANIZATION`, and `OPENAI_PROJECT`.

`auth: 'auto'` prefers Vercel AI Gateway credentials and falls back to direct OpenAI credentials. Use `auth: 'direct'` to force OpenAI or an OpenAI-compatible endpoint, with `OPENAI_BASE_URL` for the latter; use `auth: 'ai-gateway'` to force Gateway. When the sandbox supports request transformations, the bridge receives masked placeholders and the adapter injects credentials into matching outbound requests. Otherwise, credentials are forwarded directly into the sandbox process. ([Codex harness authentication](https://ai-sdk.dev/providers/ai-sdk-harnesses/codex#authentication); [adapter auth source](https://github.com/vercel/ai/blob/main/packages/harness-codex/src/codex-auth.ts))

For local Vercel Sandbox development, the official setup is `vercel link` followed by `vercel env pull`; Vercel then writes a development `VERCEL_OIDC_TOKEN`. Vercel deployments receive authentication automatically. Non-Vercel deployments require a deliberate Vercel Sandbox authentication setup rather than assuming the local Docker environment can create sandboxes by itself. ([Vercel Sandbox](https://vercel.com/docs/sandbox); [Vercel Sandbox quickstart](https://vercel.com/docs/sandbox/quickstart); [Vercel OIDC](https://vercel.com/docs/oidc))

OpenAI's general Codex CLI supports browser/ChatGPT login and cached local credentials, but the Vercel harness adapter documents environment-key/Gateway resolution, not an interactive subscription login inside its remote sandbox. Do not design around a user's local `~/.codex/auth.json` unless Vercel documents that mode for this adapter. API-key authentication is OpenAI's recommended default for programmatic automation. ([OpenAI authentication](https://learn.chatgpt.com/docs/auth))

## Models and capabilities

- The adapter accepts a model ID string but neither Vercel nor OpenAI publishes an exhaustive harness-compatible model list.
- The current adapter source pins `gpt-5.5` as its default. Its source comment says newer GPT-5.6 code-mode tools are not callable through the custom provider path because of an upstream Responses Lite issue. Treat any non-default model, especially GPT-5.6 variants, as unsupported until an end-to-end harness test proves text, tools, and streaming all work. ([adapter source](https://github.com/vercel/ai/blob/main/packages/harness-codex/src/codex-harness.ts))
- Normalized built-ins currently include `bash` and `webSearch`; additional native tools may surface dynamically. Some opaque Codex file mutations appear as dynamic `fileChange` tool parts. ([Codex harness built-ins](https://ai-sdk.dev/providers/ai-sdk-harnesses/codex#built-in-tools))
- Host-executed AI SDK tools, MCP servers, text/reasoning streaming, usage/steps, and schema-backed structured output are supported. ([Harness tools](https://ai-sdk.dev/docs/ai-sdk-harnesses/tools); [adapter capability matrix](https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-adapters))
- The underlying Codex SDK can accept local images, but the current harness adapter rejects non-text user message parts. The first implementation should expose text-only prompts rather than silently discarding attachments. ([Codex SDK](https://github.com/openai/codex/blob/main/sdk/typescript/README.md); [adapter prompt extraction](https://github.com/vercel/ai/blob/main/packages/harness-codex/src/codex-harness.ts))

## `generateText` and `streamText` compatibility

The adapter value returned by `createCodex()` implements the harness contract, not the AI SDK `LanguageModel` contract. Therefore these are invalid integration shapes:

```ts
generateText({ model: codex, prompt });
streamText({ model: codex, prompt });
```

The equivalent calls are session-aware:

```ts
const session = await agent.createSession({ sessionId });
const generated = await agent.generate({ session, prompt });
const streamed = await agent.stream({ session, prompt });
```

`generate()` returns an AI SDK-compatible `GenerateTextResult`; `stream()` returns an AI SDK-compatible `StreamTextResult`. Consumers can still use `text`, `stream`, `steps`, `usage`, and `responseMessages`. For AI SDK UI, merge `toUIMessageStream({ stream: result.stream })` into `createUIMessageStreamResponse`; `useChat` remains usable. The server route must inject the harness session, so `createAgentUIStreamResponse` is not directly applicable without a wrapper. ([Harness overview](https://ai-sdk.dev/docs/ai-sdk-harnesses/overview#compatible-streams); [Harness UI integration](https://ai-sdk.dev/docs/ai-sdk-harnesses/ui))

## Session and thread behavior

A harness session owns the Codex runtime, sandbox working directory, native conversation history, and pending interactions. This differs fundamentally from stateless model calls:

- Construct `HarnessAgent` at module scope; that object holds configuration, not a live session.
- Create or resume one session per logical chat/run using a stable `sessionId`.
- Passing the full UI/model message history does not replay it into Codex. `HarnessAgent` takes the latest user message as the new turn because the native session already owns history.
- Persist the opaque resume state returned by `detach()` or `stop()` in durable server-side storage, keyed to the chat/session ID.
- `detach()` parks a warm runtime/sandbox; `stop()` saves resumable state and stops it; `destroy()` discards resumability. Unfinished turns use `suspendTurn()` plus `continueStream()`/`continueGenerate()`.
- Resume with the original `sessionId` and `resumeFrom`; never send opaque resume state to the browser.

The underlying Codex SDK similarly models repeat turns on a thread and can reconstruct a persisted thread with `resumeThread(threadId)`. ([HarnessAgent session lifecycle](https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-agent#session-lifecycle); [Harness UI session store](https://ai-sdk.dev/docs/ai-sdk-harnesses/ui#session-store); [OpenAI Codex SDK](https://learn.chatgpt.com/docs/codex-sdk))

**Security inference:** current adapter state can include bridge coordinates and a bearer-like bridge token. Treat opaque resume state as sensitive: keep it server-side, enforce ownership checks, encrypt it at rest where appropriate, and apply retention/cleanup. This follows from the adapter's published lifecycle-state implementation rather than an explicit Vercel storage prescription. ([adapter lifecycle source](https://github.com/vercel/ai/blob/main/packages/harness-codex/src/codex-harness.ts))

## Filesystem, sandbox, and deployment constraints

Codex is bridge-backed and requires a **network sandbox with at least one exposed port**. The documented supported provider is `@ai-sdk/sandbox-vercel`; the adapter runs a bridge in the sandbox and communicates with it over a sandbox-exposed WebSocket. ([Codex harness sandbox requirement](https://ai-sdk.dev/providers/ai-sdk-harnesses/codex#sandbox); [HarnessAgent sandbox requirements](https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-agent))

This means the Codex workspace is a remote sandbox filesystem, not automatically the NestJS process filesystem or the local Docker bind mount. Repository/source material must be intentionally seeded into the session via the sandbox source, `sandboxConfig.onBootstrap`, `sandboxConfig.onSession`, or sandbox file APIs. A configured `workDir` is relative to the sandbox's default working directory. ([HarnessAgent sandbox preparation](https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-agent#prepare-the-sandbox))

Vercel Sandbox runs isolated Linux Firecracker microVMs. Persistent sandboxes snapshot their filesystem by default when stopped; explicit snapshots can reduce repeated bootstrap cost. Current documented limits include a five-minute default session timeout, 45-minute maximum on Hobby, 24-hour maximum on Pro/Enterprise, plan-dependent concurrency, metered compute/memory/egress, and snapshot storage charges. These operational costs and limits must be part of rollout design. ([Vercel Sandbox isolation](https://vercel.com/docs/sandbox); [working with Sandbox](https://vercel.com/docs/sandbox/working-with-sandbox); [Sandbox pricing and limits](https://vercel.com/docs/sandbox/pricing); [snapshots](https://vercel.com/docs/sandbox/concepts/snapshots))

## Security constraints

The Codex adapter currently does not support approval requests or filtering for its built-in tools. It requires `permissionMode: 'allow-all'`; trying to filter built-ins such as `bash` or `webSearch` throws. Host-executed AI SDK tool filtering and approval still work. The sandbox filesystem, outbound network rules, exposed host tools, and credential boundary are therefore the primary safety controls. ([Codex known limitations](https://ai-sdk.dev/providers/ai-sdk-harnesses/codex#known-limitations); [adapter capability matrix](https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-adapters))

Practical consequences:

- Do not expose production secrets, database sockets, Docker sockets, or the backend host filesystem to the sandbox by default.
- Give host-executed tools narrow schemas and least-privilege implementations; they run in the host process even though Codex runs remotely.
- Apply an outbound network allowlist appropriate to model/Gateway, package bootstrap, and explicitly enabled web/MCP access.
- Keep the bridge port/token internal and secret.
- Pin `@ai-sdk/harness-codex` above `1.0.28`. Versions through `1.0.28` had a host-tool relay authorization bypass; `1.0.29` patched it. ([Vercel security advisory GHSA-qw9h-448j-6rph](https://github.com/vercel/ai/security/advisories/GHSA-qw9h-448j-6rph))

## Differences from the OpenAI provider path

| Concern | OpenAI/AI Gateway model provider | Codex harness |
| --- | --- | --- |
| Core abstraction | `LanguageModel` | `HarnessAgent` + Codex harness adapter |
| Invocation | `generateText` / `streamText` | `agent.generate` / `agent.stream` |
| State | App usually resends message history | Native session/thread owns history |
| Execution environment | Model call; app tools run where configured | Codex CLI, built-ins, and workspace run in a network sandbox |
| Files | Prompt/file inputs to a model | Mutable sandbox workspace; current adapter prompt is text-only |
| Lifecycle | Request-scoped model call | create, detach/stop/destroy, persist, resume, continue |
| Permissions | App controls its tool loop | Codex built-ins currently require `allow-all`; host tools remain controllable |
| UI contract | AI SDK model stream | AI SDK-compatible harness stream after session-aware invocation |
| Cost/operations | Model/token/API concerns | Model usage plus sandbox startup, compute, memory, egress, persistence |

The OpenAI provider remains the right path for ordinary chat/RAG/model calls. Codex is appropriate only when the product intentionally wants a coding agent with a mutable workspace, shell/tool execution, and native multi-turn runtime. ([OpenAI provider](https://ai-sdk.dev/providers/ai-sdk-providers/openai); [Harness overview](https://ai-sdk.dev/docs/ai-sdk-harnesses/overview#when-to-use-a-harness))

## Decisions required before implementation

1. Decide whether Codex is allowed to mutate a project workspace or should only answer questions over study sources. The latter may not justify a coding harness.
2. Define a separate `model` versus `harness` runtime type and share only normalized catalog/stream/UI contracts.
3. Decide how notebooks map to stable harness `sessionId` values and where opaque resume state is durably stored, secured, expired, and cleaned up.
4. Define exactly what files/sources are materialized into the remote workspace and whether changes are ever copied back.
5. Choose direct OpenAI versus AI Gateway authentication and define Docker, test, preview, and production credential injection separately.
6. Establish sandbox filesystem and outbound-network policy before enabling Codex because built-in approvals/filtering are unavailable.
7. Pin and test the package set, including Node 22+, AI SDK 7 compatibility, bootstrap behavior, disconnect/resume, cancellation, error mapping, and cleanup.
8. Limit the initial model catalog to the pinned default `gpt-5.5` until other model IDs pass a real tool-and-stream integration test.

### Documented unknowns

- No exhaustive list of model IDs compatible with the Codex harness is published.
- No interactive ChatGPT/Codex subscription authentication mode is documented for this adapter.
- Vercel does not provide a fixed bridge/bootstrap latency figure; measure it in the target regions and deployment environment.
- The right source-to-workspace and change-persistence policy is a product decision, not something the harness can infer.
