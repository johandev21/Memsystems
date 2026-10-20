import {
  AGENT_TOOL_AREAS,
  type AgentToolDoc,
  toolsInArea,
} from './tool-catalog';

const DEFAULT_PORT = '4000';

const TOOL_RESULT_NOTE =
  'Every tool returns an MCP result with a human-readable `content` text block and, when available, a `structuredContent` object.';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

/** Base URL used when neither `PUBLIC_BASE_URL` nor a request host is set. */
export function defaultBaseUrl(port = process.env.PORT): string {
  const resolvedPort =
    port && port.trim().length > 0 ? port.trim() : DEFAULT_PORT;
  return `http://localhost:${resolvedPort}`;
}

/**
 * Resolves the absolute base URL for the generated docs. `PUBLIC_BASE_URL`
 * wins so deployments behind a proxy can publish a stable address; otherwise
 * the incoming request host is used.
 */
export function resolveBaseUrl(request?: {
  protocol?: string;
  get?: (name: string) => string | undefined;
}): string {
  const configured = process.env.PUBLIC_BASE_URL?.trim();
  if (configured) {
    return trimTrailingSlash(configured);
  }

  const host = request?.get?.('host');
  if (host) {
    return `${request?.protocol ?? 'http'}://${host}`;
  }

  return defaultBaseUrl();
}

function normalizedBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  return trimTrailingSlash(trimmed.length > 0 ? trimmed : defaultBaseUrl());
}

function toolBullets(): string {
  return AGENT_TOOL_AREAS.map((area) => {
    const lines = toolsInArea(area).map(
      (tool) => `- \`${tool.name}\` — ${tool.summary}`,
    );
    return `### ${area}\n\n${lines.join('\n')}`;
  }).join('\n\n');
}

function parameterLines(tool: AgentToolDoc): string {
  if (tool.parameters.length === 0) {
    return '- None.';
  }
  return tool.parameters
    .map(
      (parameter) =>
        `- \`${parameter.name}\` (${parameter.type}, ${
          parameter.required ? 'required' : 'optional'
        }) — ${parameter.description}`,
    )
    .join('\n');
}

function fullToolSections(): string {
  return AGENT_TOOL_AREAS.map((area) => {
    const tools = toolsInArea(area)
      .map((tool) =>
        [
          `#### \`${tool.name}\``,
          '',
          tool.summary,
          '',
          'Arguments:',
          '',
          parameterLines(tool),
          '',
          `Behavior: ${tool.behavior}`,
          '',
          `Agent Access: ${tool.readOnly ? 'read-only (allowed on read-only notebooks)' : 'mutation (requires On)'}.`,
        ].join('\n'),
      )
      .join('\n\n');
    return `### ${area}\n\n${tools}`;
  }).join('\n\n');
}

/**
 * `llms.txt`: the short, link-first index described by the llms.txt
 * convention. It is generated at request time so links always use the host the
 * caller reached.
 */
export function buildLlmsTxt(baseUrl: string): string {
  const base = normalizedBaseUrl(baseUrl);

  return `# Memsystems

> Memsystems is a single-user study workspace. A person collects sources in a notebook, chats with an AI grounded in those sources, and generates study materials from them. Local agent harnesses connect over the Model Context Protocol with an Agent Key created in Settings → Agent Access.

Memsystems exposes a local, stateless Streamable HTTP MCP endpoint at ${base}/api/mcp. It can list and create notebooks, add and read sources, ask grounded questions, and create, generate, and export study materials. Destructive tools are gated by workspace approval policies.

## MCP endpoint

- [MCP endpoint](${base}/api/mcp): Streamable HTTP. Send \`Authorization: Bearer msk_...\` on every request.
- [Full agent reference](${base}/llms-full.txt): connection, authentication, every tool argument, approvals, and errors.
- [OpenAPI document](${base}/api/openapi.json): the HTTP API that the web app uses.
- [API reference UI](${base}/api/docs): browsable Swagger UI for the HTTP API.

## Getting an Agent Key

1. Open Settings → Agent Access in the Memsystems web app.
2. Create an Agent Key with a descriptive name such as "Claude Code".
3. Copy the \`msk_...\` value immediately. It is shown once and stored only as a hash.
4. Send it as \`Authorization: Bearer <key>\`. Revoke the key in the same settings section to reject it immediately.

## Tools

${toolBullets()}

## Resources

- \`memsystems://schemas/quiz\` — JSON Schema (draft 2020-12) for quiz content.
- \`memsystems://schemas/simple_flashcard\` — JSON Schema for flashcard content.
- \`memsystems://schemas/roadmap\` — JSON Schema for roadmap content.
- \`memsystems://schemas/mind_map\` — JSON Schema for mind map content.
- \`memsystems://schemas/slides\` — JSON Schema for slides content.
- \`memsystems://study-materials/{id}\` — one study material with its kind-specific content.

## Prompts

- \`generate_quiz\` — generate a quiz with \`generate_study_material\`. Arguments: \`notebookId\`, optional \`topic\`, optional \`questionCount\`.
- \`author_quiz\` — write quiz content by hand and save it with \`create_study_material\`. Arguments: \`notebookId\`, optional \`topic\`.
- \`study_from_sources\` — list sources, wait for processing, generate a study material, and summarize it. Arguments: \`notebookId\`.

## Permissions and approvals

- Each notebook is **On**, **Read-only**, or **Off**. Read-only notebooks allow read tools but deny mutations; Off denies every tool. Notebooks without an override use the workspace default (On by default).
- Soft-deleting a study material follows the **Soft delete (to Trash)** policy: Allow runs it, Ask every time requests approval.
- Permanent deletes and emptying Trash follow **Permanent delete / empty Trash**: Never refuses, Ask every time requests approval.
- Deleting notebooks and sources follows **Delete notebooks, library folders, sources**: Never refuses, Ask every time requests approval.
- When a delete needs approval, the tool either asks the client directly (clients that declare form elicitation on a 2025-era connection) or creates a Pending Agent Action that expires after 15 minutes. Approve or reject it in Settings → Agent Access → Pending actions, or poll \`get_action_status\`.

## API reference

- [OpenAPI JSON](${base}/api/openapi.json)
- [Swagger UI](${base}/api/docs)
- [Full agent reference](${base}/llms-full.txt)
`;
}

