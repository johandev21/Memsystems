import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { McpToolContext } from '../mcp-context';
import {
  abortReason,
  AgentAccessDeniedError,
  assertNotebookAccess,
  delay,
  notifyProgress,
  progressTokenOf,
  registerAgentTool,
  textResult,
} from '../tool-helpers';

/** Source processing states after which polling can stop. */
export const TERMINAL_SOURCE_STATUSES = new Set([
  'ready',
  'degraded',
  'failed',
  'cancelled',
]);

/** `wait_for_sources` poll cadence. */
export const WAIT_POLL_INTERVAL_MS = 2_000;

/** Decoded size limit for `add_file_source`. */
export const MAX_FILE_BASE64_DECODED_BYTES = 50 * 1024 * 1024;

const sourceSummarySchema = z.object({
  id: z.string(),
  notebookId: z.string(),
  kind: z.string(),
  title: z.string(),
  url: z.string().nullable(),
  contentType: z.string().nullable(),
  fileSize: z.number().nullable(),
  modality: z.string().nullable(),
  processingStatus: z.string(),
  processingStage: z.string().nullable(),
  processingErrorMessage: z.string().nullable(),
  createdAt: z.string(),
});

const searchCandidateSchema = z.object({
  title: z.string(),
  url: z.string(),
  description: z.string().nullable(),
});

interface SourceRowLike {
  id: string;
  notebookId: string;
  kind: string;
  title: string;
  url: string | null;
  contentType: string | null;
  fileSize: number | null;
  modality: string | null;
  processingStatus: string;
  processingStage: string | null;
  processingErrorMessage: string | null;
  createdAt: Date;
}

function toSourceSummary(source: SourceRowLike) {
  return {
    id: source.id,
    notebookId: source.notebookId,
    kind: source.kind,
    title: source.title,
    url: source.url ?? null,
    contentType: source.contentType ?? null,
    fileSize: source.fileSize ?? null,
    modality: source.modality ?? null,
    processingStatus: source.processingStatus,
    processingStage: source.processingStage ?? null,
    processingErrorMessage: source.processingErrorMessage ?? null,
    createdAt: source.createdAt.toISOString(),
  };
}

function sourceLines(sources: ReturnType<typeof toSourceSummary>[]): string {
  if (sources.length === 0) {
    return 'No sources found.';
  }
  return sources
    .map(
      (source) =>
        `- ${source.title} (${source.id}) — ${source.kind}, ${source.processingStatus}`,
    )
    .join('\n');
}

function normalizeBase64(contentBase64: string): string {
  const compact = contentBase64.replace(/\s+/g, '');
  if (compact.length === 0) {
    throw new Error('contentBase64 is empty.');
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) {
    throw new Error(
      'contentBase64 must be valid base64 (no data URL prefix, no invalid characters).',
    );
  }
  if (compact.length % 4 === 1) {
    throw new Error('contentBase64 has an invalid base64 length.');
  }
  return compact.padEnd(compact.length + ((4 - (compact.length % 4)) % 4), '=');
}

/**
 * Strictly decodes a base64 payload and enforces the decoded-size cap before
 * allocating the buffer. Padded and unpadded base64 are both accepted.
 * `maxBytes` is injectable for tests.
 */
export function decodeBase64File(
  contentBase64: string,
  maxBytes: number = MAX_FILE_BASE64_DECODED_BYTES,
): Buffer {
  const normalized = normalizeBase64(contentBase64);
  const padding = normalized.endsWith('==')
    ? 2
    : normalized.endsWith('=')
      ? 1
      : 0;
  const expectedBytes = (normalized.length / 4) * 3 - padding;

  if (expectedBytes > maxBytes) {
    throw new Error(
      `File exceeds the maximum size of ${maxBytes} bytes after base64 decoding.`,
    );
  }

  const buffer = Buffer.from(normalized, 'base64');
  if (buffer.length === 0) {
    throw new Error('contentBase64 decoded to an empty file.');
  }
  if (buffer.length > maxBytes) {
    throw new Error(
      `File exceeds the maximum size of ${maxBytes} bytes after base64 decoding.`,
    );
  }
  return buffer;
}

