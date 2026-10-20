import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { McpToolContext } from '../mcp-context';
import { registerAgentTool, textResult } from '../tool-helpers';

const agentAccessSchema = z.enum(['on', 'read_only', 'off']);

const notebookSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  icon: z.string(),
  groundingMode: z.string(),
  agentAccess: agentAccessSchema,
  agentAccessOverride: agentAccessSchema.nullable(),
  updatedAt: z.string(),
});

interface NotebookLike {
  id: string;
  title: string;
  description: string;
  icon: string;
  groundingMode: string;
  agentAccess: 'on' | 'read_only' | 'off';
  agentAccessOverride?: 'on' | 'read_only' | 'off' | null;
  updatedAt: Date;
}

function toNotebookSummary(notebook: NotebookLike) {
  return {
    id: notebook.id,
    title: notebook.title,
    description: notebook.description,
    icon: notebook.icon,
    groundingMode: notebook.groundingMode,
    agentAccess: notebook.agentAccess,
    agentAccessOverride: notebook.agentAccessOverride ?? null,
    updatedAt: notebook.updatedAt.toISOString(),
  };
}

function notebookLines(
  notebooks: ReturnType<typeof toNotebookSummary>[],
): string {
  if (notebooks.length === 0) {
    return 'No notebooks found.';
  }
  return notebooks
    .map(
      (notebook) =>
        `- ${notebook.title} (${notebook.id}) — agent access: ${notebook.agentAccess}`,
    )
    .join('\n');
}

export function registerNotebookTools(
  server: McpServer,
  ctx: McpToolContext,
): void {
  registerAgentTool(
    server,
    ctx,
    {
      name: 'list_notebooks',
      title: 'List notebooks',
      description:
        'List the study notebooks in this workspace. Supports an optional title/description search and pagination.',
      inputSchema: z.object({
        search: z.string().trim().min(1).max(200).optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }),
      outputSchema: z.object({
        notebooks: z.array(notebookSummarySchema),
        total: z.number(),
      }),
      annotations: { readOnlyHint: true },
      readOnly: true,
    },
    async (args) => {
      const result = await ctx.services.notebooks.list({
        limit: args.limit,
        offset: args.offset,
        search: args.search,
      });
      const notebooks = Array.isArray(result) ? result : result.notebooks;
      const total = Array.isArray(result) ? result.length : result.total;
      const summaries = notebooks.map(toNotebookSummary);

      return textResult(
        `Found ${total} notebook(s).\n${notebookLines(summaries)}`,
        { notebooks: summaries, total },
      );
    },
  );

  registerAgentTool(
    server,
    ctx,
    {
      name: 'create_notebook',
      title: 'Create notebook',
      description:
        'Create a new study notebook. Use it before adding sources or asking questions about a new topic.',
      inputSchema: z.object({
        title: z.string().trim().min(1).max(200),
        description: z.string().trim().max(500).optional(),
        icon: z.string().trim().min(1).max(50).optional(),
      }),
      outputSchema: notebookSummarySchema,
      annotations: { readOnlyHint: false },
      readOnly: false,
    },
    async (args) => {
      const notebook = await ctx.services.notebooks.create({
        title: args.title,
        description: args.description,
        icon: args.icon,
      });
      const summary = toNotebookSummary(notebook);

      return textResult(
        `Created notebook "${summary.title}" (${summary.id}).`,
        summary,
      );
    },
  );

  registerAgentTool(
    server,
    ctx,
    {
      name: 'get_notebook',
      title: 'Get notebook',
      description:
        'Get one notebook by id, including its grounding mode and Agent Access level.',
      inputSchema: z.object({
        notebookId: z.string().trim().min(1),
      }),
      outputSchema: notebookSummarySchema,
      annotations: { readOnlyHint: true },
      readOnly: true,
      resolveNotebookId: (args) => args.notebookId,
    },
    async (args) => {
      const notebook = await ctx.services.notebooks.get(args.notebookId);
      const summary = toNotebookSummary(notebook);

      return textResult(
        `Notebook "${summary.title}" (${summary.id}) — agent access: ${summary.agentAccess}.`,
        summary,
      );
    },
  );
}
