const DEFAULT_PORT = '4000';

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

/**
 * `llms.txt`: the short, link-first index described by the llms.txt
 * convention. It is generated at request time so links always use the host the
 * caller reached.
 */
export function buildLlmsTxt(baseUrl: string): string {
  const base = normalizedBaseUrl(baseUrl);

  return `# Memsystems API

> Memsystems is a single-user study workspace. Users collect sources in a notebook, chat with an AI grounded in those sources, and generate study materials from them. The REST API is open and accessible directly with no API keys or tokens required.

Memsystems exposes an OpenAPI 3.1 REST API. You can list and create notebooks, add and read sources, ask grounded questions, and create, generate, and export study materials directly via standard HTTP requests.

## Core Endpoints

- [OpenAPI Document](${base}/api/openapi.json): Full OpenAPI 3.1 JSON schema describing every endpoint, parameter, and response model.
- [Swagger UI](${base}/api/docs): Interactive API documentation and test interface.
- [Full Reference](${base}/llms-full.txt): Complete endpoint catalog, schemas, headers, workflows, and payload examples.

### Notebooks
- \`GET /api/notebooks\` — List notebooks (supports pagination and title search).
- \`POST /api/notebooks\` — Create a notebook (\`{ title, description?, icon?, folderId? }\`).
- \`GET /api/notebooks/{id}\` — Retrieve a single notebook.
- \`PATCH /api/notebooks/{id}\` — Update notebook metadata.
- \`DELETE /api/notebooks/{id}\` — Delete notebook (moves to Trash).

### Sources
- \`GET /api/notebooks/{id}/sources\` — List sources in a notebook.
- \`POST /api/notebooks/{id}/sources/text\` — Add plain text source.
- \`POST /api/notebooks/{id}/sources/url\` — Add web page URL source.
- \`GET /api/sources/{id}\` — Get single source details and processing status.
- \`DELETE /api/sources/{id}\` — Delete a source.
- \`POST /api/notebooks/{id}/sources/search\` — Web search candidate sources.
- \`POST /api/notebooks/{id}/sources/search/import\` — Import web search results.

### Chat & Grounded QA
- \`POST /api/notebooks/{id}/chat\` — Send message and receive streaming grounded answer with citations.
- \`GET /api/notebooks/{id}/chat\` — Get chat history and citations.
- \`DELETE /api/notebooks/{id}/chat\` — Clear chat history.

### Study Materials
- \`GET /api/notebooks/{id}/study-materials\` — List study materials (quizzes, flashcards, roadmaps, mind maps, slides).
- \`POST /api/notebooks/{id}/study-materials\` — Create manual study material.
- \`GET /api/study-materials/{id}\` — Get study material with kind-specific content.
- \`PATCH /api/study-materials/{id}\` — Update study material.
- \`DELETE /api/study-materials/{id}\` — Delete study material.
- \`POST /api/notebooks/{id}/study-materials/generate\` — Generate new study material from sources.
- \`GET /api/study-materials/{id}/export\` — Export study material (JSON or PPTX for slides).

### Trash
- \`GET /api/trash\` — List deleted notebooks, sources, and study materials.
- \`POST /api/trash/restore/{id}\` — Restore an item from Trash.
- \`POST /api/trash/empty\` — Permanently empty the Trash.

## Authentication

No API keys or bearer tokens required. All requests to the local API execute directly.
`;
}

/**
 * `llms-full.txt`: the self-contained reference detailing endpoint contracts,
 * parameters, schemas, and workflows.
 */