/**
 * `llms-full.txt`: the self-contained agent reference. It repeats everything an
 * agent needs so no other document has to be fetched to use the endpoint.
 */
export function buildLlmsFullTxt(baseUrl: string): string {
  const base = normalizedBaseUrl(baseUrl);

  return `# Memsystems agent reference

> Memsystems is a single-user study workspace. A person collects sources in a notebook, chats with an AI grounded in those sources, and generates study materials from them. This document describes how a local agent harness connects to Memsystems over the Model Context Protocol (MCP), what each tool does, and how Agent Access and approvals work.

## Connection

- Endpoint: ${base}/api/mcp
- Transport: Streamable HTTP, stateless. The server creates a fresh MCP server per request and supports POST, GET, and DELETE.
- Authentication: \`Authorization: Bearer msk_...\` on every request.
- Network scope: local only. The endpoint accepts requests whose \`Host\` is \`localhost\`, \`127.0.0.1\`, or \`[::1]\` (any port). A browser \`Origin\` must also be local. Set \`AGENT_ALLOWED_HOSTS\` to a comma-separated list of extra hosts or origins when you intentionally proxy the endpoint. Non-local requests are rejected with HTTP 403.
- Protocol: standard MCP JSON-RPC. \`initialize\`, \`tools/list\`, \`tools/call\`, \`resources/list\`, \`resources/read\`, \`prompts/list\`, and \`prompts/get\` are available. Progress notifications and cancellation are supported.

${TOOL_RESULT_NOTE}

## Authentication

Agent Keys are named bearer credentials created in the Memsystems web app under Settings → Agent Access.

1. Open Settings → Agent Access.
2. Create a key and give it a name that identifies the harness.
3. Copy the \`msk_...\` value immediately. The full key is shown once; Memsystems stores only its hash and a short display prefix.
4. Send the key as \`Authorization: Bearer <key>\`.
5. Revoke the key in the same section to reject it immediately. Revocation is permanent for that key.

A missing or invalid key returns HTTP 401 with \`code: "agent_key_invalid"\`.

## Agent Access levels

Every notebook has an effective Agent Access level:

- **On** — agents may read and change the notebook.
- **Read-only** — agents may use read tools, but mutations are denied.
- **Off** — agents cannot use the notebook at all.

A notebook can set its own level or inherit the workspace default. The default is **On**. A notebook's response from \`list_notebooks\` or \`get_notebook\` includes both \`agentAccess\` (the resolved level) and \`agentAccessOverride\` (\`null\` when the notebook inherits).

Denied calls fail with an actionable tool error and are recorded in the Agent Audit Log with status \`denied\`.

## Tools

${fullToolSections()}

## Resources

- \`memsystems://schemas/quiz\` — JSON Schema (draft 2020-12) for quiz content.
- \`memsystems://schemas/simple_flashcard\` — JSON Schema for flashcard content.
- \`memsystems://schemas/roadmap\` — JSON Schema for roadmap content.
- \`memsystems://schemas/mind_map\` — JSON Schema for mind map content.
- \`memsystems://schemas/slides\` — JSON Schema for slides content.
- \`memsystems://study-materials/{id}\` — one study material with its kind-specific content.

The five schema resources are enumerable. Read the schema for a kind before calling \`create_study_material\` or \`update_study_material\`, and before interpreting the content returned by \`get_study_material\`. Reading \`memsystems://study-materials/{id}\` is refused when the material's notebook has Agent Access set to Off.

## Prompts

- \`generate_quiz\` — generates a quiz with \`generate_study_material\`. Arguments: \`notebookId\` (required), \`topic\` (optional, 1–500 characters), \`questionCount\` (optional integer, 1–50).
- \`author_quiz\` — writes quiz content by hand that matches \`memsystems://schemas/quiz\` and saves it with \`create_study_material\`. Arguments: \`notebookId\` (required), \`topic\` (optional, 1–500 characters).
- \`study_from_sources\` — lists sources, waits for processing, generates a study material, then summarizes it. Arguments: \`notebookId\` (required).

Prompts return one user message describing the workflow; they do not execute tools themselves.

## Permissions and approvals

Workspace policies are set in Settings → Agent Access. Defaults:

| Policy | Values | Default | Applies to |
| --- | --- | --- | --- |
| Soft delete (to Trash) | Allow, Ask every time | Ask every time | \`delete_study_material\` without \`permanent\` |
| Permanent delete / empty Trash | Never, Ask every time | Never | \`delete_study_material\` with \`permanent: true\`, \`empty_trash\` |
| Delete notebooks, library folders, sources | Never, Ask every time | Never | \`delete_notebook\`, \`delete_source\` |
| Default per-notebook agent access | On, Read-only, Off | On | Notebooks without their own override |

Folder deletion is not available through Agent Access yet.

When a policy allows the delete, it runs and the result has \`status: "deleted"\`.

When a policy refuses, the tool fails with an actionable error explaining which setting to change.

When a policy requires approval, one of two paths runs:

1. **In-chat elicitation** — if the connection uses the 2025-era protocol and the client declares form elicitation, Memsystems asks the user to confirm with a boolean \`confirm\` field. The delete runs only when the response is \`accept\` with \`confirm: true\`; anything else is reported as "Deletion was not approved." Modern-era clients and clients without form elicitation (including OpenCode) use the next path.
2. **Pending Agent Action** — Memsystems records the request and returns \`status: "awaiting_approval"\` with \`actionId\`, \`expiresAt\`, and the target summary. The user approves or rejects it in Settings → Agent Access → Pending actions. The agent can poll \`get_action_status\` with the \`actionId\`.

Pending Agent Actions expire 15 minutes after creation. Statuses are \`pending\`, \`approved\`, \`rejected\`, \`expired\`, and \`failed\`. Approval executes the delete and records the outcome in the Agent Audit Log.

Every tool call is recorded in the Agent Audit Log with the tool name, redacted arguments, status, Agent Key, and duration. Large payload fields such as text, content, and transcripts are redacted.

## Errors

Tool failures are normal MCP tool results with \`isError: true\`. The \`content\` text explains what failed and what to do next, for example changing an Agent Access setting or retrying after a source finishes processing. Agents should read that text rather than retrying blindly.

HTTP-level errors use a JSON body with \`statusCode\`, \`message\`, and \`code\`:

- \`401\` \`agent_key_invalid\` — the Authorization header is missing, malformed, or the key was revoked.
- \`403\` \`agent_origin_rejected\` — the \`Host\` or \`Origin\` is not local and is not listed in \`AGENT_ALLOWED_HOSTS\`.
- \`429\` \`agent_rate_limited\` — the rate limit for this scope was exceeded. The response includes a \`Retry-After\` header (seconds) and the same value as \`retryAfter\` in the body.

## Rate limits

Limits use an in-memory sliding one-minute window:

- MCP requests: 120 per minute, keyed by Agent Key.
- Chat requests: 60 per minute, keyed by client IP.
- Generation requests: 20 per minute, keyed by client IP.

Override them with \`AGENT_MCP_RATE_LIMIT\`, \`AGENT_CHAT_RATE_LIMIT\`, and \`AGENT_GENERATE_RATE_LIMIT\`.

## Workflow example

1. Create a notebook:
   \`create_notebook\` \`{ "title": "Cell biology" }\` → returns the notebook id.
2. Add sources to it:
   \`add_url_source\` \`{ "notebookId": "<id>", "url": "https://example.com/mitosis" }\`
   or \`add_text_source\` \`{ "notebookId": "<id>", "title": "Lecture notes", "rawText": "..." }\`.
3. Wait for extraction and indexing:
   \`wait_for_sources\` \`{ "notebookId": "<id>", "timeoutSeconds": 60 }\`.
   If the result has \`timedOut: true\`, call it again or continue with the sources that are ready.
4. Ask a grounded question:
   \`ask_notebook\` \`{ "notebookId": "<id>", "question": "Summarize the phases of mitosis." }\`
   The answer cites sources as R1, R2, and so on.
5. Generate a study material:
   \`generate_study_material\` \`{ "notebookId": "<id>", "kind": "quiz", "brief": "Ten questions about mitosis", "questionCount": 10 }\` → returns the material id and a summary.
6. Export or edit it:
   \`export_study_material\` \`{ "studyMaterialId": "<id>" }\` returns JSON, or base64 PPTX content for slides. Use \`update_study_material\` to correct the title or content.

## API reference

- OpenAPI JSON: ${base}/api/openapi.json
- Swagger UI: ${base}/api/docs
- Short agent index: ${base}/llms.txt
`;
}
