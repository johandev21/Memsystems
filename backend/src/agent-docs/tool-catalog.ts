/**
 * Single source of truth for the agent-facing MCP documentation.
 *
 * `llms.txt` and `llms-full.txt` are generated from this catalog, and the
 * catalog test compares it against the tools the MCP server actually
 * registers. Keep the names and arguments in sync with
 * `src/modules/agent-access/mcp/tools/*.ts`.
 */

export const AGENT_TOOL_AREAS = [
  'Notebooks',
  'Sources',
  'Chat',
  'Study materials',
  'Deletes',
] as const;

export type AgentToolArea = (typeof AGENT_TOOL_AREAS)[number];

export interface AgentToolParameter {
  name: string;
  /** Short type label, for example `string`, `integer`, `boolean`. */
  type: string;
  required: boolean;
  description: string;
}

export interface AgentToolDoc {
  name: string;
  area: AgentToolArea;
  /** One-line description used by `llms.txt`. */
  summary: string;
  /** Longer behaviour and return-value notes used by `llms-full.txt`. */
  behavior: string;
  /** Read-only tools stay available on read-only notebooks. */
  readOnly: boolean;
  parameters: AgentToolParameter[];
}

export const AGENT_TOOL_CATALOG: readonly AgentToolDoc[] = [
  {
    name: 'list_notebooks',
    area: 'Notebooks',
    summary:
      'List the study notebooks in this workspace, with optional search and pagination.',
    behavior:
      'Returns every notebook with its id, title, description, icon, grounding mode, resolved Agent Access level, and Agent Access override. Use the id with the source, chat, and study material tools.',
    readOnly: true,
    parameters: [
      {
        name: 'search',
        type: 'string',
        required: false,
        description:
          'Case-insensitive title/description search. 1–200 characters.',
      },
      {
        name: 'limit',
        type: 'integer',
        required: false,
        description: 'Page size, 1–100. Defaults to 50.',
      },
      {
        name: 'offset',
        type: 'integer',
        required: false,
        description: 'Number of notebooks to skip. Defaults to 0.',
      },
    ],
  },
  {
    name: 'create_notebook',
    area: 'Notebooks',
    summary:
      'Create a study notebook before adding sources or asking questions.',
    behavior:
      'Creates an empty notebook and returns its summary. No Agent Access check applies because the notebook does not exist yet.',
    readOnly: false,
    parameters: [
      {
        name: 'title',
        type: 'string',
        required: true,
        description: 'Notebook title. 1–200 characters.',
      },
      {
        name: 'description',
        type: 'string',
        required: false,
        description: 'Short description, at most 500 characters.',
      },
      {
        name: 'icon',
        type: 'string',
        required: false,
        description: 'Icon name, at most 50 characters.',
      },
    ],
  },
  {
    name: 'get_notebook',
    area: 'Notebooks',
    summary: 'Get one notebook, including its grounding mode and access level.',
    behavior:
      'Returns the same summary shape as `list_notebooks` for one notebook id.',
    readOnly: true,
    parameters: [
      {
        name: 'notebookId',
        type: 'string',
        required: true,
        description: 'Notebook id.',
      },
    ],
  },
  {
    name: 'list_sources',
    area: 'Sources',
    summary: 'List the sources in a notebook and their processing status.',
    behavior:
      'Returns source ids, titles, kinds, URLs, content types, processing status/stage, and processing errors. Source text is not included; use `get_source` for extracted segments.',
    readOnly: true,
    parameters: [
      {
        name: 'notebookId',
        type: 'string',
        required: true,
        description: 'Notebook id.',
      },
      {
        name: 'limit',
        type: 'integer',
        required: false,
        description:
          'Maximum number of sources to return, 1–300. Defaults to 100.',
      },
    ],
  },
  {
    name: 'get_source',
    area: 'Sources',
    summary: 'Read one source with its first 20 extracted segments.',
    behavior:
      'Returns the source summary, up to 20 segments (each text truncated to 2000 characters), the total segment count, and the indexing status. When `notebookId` is omitted, the source notebook is looked up and its Agent Access level is checked.',
    readOnly: true,
    parameters: [
      {
        name: 'sourceId',
        type: 'string',
        required: true,
        description: 'Source id.',
      },
      {
        name: 'notebookId',
        type: 'string',
        required: false,
        description:
          'Notebook id to check against. Optional; must match the source notebook when provided.',
      },
    ],
  },
  {
    name: 'add_text_source',
    area: 'Sources',
    summary:
      'Add a text source (notes, pasted article, transcript) to a notebook.',
    behavior:
      'Creates a text source and starts background extraction and indexing. Returns the new source summary with its processing status.',
    readOnly: false,
    parameters: [
      {
        name: 'notebookId',
        type: 'string',
        required: true,
        description: 'Notebook id.',
      },
      {
        name: 'title',
        type: 'string',
        required: true,
        description: 'Source title. 1–500 characters.',
      },
      {
        name: 'rawText',
        type: 'string',
        required: true,
        description: 'The text to ingest.',
      },
    ],
  },
  {
    name: 'add_url_source',
    area: 'Sources',
    summary: 'Add a web page as a source.',
    behavior:
      'Fetches the page and starts background extraction and indexing. Returns the new source summary with its processing status.',
    readOnly: false,
    parameters: [
      {
        name: 'notebookId',
        type: 'string',
        required: true,
        description: 'Notebook id.',
      },
      {
        name: 'url',
        type: 'string',
        required: true,
        description: 'Absolute URL, at most 4000 characters.',
      },
      {
        name: 'title',
        type: 'string',
        required: false,
        description: 'Optional title override. 1–500 characters.',
      },
    ],
  },
  {
    name: 'add_file_source',
    area: 'Sources',
    summary: 'Add a file from base64 content.',
    behavior:
      'Decodes the base64 payload, enforces a 50 MB decoded limit, and starts background extraction and indexing. Returns the new source summary. Send raw base64 only: no data URL prefix.',
    readOnly: false,
    parameters: [
      {
        name: 'notebookId',
        type: 'string',
        required: true,
        description: 'Notebook id.',
      },
      {
        name: 'filename',
        type: 'string',
        required: true,
        description:
          'File name including extension, so the extractor can choose a parser. 1–500 characters.',
      },
      {
        name: 'contentType',
        type: 'string',
        required: true,
        description:
          'MIME type, for example `application/pdf`. 1–200 characters.',
      },
      {
        name: 'contentBase64',
        type: 'string',
        required: true,
        description:
          'Base64 file content. The decoded file must be at most 50 MB.',
      },
      {
        name: 'title',
        type: 'string',
        required: false,
        description: 'Optional title override. 1–500 characters.',
      },
    ],
  },
  {
    name: 'wait_for_sources',
    area: 'Sources',
    summary:
      'Wait until sources finish processing, polling every 2 seconds for up to 120 seconds.',
    behavior:
      'Returns `timedOut: false` and the tracked sources when every tracked source reaches a terminal status (ready, degraded, failed, or cancelled). Returns `timedOut: true` with the current sources when the deadline is reached. Without `sourceIds`, waits for every in-flight source; if nothing is processing, reports the notebook sources as-is. Sends progress notifications when the client provides a progress token.',
    readOnly: true,
    parameters: [
      {
        name: 'notebookId',
        type: 'string',
        required: true,
        description: 'Notebook id.',
      },
      {
        name: 'sourceIds',
        type: 'string[]',
        required: false,
        description:
          'Only wait for these source ids. Up to 300 ids; each must exist in the notebook.',
      },
      {
        name: 'timeoutSeconds',
        type: 'integer',
        required: false,
        description: 'Wait budget in seconds, 1–120. Defaults to 60.',
      },
    ],
  },
  {
    name: 'web_search_sources',
    area: 'Sources',
    summary: 'Search the web for candidate sources.',
    behavior:
      'Returns a query summary and candidate titles, URLs, and descriptions. Candidates are not imported; pass the ones you want to `import_search_results`.',
    readOnly: true,
    parameters: [
      {
        name: 'notebookId',
        type: 'string',
        required: true,
        description: 'Notebook id used for the search context.',
      },
      {
        name: 'query',
        type: 'string',
        required: true,
        description: 'Search query. 1–500 characters.',
      },
    ],
  },
  {
    name: 'import_search_results',
    area: 'Sources',
    summary: 'Import selected web search candidates as sources.',
    behavior:
      'Adds between 1 and 10 candidates, fetching and indexing each in the background. Returns one result per candidate with `status`, the new `sourceId` when added, and an `error` when it failed.',
    readOnly: false,
    parameters: [
      {
        name: 'notebookId',
        type: 'string',
        required: true,
        description: 'Notebook id.',
      },
      {
        name: 'query',
        type: 'string',
        required: true,
        description:
          'The search query the candidates came from. 1–500 characters.',
      },
      {
        name: 'candidates',
        type: 'object[]',
        required: true,
        description:
          '1–10 candidates. Each item has `url` (required, absolute), `title` (optional), and `description` (optional, at most 500 characters).',
      },
    ],
  },
  {
    name: 'ask_notebook',
    area: 'Chat',
    summary:
      'Ask a question grounded in one notebook and return the answer with citations.',
    behavior:
      'Runs one Chat turn, waits for the assistant reply to be persisted, and returns the answer text plus citations (key such as R1, number, source title, kind, optional URL and quote). Available on read-only notebooks because it does not change notebook content. Uses the server default model when `model` is omitted.',
    readOnly: true,
    parameters: [
      {
        name: 'notebookId',
        type: 'string',
        required: true,
        description: 'Notebook id.',
      },
      {
        name: 'question',
        type: 'string',
        required: true,
        description: 'Question text. 1–8000 characters.',
      },
      {
        name: 'model',
        type: 'string',
        required: false,
        description:
          'Model identifier to use for this turn. Optional; 1–200 characters.',
      },
    ],
  },
  {
    name: 'list_study_materials',
    area: 'Study materials',
    summary: 'List the study materials in a notebook.',
    behavior:
      'Returns id, kind, title, folder id, and timestamps for each study material, optionally filtered by kind or study material folder. Use `get_study_material` to read the content.',
    readOnly: true,
    parameters: [
      {
        name: 'notebookId',
        type: 'string',
        required: true,
        description: 'Notebook id.',
      },
      {
        name: 'kind',
        type: 'string',
        required: false,
        description:
          'One of `quiz`, `simple_flashcard`, `roadmap`, `mind_map`, or `slides`.',
      },
      {
        name: 'folderId',
        type: 'string',
        required: false,
        description: 'Only materials in this study material folder.',
      },
    ],
  },
  {
    name: 'get_study_material',
    area: 'Study materials',
    summary: 'Get one study material with its full kind-specific content.',
    behavior:
      'Returns the material metadata and content object. Read `memsystems://schemas/{kind}` first to understand the content shape.',
    readOnly: true,
    parameters: [
      {
        name: 'studyMaterialId',
        type: 'string',
        required: true,
        description: 'Study material id.',
      },
    ],
  },
  {
    name: 'create_study_material',
    area: 'Study materials',
    summary: 'Save a hand-authored study material.',
    behavior:
      'Creates a material from a content object that must match `memsystems://schemas/{kind}` for the chosen kind. Returns the new id, kind, title, folder id, and creation time.',
    readOnly: false,
    parameters: [
      {
        name: 'notebookId',
        type: 'string',
        required: true,
        description: 'Notebook id.',
      },
      {
        name: 'kind',
        type: 'string',
        required: true,
        description:
          'One of `quiz`, `simple_flashcard`, `roadmap`, `mind_map`, or `slides`.',
      },
      {
        name: 'title',
        type: 'string',
        required: true,
        description: 'Material title. 1–200 characters.',
      },
      {
        name: 'content',
        type: 'object',
        required: true,
        description:
          'Kind-specific content object. Must satisfy the matching schema resource.',
      },
      {
        name: 'folderId',
        type: 'string',
        required: false,
        description: 'Study material folder that should contain the material.',
      },
    ],
  },
  {
    name: 'update_study_material',
    area: 'Study materials',
    summary: 'Change the title or content of an existing study material.',
    behavior:
      'Provide at least one of `title` or `content`. Returns the updated id, kind, title, folder id, and update time.',
    readOnly: false,
    parameters: [
      {
        name: 'studyMaterialId',
        type: 'string',
        required: true,
        description: 'Study material id.',
      },
      {
        name: 'title',
        type: 'string',
        required: false,
        description: 'New title. 1–200 characters.',
      },
      {
        name: 'content',
        type: 'object',
        required: false,
        description:
          'New kind-specific content object. Must satisfy the matching schema resource.',
      },
    ],
  },
  {
    name: 'generate_study_material',
    area: 'Study materials',
    summary:
      'Generate one study material from a brief and the notebook sources.',
    behavior:
      'Runs a Generation and returns the new material id, request id, kind, title, a short summary, and grounding limits. Progress notifications are sent when the client provides a progress token; cancelling the request aborts the Generation.',
    readOnly: false,
    parameters: [
      {
        name: 'notebookId',
        type: 'string',
        required: true,
        description: 'Notebook id.',
      },
      {
        name: 'kind',
        type: 'string',
        required: true,
        description:
          'One of `quiz`, `simple_flashcard`, `roadmap`, `mind_map`, or `slides`.',
      },
      {
        name: 'brief',
        type: 'string',
        required: false,
        description:
          'Instructions and options for the Generation. Defaults to an empty string.',
      },
      {
        name: 'sourceIds',
        type: 'string[]',
        required: false,
        description:
          'Sources selected as Evidence. Defaults to an empty array, which lets the server choose.',
      },
      {
        name: 'folderId',
        type: 'string',
        required: false,
        description: 'Study material folder that should contain the result.',
      },
      {
        name: 'model',
        type: 'string',
        required: false,
        description:
          'Model identifier. Defaults to the model chosen for the kind.',
      },
      {
        name: 'questionCount',
        type: 'integer',
        required: false,
        description: 'Requested number of quiz questions or flashcards, 0–50.',
      },
      {
        name: 'difficulty',
        type: 'string',
        required: false,
        description:
          '`easy`, `medium`, `hard`, or `auto`. Applies to quizzes and flashcards.',
      },
      {
        name: 'groundingMode',
        type: 'string',
        required: false,
        description: '`strict`, `moderate`, or `free`.',
      },
      {
        name: 'roadmapOptions',
        type: 'object',
        required: false,
        description:
          'Roadmap options: `phaseCount` (0–50) and `detailLevel` (`basic`, `detailed`, or `auto`).',
      },
      {
        name: 'mindMapOptions',
        type: 'object',
        required: false,
        description:
          'Mind map options: `nodeCount` (0–100), `structure` (`radial`, `hierarchical`, or `organic`), `colorGroups` (boolean or `auto`), `crossLinks` (boolean), and `detailLevel` (`basic`, `detailed`, or `auto`).',
      },
      {
        name: 'language',
        type: 'string',
        required: false,
        description:
          'Base Language code used for the material. 1–35 characters.',
      },
      {
        name: 'slidesOptions',
        type: 'object',
        required: false,
        description:
          'Slides options: `slideCount` (0–20), `theme` (`dark`, `light`, `accent`, `editorial`, `academic`, `technical`, `warm`, or `auto`), and `detailLevel` (`basic`, `detailed`, or `auto`).',
      },
    ],
  },
  {
    name: 'export_study_material',
    area: 'Study materials',
    summary: 'Export one study material as a PowerPoint file or JSON.',
    behavior:
      'Slides return `format: "pptx"` with `contentBase64`, a filename, a MIME type, and the byte size. Every other kind returns `format: "json"` with the material content object.',
    readOnly: true,
    parameters: [
      {
        name: 'studyMaterialId',
        type: 'string',
        required: true,
        description: 'Study material id.',
      },
    ],
  },
  {
    name: 'delete_notebook',
    area: 'Deletes',
    summary: 'Delete a notebook and move it to Trash.',
    behavior:
      'Subject to the workspace resource delete policy. Returns `status: "deleted"` when the delete ran, or `status: "awaiting_approval"` with an `actionId` and `expiresAt` when approval is required.',
    readOnly: false,
    parameters: [
      {
        name: 'notebookId',
        type: 'string',
        required: true,
        description: 'Notebook id.',
      },
    ],
  },
  {
    name: 'delete_source',
    area: 'Deletes',
    summary: 'Delete a source and move it to Trash.',
    behavior:
      'Subject to the workspace resource delete policy. Returns `status: "deleted"` or `status: "awaiting_approval"` with an `actionId` and `expiresAt`.',
    readOnly: false,
    parameters: [
      {
        name: 'sourceId',
        type: 'string',
        required: true,
        description: 'Source id.',
      },
    ],
  },
  {
    name: 'delete_study_material',
    area: 'Deletes',
    summary: 'Delete a study material, to Trash or permanently.',
    behavior:
      'Soft deletes use the soft delete policy; `permanent: true` uses the permanent delete policy. Returns `status: "deleted"` or `status: "awaiting_approval"` with an `actionId` and `expiresAt`.',
    readOnly: false,
    parameters: [
      {
        name: 'studyMaterialId',
        type: 'string',
        required: true,
        description: 'Study material id.',
      },
      {
        name: 'permanent',
        type: 'boolean',
        required: false,
        description:
          'Delete forever instead of moving the material to Trash. Defaults to false.',
      },
    ],
  },
  {
    name: 'empty_trash',
    area: 'Deletes',
    summary: 'Permanently delete everything in Trash.',
    behavior:
      'Subject to the workspace permanent delete policy. Returns `status: "deleted"` or `status: "awaiting_approval"` with an `actionId` and `expiresAt`.',
    readOnly: false,
    parameters: [],
  },
  {
    name: 'get_action_status',
    area: 'Deletes',
    summary: 'Check the status of a Pending Agent Action.',
    behavior:
      'Returns the action status (`pending`, `approved`, `rejected`, `expired`, or `failed`), target type and ids, summary, error message, and timestamps. Poll this after asking the user to approve the action in Settings.',
    readOnly: true,
    parameters: [
      {
        name: 'actionId',
        type: 'string',
        required: true,
        description: 'Pending Agent Action id returned by a delete tool.',
      },
    ],
  },
];

/** Every tool name registered by the MCP server, in catalog order. */
export const MCP_TOOL_NAMES: readonly string[] = AGENT_TOOL_CATALOG.map(
  (tool) => tool.name,
);

/** Tools of one area, in catalog order. */
export function toolsInArea(area: AgentToolArea): readonly AgentToolDoc[] {
  return AGENT_TOOL_CATALOG.filter((tool) => tool.area === area);
}
