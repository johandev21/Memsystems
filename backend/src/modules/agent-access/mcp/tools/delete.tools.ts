import type {
  CallToolResult,
  ElicitRequestFormParams,
  McpServer,
  ServerContext,
} from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { AgentActionTargetType } from '../../../../database/schema';
import {
  buildDeleteSuccessMessage,
  buildDeleteSummary,
  decideDelete,
} from '../../delete-policy';
import type { McpToolContext } from '../mcp-context';
import {
  AgentAccessDeniedError,
  assertNotebookAccess,
  registerAgentTool,
  textResult,
} from '../tool-helpers';

const deleteResultSchema = z.object({
  status: z.enum(['deleted', 'awaiting_approval']),
  targetType: z.string(),
  targetIds: z.array(z.string()),
  summary: z.string(),
  actionId: z.string().optional(),
  expiresAt: z.string().optional(),
});

const actionStatusSchema = z.object({
  id: z.string(),
  status: z.string(),
  toolName: z.string(),
  targetType: z.string(),
  targetIds: z.array(z.string()),
  summary: z.string(),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
  expiresAt: z.string(),
  resolvedAt: z.string().nullable(),
});

interface DeleteTarget {
  toolName: string;
  targetType: AgentActionTargetType;
  targetIds: string[];
  title?: string | null;
  notebookId: string | null;
  permanent?: boolean;
  /** Human-readable summary shown in Settings and returned to the agent. */
  summary: string;
}

function deletePayload(target: DeleteTarget): Record<string, unknown> | null {
  return target.permanent ? { permanent: true } : null;
}

function clientSupportsFormElicitation(server: McpServer): boolean {
  const capabilities = server.server.getClientCapabilities() as
    { elicitation?: { form?: unknown } } | undefined;
  return Boolean(capabilities?.elicitation?.form);
}

async function executeTarget(
  ctx: McpToolContext,
  target: DeleteTarget,
): Promise<CallToolResult> {
  const payload = deletePayload(target);
  await ctx.services.actions.executeDelete({
    targetType: target.targetType,
    targetIds: target.targetIds,
    payload,
  });

  return textResult(buildDeleteSuccessMessage(target), {
    status: 'deleted',
    targetType: target.targetType,
    targetIds: target.targetIds,
    summary: buildDeleteSummary(target),
  });
}

/**
 * Applies the workspace policy, asks the client directly when it supports form
 * elicitation, and otherwise queues a Pending Agent Action for Settings.
 */
async function handleDelete(
  ctx: McpToolContext,
  mcpCtx: ServerContext,
  target: DeleteTarget,
): Promise<CallToolResult> {
  const settings = await ctx.services.settings.get();
  const decision = decideDelete({
    targetType: target.targetType,
    settings,
    permanent: target.permanent,
  });

  if (decision.kind === 'refuse') {
    throw new AgentAccessDeniedError(decision.message);
  }

  if (decision.kind === 'execute') {
    return executeTarget(ctx, target);
  }

  if (ctx.era === 'legacy' && clientSupportsFormElicitation(ctx.server)) {
    const requestedSchema: ElicitRequestFormParams['requestedSchema'] = {
      type: 'object',
      properties: {
        confirm: {
          type: 'boolean',
          title: 'Delete',
          description: 'Confirm this deletion.',
          default: false,
        },
      },
      required: ['confirm'],
    };

    try {
      const result = await mcpCtx.mcpReq.elicitInput({
        message: `${target.summary}\n\nApprove this deletion?`,
        requestedSchema,
      });

      if (result.action === 'accept' && result.content?.confirm === true) {
        return executeTarget(ctx, target);
      }

      throw new AgentAccessDeniedError('Deletion was not approved.');
    } catch (error) {
      if (error instanceof AgentAccessDeniedError) {
        throw error;
      }
      // The stateless transport cannot always deliver a server-to-client
      // request. Fall back to the Pending Agent Action queue instead of
      // failing the tool call.
    }
  }

  const action = await ctx.services.actions.create({
    agentKeyId: ctx.agentKeyId,
    toolName: target.toolName,
    notebookId: target.notebookId,
    targetType: target.targetType,
    targetIds: target.targetIds,
    summary: target.summary,
    payload: deletePayload(target),
  });

  return textResult(
    `Approval required. ${target.summary}\n` +
      `Approve this action in Settings → Agent Access → Pending actions, or call get_action_status with actionId ${action.id}. ` +
      `It expires at ${action.expiresAt.toISOString()}.`,
    {
      status: 'awaiting_approval',
      targetType: target.targetType,
      targetIds: target.targetIds,
      summary: target.summary,
      actionId: action.id,
      expiresAt: action.expiresAt.toISOString(),
    },
  );
}

function actionStatusMessage(action: {
  id: string;
  status: string;
  summary: string;
  errorMessage: string | null;
  expiresAt: Date;
}): string {
  switch (action.status) {
    case 'pending':
      return `Action ${action.id} is pending approval: ${action.summary} It expires at ${action.expiresAt.toISOString()}.`;
    case 'approved':
      return `Action ${action.id} was approved and executed: ${action.summary}`;
    case 'rejected':
      return `Action ${action.id} was rejected: ${action.summary}`;
    case 'expired':
      return `Action ${action.id} expired before approval: ${action.summary}`;
    case 'failed':
      return `Action ${action.id} failed: ${
        action.errorMessage ?? action.summary
      }`;
    default:
      return `Action ${action.id} has status ${action.status}: ${action.summary}`;
  }
}

