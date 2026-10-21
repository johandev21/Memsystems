# Direct REST API Access

Memsystems exposes an OpenAPI 3.1 REST API that allows agent harnesses, tools, and scripts to work directly with notebooks, sources, chat, and study materials using standard HTTP requests.

## API Documentation Endpoints

When running locally (Native or Docker):

- **Swagger UI**: `http://localhost:3000/api/docs` (Docker) or `http://localhost:4000/api/docs` (Native)
- **OpenAPI 3.1 Specification**: `http://localhost:3000/api/openapi.json` (Docker) or `http://localhost:4000/api/openapi.json` (Native)
- **Static OpenAPI JSON**: [`docs/openapi.json`](./openapi.json)
- **Agent Guide (llms.txt)**: `http://localhost:3000/llms.txt`
- **Full Reference (llms-full.txt)**: `http://localhost:3000/llms-full.txt`

## Authentication

No API keys or authentication headers are required. All endpoints accept direct requests.

## Core Workflows

### 1. Create a Notebook
```bash
curl -X POST http://localhost:3000/api/notebooks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Agent Research Notebook",
    "description": "Collected research materials"
  }'
```

### 2. Ingest Sources
Add plain text:
```bash
curl -X POST http://localhost:3000/api/notebooks/{notebookId}/sources/text \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Executive Summary",
    "text": "Full text content to index..."
  }'
```

Add web page:
```bash
curl -X POST http://localhost:3000/api/notebooks/{notebookId}/sources/url \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/article",
    "title": "Reference Article"
  }'
```

Check source indexing status:
```bash
curl http://localhost:3000/api/notebooks/{notebookId}/sources
```

### 3. Ask Questions Grounded in Evidence
```bash
curl -N -X POST http://localhost:3000/api/notebooks/{notebookId}/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Summarize the primary conclusions from the sources."
  }'
```
Responses stream back as Server-Sent Events with inline citations (`[ref:R1]`) and grounded evidence citations in the stream summary.

### 4. Generate Study Materials
Generate a Quiz, Flashcard set, Roadmap, Mind Map, or Slide deck:
```bash
curl -N -X POST http://localhost:3000/api/notebooks/{notebookId}/study-materials/generate \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "quiz",
    "brief": "Key concepts and practice questions"
  }'
```

Export generated materials:
```bash
curl http://localhost:3000/api/study-materials/{studyMaterialId}/export
```