export function registerSourceTools(
  server: McpServer,
  ctx: McpToolContext,
): void {
  registerAgentTool(
    server,
    ctx,
    {
      name: 'list_sources',
      title: 'List sources',
      description:
        'List the sources attached to a notebook, including their processing status.',
      inputSchema: z.object({
        notebookId: z.string().trim().min(1),
        limit: z.number().int().min(1).max(300).default(100),
      }),
      outputSchema: z.object({
        sources: z.array(sourceSummarySchema),
        total: z.number(),
      }),
      annotations: { readOnlyHint: true },
      readOnly: true,
      resolveNotebookId: (args) => args.notebookId,
    },
    async (args) => {
      const sources = await ctx.services.sources.list(args.notebookId);
      const summaries = sources.slice(0, args.limit).map(toSourceSummary);

      return textResult(
        `Found ${sources.length} source(s).\n${sourceLines(summaries)}`,
        { sources: summaries, total: sources.length },
      );
    },
  );

  registerAgentTool(
    server,
    ctx,
    {
      name: 'get_source',
      title: 'Get source',
      description:
        'Get one source and its first 20 extracted segments. Each segment text is truncated to 2000 characters.',
      inputSchema: z.object({
        sourceId: z.string().trim().min(1),
        notebookId: z.string().trim().min(1).optional(),
      }),
      outputSchema: z.object({
        source: sourceSummarySchema,
        segments: z.array(
          z.object({
            id: z.string(),
            ordinal: z.number(),
            kind: z.string(),
            content: z.string(),
            truncated: z.boolean(),
          }),
        ),
        segmentCount: z.number(),
        segmentsTruncated: z.boolean(),
        indexingStatus: z
          .object({
            status: z.string(),
            lastError: z.string().nullable(),
          })
          .nullable(),
      }),
      annotations: { readOnlyHint: true },
      readOnly: true,
      resolveNotebookId: (args) => args.notebookId,
    },
    async (args, _mcpCtx, audit) => {
      const source = await ctx.services.sources.get(args.sourceId);
      audit.notebookId = source.notebookId;

      if (args.notebookId && args.notebookId !== source.notebookId) {
        throw new AgentAccessDeniedError(
          `Source ${args.sourceId} does not belong to notebook ${args.notebookId}.`,
        );
      }
      if (!args.notebookId) {
        await assertNotebookAccess(ctx, source.notebookId, 'read');
      }

      const segments = source.segments.slice(0, 20).map((segment) => ({
        id: segment.id,
        ordinal: segment.ordinal,
        kind: segment.kind,
        content: segment.content.slice(0, 2_000),
        truncated: segment.content.length > 2_000,
      }));

      return textResult(
        `Source "${source.title}" (${source.id}) — ${source.segments.length} segment(s), showing ${segments.length}.`,
        {
          source: toSourceSummary(source),
          segments,
          segmentCount: source.segments.length,
          segmentsTruncated: source.segments.length > 20,
          indexingStatus: source.indexingStatus
            ? {
                status: source.indexingStatus.status,
                lastError: source.indexingStatus.lastError,
              }
            : null,
        },
      );
    },
  );

  registerAgentTool(
    server,
    ctx,
    {
      name: 'add_text_source',
      title: 'Add text source',
      description:
        'Add a text source (notes, pasted article, transcript) to a notebook. The source is indexed in the background.',
      inputSchema: z.object({
        notebookId: z.string().trim().min(1),
        title: z.string().trim().min(1).max(500),
        rawText: z.string().min(1),
      }),
      outputSchema: z.object({ source: sourceSummarySchema }),
      annotations: { readOnlyHint: false },
      readOnly: false,
      resolveNotebookId: (args) => args.notebookId,
    },
    async (args) => {
      const source = await ctx.services.sources.createText(args.notebookId, {
        title: args.title,
        rawText: args.rawText,
      });

      return textResult(
        `Added text source "${source.title}" (${source.id}); processing status: ${source.processingStatus}.`,
        { source: toSourceSummary(source) },
      );
    },
  );

  registerAgentTool(
    server,
    ctx,
    {
      name: 'add_url_source',
      title: 'Add URL source',
      description:
        'Add a web page as a source. The page is fetched and indexed in the background.',
      inputSchema: z.object({
        notebookId: z.string().trim().min(1),
        url: z.string().url().max(4_000),
        title: z.string().trim().min(1).max(500).optional(),
      }),
      outputSchema: z.object({ source: sourceSummarySchema }),
      annotations: { readOnlyHint: false },
      readOnly: false,
      resolveNotebookId: (args) => args.notebookId,
    },
    async (args) => {
      const source = await ctx.services.sources.createUrl(args.notebookId, {
        url: args.url,
        title: args.title,
      });

      return textResult(
        `Added URL source "${source.title}" (${source.id}); processing status: ${source.processingStatus}.`,
        { source: toSourceSummary(source) },
      );
    },
  );

  registerAgentTool(
    server,
    ctx,
    {
      name: 'add_file_source',
      title: 'Add file source',
      description:
        'Add a file to a notebook from base64 content. The decoded file must be at most 50 MB. Provide the filename so the extractor can pick the right parser.',
      inputSchema: z.object({
        notebookId: z.string().trim().min(1),
        filename: z.string().trim().min(1).max(500),
        contentType: z.string().trim().min(1).max(200),
        contentBase64: z.string().min(1),
        title: z.string().trim().min(1).max(500).optional(),
      }),
      outputSchema: z.object({ source: sourceSummarySchema }),
      annotations: { readOnlyHint: false },
      readOnly: false,
      resolveNotebookId: (args) => args.notebookId,
    },
    async (args) => {
      const buffer = decodeBase64File(args.contentBase64);
      const source = await ctx.services.sources.createFile(
        args.notebookId,
        buffer,
        args.filename,
        args.contentType,
        args.title,
      );

      return textResult(
        `Added file source "${source.title}" (${source.id}); processing status: ${source.processingStatus}.`,
        { source: toSourceSummary(source) },
      );
    },
  );

  registerAgentTool(
    server,
    ctx,
    {
      name: 'wait_for_sources',
      title: 'Wait for sources',
      description:
        'Wait until sources finish processing. Polls every 2 seconds for up to 120 seconds. Returns timedOut: true with the current sources when the deadline is reached.',
      inputSchema: z.object({
        notebookId: z.string().trim().min(1),
        sourceIds: z.array(z.string().trim().min(1)).max(300).optional(),
        timeoutSeconds: z.number().int().min(1).max(120).default(60),
      }),
      outputSchema: z.object({
        timedOut: z.boolean(),
        sources: z.array(sourceSummarySchema),
      }),
      annotations: { readOnlyHint: true },
      readOnly: true,
      resolveNotebookId: (args) => args.notebookId,
    },
    async (args, mcpCtx) => {
      const progressToken = progressTokenOf(mcpCtx);
      const deadline = Date.now() + args.timeoutSeconds * 1_000;
      const requested = args.sourceIds ? new Set(args.sourceIds) : null;
      let trackedIds: Set<string> | null = null;

      while (true) {
        mcpCtx.mcpReq.signal.throwIfAborted();

        const all = await ctx.services.sources.list(args.notebookId);
        if (requested && trackedIds === null) {
          const found = all.filter((source) => requested.has(source.id));
          if (found.length === 0) {
            throw new Error(
              `None of the requested sources exist in notebook ${args.notebookId}.`,
            );
          }
          trackedIds = new Set(found.map((source) => source.id));
        } else if (!requested && trackedIds === null) {
          // Without an explicit list, wait for everything still in flight. If
          // nothing is processing, report the notebook's current sources.
          const inFlight = all.filter(
            (source) => !TERMINAL_SOURCE_STATUSES.has(source.processingStatus),
          );
          trackedIds = new Set(
            (inFlight.length > 0 ? inFlight : all).map((source) => source.id),
          );
        }

        const tracked = all.filter((source) => trackedIds?.has(source.id));
        const remaining = tracked.filter(
          (source) => !TERMINAL_SOURCE_STATUSES.has(source.processingStatus),
        );

        await notifyProgress(
          mcpCtx,
          progressToken,
          tracked.length - remaining.length,
          tracked.length,
          remaining.length === 0
            ? 'All sources finished processing.'
            : `${remaining.length} source(s) still processing.`,
        );

        if (remaining.length === 0) {
          return textResult(
            `All ${tracked.length} source(s) finished processing.`,
            {
              timedOut: false,
              sources: tracked.map(toSourceSummary),
            },
          );
        }

        if (Date.now() >= deadline) {
          return textResult(
            `${remaining.length} source(s) are still processing after ${args.timeoutSeconds}s.`,
            {
              timedOut: true,
              sources: tracked.map(toSourceSummary),
            },
          );
        }

        try {
          await delay(
            Math.min(WAIT_POLL_INTERVAL_MS, Math.max(0, deadline - Date.now())),
            mcpCtx.mcpReq.signal,
          );
        } catch {
          throw abortReason(mcpCtx.mcpReq.signal);
        }
      }
    },
  );

  registerAgentTool(
    server,
    ctx,
    {
      name: 'web_search_sources',
      title: 'Search the web for sources',
      description:
        'Search the web for candidate sources for a notebook. Returns candidates; use import_search_results to add the ones you want.',
      inputSchema: z.object({
        notebookId: z.string().trim().min(1),
        query: z.string().trim().min(1).max(500),
      }),
      outputSchema: z.object({
        query: z.string(),
        summary: z.string().nullable(),
        sources: z.array(searchCandidateSchema),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      readOnly: true,
      resolveNotebookId: (args) => args.notebookId,
    },
    async (args) => {
      const result = await ctx.services.webSearch.search(args.notebookId, {
        query: args.query,
      });

      return textResult(
        `Found ${result.sources.length} candidate source(s) for "${result.query}".`,
        {
          query: result.query,
          summary: result.summary,
          sources: result.sources.map((candidate) => ({
            title: candidate.title,
            url: candidate.url,
            description: candidate.description,
          })),
        },
      );
    },
  );

  registerAgentTool(
    server,
    ctx,
    {
      name: 'import_search_results',
      title: 'Import search results',
      description:
        'Add selected web search candidates to a notebook as sources. Each candidate is fetched and indexed in the background.',
      inputSchema: z.object({
        notebookId: z.string().trim().min(1),
        query: z.string().trim().min(1).max(500),
        candidates: z
          .array(
            z.object({
              url: z.string().url().max(4_000),
              title: z.string().trim().min(1).max(500).optional(),
              description: z.string().max(500).nullable().optional(),
            }),
          )
          .min(1)
          .max(10),
      }),
      outputSchema: z.object({
        results: z.array(
          z.object({
            url: z.string(),
            title: z.string(),
            status: z.string(),
            sourceId: z.string().optional(),
            error: z.string().optional(),
          }),
        ),
      }),
      annotations: { readOnlyHint: false, openWorldHint: true },
      readOnly: false,
      resolveNotebookId: (args) => args.notebookId,
    },
    async (args) => {
      const result = await ctx.services.webSearch.import(args.notebookId, {
        query: args.query,
        candidates: args.candidates,
      });
      const added = result.results.filter(
        (entry) => entry.status === 'added',
      ).length;

      return textResult(
        `Imported ${added} of ${result.results.length} candidate source(s).`,
        { results: result.results },
      );
    },
  );
}