export function registerDeleteTools(
  server: McpServer,
  ctx: McpToolContext,
): void {
  registerAgentTool(
    server,
    ctx,
    {
      name: 'delete_notebook',
      title: 'Delete notebook',
      description:
        'Delete a notebook and move it to Trash. Agent Access may require approval; the result reports whether the delete ran or is awaiting approval.',
      inputSchema: z.object({
        notebookId: z.string().trim().min(1),
      }),
      outputSchema: deleteResultSchema,
      annotations: { readOnlyHint: false, destructiveHint: true },
      readOnly: false,
      resolveNotebookId: (args) => args.notebookId,
    },
    async (args, mcpCtx, audit) => {
      const notebook = await ctx.services.notebooks.get(args.notebookId);
      audit.notebookId = notebook.id;
      const targetIds = [notebook.id];

      return handleDelete(ctx, mcpCtx, {
        toolName: 'delete_notebook',
        targetType: 'notebook',
        targetIds,
        title: notebook.title,
        notebookId: notebook.id,
        summary: buildDeleteSummary({
          targetType: 'notebook',
          targetIds,
          title: notebook.title,
        }),
      });
    },
  );

  registerAgentTool(
    server,
    ctx,
    {
      name: 'delete_source',
      title: 'Delete source',
      description:
        'Delete a source and move it to Trash. Agent Access may require approval; the result reports whether the delete ran or is awaiting approval.',
      inputSchema: z.object({
        sourceId: z.string().trim().min(1),
      }),
      outputSchema: deleteResultSchema,
      annotations: { readOnlyHint: false, destructiveHint: true },
      readOnly: false,
    },
    async (args, mcpCtx, audit) => {
      const source = await ctx.services.sources.get(args.sourceId);
      audit.notebookId = source.notebookId;
      await assertNotebookAccess(ctx, source.notebookId, 'write');
      const targetIds = [source.id];

      return handleDelete(ctx, mcpCtx, {
        toolName: 'delete_source',
        targetType: 'source',
        targetIds,
        title: source.title,
        notebookId: source.notebookId,
        summary: buildDeleteSummary({
          targetType: 'source',
          targetIds,
          title: source.title,
        }),
      });
    },
  );

  registerAgentTool(
    server,
    ctx,
    {
      name: 'delete_study_material',
      title: 'Delete study material',
      description:
        'Delete a study material. By default it moves to Trash; set permanent to delete it forever. Agent Access may require approval.',
      inputSchema: z.object({
        studyMaterialId: z.string().trim().min(1),
        permanent: z.boolean().optional(),
      }),
      outputSchema: deleteResultSchema,
      annotations: { readOnlyHint: false, destructiveHint: true },
      readOnly: false,
    },
    async (args, mcpCtx, audit) => {
      const material = await ctx.services.studyMaterials.get(
        args.studyMaterialId,
      );
      audit.notebookId = material.notebookId;
      await assertNotebookAccess(ctx, material.notebookId, 'write');

      const permanent = args.permanent === true;
      const targetIds = [material.id];

      return handleDelete(ctx, mcpCtx, {
        toolName: 'delete_study_material',
        targetType: 'study_material',
        targetIds,
        title: material.title,
        notebookId: material.notebookId,
        permanent,
        summary: buildDeleteSummary({
          targetType: 'study_material',
          targetIds,
          title: material.title,
          permanent,
        }),
      });
    },
  );

  registerAgentTool(
    server,
    ctx,
    {
      name: 'empty_trash',
      title: 'Empty Trash',
      description:
        'Permanently delete everything in Trash. Agent Access may require approval; the result reports whether the delete ran or is awaiting approval.',
      inputSchema: z.object({}),
      outputSchema: deleteResultSchema,
      annotations: { readOnlyHint: false, destructiveHint: true },
      readOnly: false,
    },
    async (_args, mcpCtx) => {
      const targetIds: string[] = [];

      return handleDelete(ctx, mcpCtx, {
        toolName: 'empty_trash',
        targetType: 'trash',
        targetIds,
        notebookId: null,
        permanent: true,
        summary: buildDeleteSummary({ targetType: 'trash', targetIds }),
      });
    },
  );

  registerAgentTool(
    server,
    ctx,
    {
      name: 'get_action_status',
      title: 'Get pending action status',
      description:
        'Check the status of a Pending Agent Action created by an earlier delete request. Poll this after asking the user to approve in Settings.',
      inputSchema: z.object({
        actionId: z.string().trim().min(1),
      }),
      outputSchema: actionStatusSchema,
      annotations: { readOnlyHint: true },
      readOnly: true,
    },
    async (args, _mcpCtx, audit) => {
      const action = await ctx.services.actions.get(args.actionId);
      if (
        !action ||
        (ctx.agentKeyId !== null && action.agentKeyId !== ctx.agentKeyId)
      ) {
        throw new Error(`Pending action ${args.actionId} was not found.`);
      }

      audit.notebookId = action.notebookId;

      return textResult(actionStatusMessage(action), {
        id: action.id,
        status: action.status,
        toolName: action.toolName,
        targetType: action.targetType,
        targetIds: action.targetIds,
        summary: action.summary,
        errorMessage: action.errorMessage,
        createdAt: action.createdAt.toISOString(),
        expiresAt: action.expiresAt.toISOString(),
        resolvedAt: action.resolvedAt?.toISOString() ?? null,
      });
    },
  );
}