export function buildLlmsFullTxt(baseUrl: string): string {
  const base = normalizedBaseUrl(baseUrl);

  return `# Memsystems Direct REST API Reference

> Memsystems is a single-user study workspace for collecting sources, asking questions grounded in evidence, and generating study materials.

## Base URL & Standards

- Base URL: ${base}/api
- Interactive Documentation: ${base}/api/docs
- OpenAPI 3.1 Spec: ${base}/api/openapi.json
- Content-Type: \`application/json\` (except file uploads and streaming endpoints)
- Authentication: None (direct local access)

---

## Workflow Recipes

### 1. Create a Notebook and Add Sources
\`\`\`http
POST ${base}/api/notebooks
Content-Type: application/json

{
  "title": "Quantum Computing Fundamentals",
  "description": "Research notes on qubits and quantum gates"
}
\`\`\`
Returns the created notebook object with \`id\`.

### 2. Ingest Text or Web Sources
\`\`\`http
POST ${base}/api/notebooks/{notebookId}/sources/text
Content-Type: application/json

{
  "title": "Quantum Superposition Notes",
  "text": "A qubit can be in a superposition of states |0> and |1>..."
}
\`\`\`
Sources process asynchronously into chunks and vector embeddings. Check completion:
\`\`\`http
GET ${base}/api/notebooks/{notebookId}/sources
\`\`\`
Look for \`processingStatus: "completed"\`.

### 3. Ask Questions Grounded in Sources
\`\`\`http
POST ${base}/api/notebooks/{notebookId}/chat
Content-Type: application/json

{
  "message": "Explain how phase kickback works based on the ingested sources."
}
\`\`\`
The response is returned as an event stream (\`text/event-stream\`) delivering tokens and citation references inline.

### 4. Generate Study Materials
Kinds supported: \`quiz\`, \`simple_flashcard\`, \`roadmap\`, \`mind_map\`, \`slides\`.
\`\`\`http
POST ${base}/api/notebooks/{notebookId}/study-materials/generate
Content-Type: application/json

{
  "kind": "quiz",
  "brief": "Key quantum algorithms including Deutsch-Jozsa and Shor's algorithm",
  "sourceIds": ["src_123"]
}
\`\`\`

### 5. Export Study Materials
\`\`\`http
GET ${base}/api/study-materials/{studyMaterialId}/export
\`\`\`
Returns JSON content for quizzes/flashcards/roadmaps/mind maps, or binary PPTX for slides.

---

## Detailed Endpoint Catalog

### Notebooks
- \`GET /api/notebooks\` — Query params: \`limit\`, \`offset\`, \`search\`.
- \`POST /api/notebooks\` — Body: \`{ title, description?, icon?, folderId? }\`.
- \`GET /api/notebooks/{id}\` — Returns notebook details including source and study material counts.
- \`PATCH /api/notebooks/{id}\` — Body: \`{ title?, description?, icon?, folderId? }\`.
- \`DELETE /api/notebooks/{id}\` — Deletes notebook and its contents to Trash.

### Sources
- \`GET /api/notebooks/{id}/sources\` — Lists all sources with chunking/processing state.
- \`POST /api/notebooks/{id}/sources/text\` — Body: \`{ title, text }\`.
- \`POST /api/notebooks/{id}/sources/url\` — Body: \`{ url, title? }\`.
- \`GET /api/sources/{id}\` — Returns source metadata, raw content preview, and chunks.
- \`DELETE /api/sources/{id}\` — Deletes source to Trash.
- \`POST /api/notebooks/{id}/sources/search\` — Body: \`{ query }\` — Web search candidate sources.
- \`POST /api/notebooks/{id}/sources/search/import\` — Body: \`{ urls: string[] }\` — Imports chosen web results.

### Study Materials
- \`GET /api/notebooks/{id}/study-materials\` — Filter by \`kind\` or \`folderId\`.
- \`POST /api/notebooks/{id}/study-materials\` — Body: \`{ title, kind, content }\`.
- \`GET /api/study-materials/{id}\` — Returns study material and JSON schema-validated payload.
- \`PATCH /api/study-materials/{id}\` — Body: \`{ title?, content? }\`.
- \`DELETE /api/study-materials/{id}\` — Deletes study material to Trash.

### Trash Management
- \`GET /api/trash\` — Lists soft-deleted items across notebooks, sources, and study materials.
- \`POST /api/trash/restore/{id}\` — Restores deleted item to its original location.
- \`POST /api/trash/empty\` — Permanently deletes all items in Trash.
`;
}
