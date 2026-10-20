# Agent access over MCP

Memsystems exposes a local [Model Context Protocol](https://modelcontextprotocol.io) endpoint so agent harnesses can work with notebooks, sources, chat, and study materials. The endpoint uses a stateless Streamable HTTP transport and authenticates every request with an Agent Key.

## Endpoint and local-only access

```text
http://localhost:4000/api/mcp
```

The MCP endpoint accepts only local callers:

- The `Host` header must be `localhost`, `127.0.0.1`, or `[::1]`, with any port.
- A browser `Origin` must also be local. Native MCP clients usually send no `Origin`.
- Non-local requests are rejected with HTTP 403 and `code: "agent_origin_rejected"`.

If you intentionally reach the backend through another hostname or proxy, list the extra hosts or origins in `AGENT_ALLOWED_HOSTS` as a comma-separated value:

```dotenv
AGENT_ALLOWED_HOSTS=memsystems.local,memsystems.local:4000
```

This is a local single-user app. Do not expose the MCP endpoint to the public internet.

## Create an Agent Key

1. Start the app and open **Settings → Agent Access**.
2. Under **Your keys**, create a key and give it a name that identifies the harness, such as `Claude Code`.
3. Copy the `msk_...` value immediately. It is shown once and stored only as a hash, so it cannot be recovered later.
4. Send the key on every MCP request as `Authorization: Bearer msk_...`.

Revoke a key from the same list to reject it immediately. Revocation cannot be undone; create a new key instead.

## Connect a client

Replace `msk_...` with your own key in every example. Never commit a real key.

### Claude Code

```bash
claude mcp add --transport http memsystems http://localhost:4000/api/mcp --header "Authorization: Bearer msk_..."
```

Claude Code stores the server in its local configuration and connects over Streamable HTTP.

### OpenCode

Add the server to `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "memsystems": {
      "type": "remote",
      "url": "http://localhost:4000/api/mcp",
      "headers": {
        "Authorization": "Bearer msk_..."
      },
      "enabled": true
    }
  }
}
```

OpenCode does not declare form elicitation, so approval-gated deletes use the [pending-action fallback](#approvals-and-pending-actions) instead of an in-chat prompt.

### stdio-only clients

Clients that cannot speak Streamable HTTP can bridge through `mcp-remote`:

```bash
npx mcp-remote http://localhost:4000/api/mcp --header "Authorization: Bearer msk_..."
```

Point the client's stdio command at that `npx` invocation.

## Workflow example

1. **Create a notebook** with `create_notebook` and keep the returned id.
2. **Add sources** with `add_text_source`, `add_url_source`, or `add_file_source`. Use `web_search_sources` and then `import_search_results` to bring in web candidates.
3. **Wait for processing** with `wait_for_sources`. It polls every 2 seconds, defaults to 60 seconds, accepts up to 120 seconds, and returns `timedOut: true` with the current sources if the deadline passes.
4. **Ask a question** with `ask_notebook`. The answer includes citations keyed R1, R2, and so on.
5. **Generate a study material** with `generate_study_material`, choosing a kind: `quiz`, `simple_flashcard`, `roadmap`, `mind_map`, or `slides`. Read `memsystems://schemas/{kind}` first when you need the content shape for hand-authored material.
6. **Export the result** with `export_study_material`. Slides return a base64 PPTX file; every other kind returns JSON content.

Use `list_notebooks`, `list_sources`, `list_study_materials`, and `get_study_material` to inspect existing work before changing it.

## Tool errors

Tool failures are returned as normal MCP tool results with `isError: true`. The text content explains the problem and the next step, for example that a source is still processing or that an Agent Access setting must change. Every call is recorded in the Agent Audit Log; denied calls use the `denied` status.

HTTP-level failures use a JSON body with `statusCode`, `message`, and `code`:

| Status | Code | Meaning |
| --- | --- | --- |
| `401` | `agent_key_invalid` | The Authorization header is missing, malformed, or the key was revoked. |
| `403` | `agent_origin_rejected` | The `Host` or `Origin` is not local and is not listed in `AGENT_ALLOWED_HOSTS`. |
| `429` | `agent_rate_limited` | The request exceeded its rate limit. Read the `Retry-After` header, in seconds. |

Example 401 body:

```json
{
  "statusCode": 401,
  "message": "The Agent Key is invalid or has been revoked. Create a new key in Settings.",
  "code": "agent_key_invalid"
}
```

## Permissions

Each notebook has one effective Agent Access level:

- **On** — agents can read and change the notebook.
- **Read-only** — agents can read, ask questions, and export, but every mutation is denied.
- **Off** — agents cannot use the notebook at all.

A notebook can set its own level or inherit the workspace default. The default is **On** and can be changed under **Settings → Agent Access → Default per-notebook agent access**. Set the override in the notebook's settings under **Agent access**.

## Approvals and pending actions

Delete tools consult the workspace policies under **Settings → Agent Access**:

| Policy | Values | Default | Applies to |
| --- | --- | --- | --- |
| Soft delete (to Trash) | Allow, Ask every time | Ask every time | `delete_study_material` without `permanent` |
| Permanent delete / empty Trash | Never, Ask every time | Never | `delete_study_material` with `permanent: true`, `empty_trash` |
| Delete notebooks and sources | Never, Ask every time | Never | `delete_notebook`, `delete_source` |

Folder deletion is not available through Agent Access yet.

When a policy is **Never**, the tool fails with an actionable error that names the setting to change. When a policy is **Allow**, the delete runs and returns `status: "deleted"`. When a policy is **Ask every time**, one of two approval paths runs:

- **In-chat elicitation** — when the client declares form elicitation and the connection can deliver a server-to-client request, the tool asks for confirmation with a `confirm` boolean. The delete runs only when the response is `accept` with `confirm: true`. Anything else is reported as "Deletion was not approved." Because `/api/mcp` is stateless, a failed delivery falls through to the pending-action queue instead of failing the tool call.
- **Pending Agent Action** — modern-era clients and clients without form elicitation, including OpenCode, get a Pending Agent Action instead. The tool returns `status: "awaiting_approval"` with an `actionId` and `expiresAt`.

A Pending Agent Action expires 15 minutes after creation. Review it in **Settings → Agent Access → Pending actions**, then approve or reject it. The agent can poll `get_action_status` with the `actionId` to learn the outcome. Approval executes the delete and records the result in the Agent Audit Log.

## Rate limits

Limits use an in-memory sliding one-minute window:

| Scope | Default | Keyed by | Environment override |
| --- | --- | --- | --- |
| MCP requests | 120 per minute | Agent Key | `AGENT_MCP_RATE_LIMIT` |
| Chat requests | 60 per minute | Client IP | `AGENT_CHAT_RATE_LIMIT` |
| Generation requests | 20 per minute | Client IP | `AGENT_GENERATE_RATE_LIMIT` |

A limited request returns HTTP 429 with `code: "agent_rate_limited"` and a `Retry-After` header.

## API reference

- [OpenAPI document](openapi.json)
- Swagger UI: `http://localhost:4000/api/docs`
- Agent guide: `http://localhost:4000/llms.txt`
- Full agent reference: `http://localhost:4000/llms-full.txt`
