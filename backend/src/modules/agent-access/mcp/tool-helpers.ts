import { Logger } from '@nestjs/common';
import type {
  CallToolResult,
  McpServer,
  ServerContext,
} from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { AgentAuditStatus } from '../../../database/schema';
import type { McpAccessMode, McpToolContext } from './mcp-context';

const logger = new Logger('AgentMcpTools');

/**
 * Thrown when Agent Access forbids an operation. The tool wrapper records the
 * audit row with `denied` instead of `error` and the SDK turns the message into
 * an `isError` tool result.
 */
export class AgentAccessDeniedError extends Error {
  readonly code = 'agent_access_denied';

  constructor(message: string) {
    super(message);
    this.name = 'AgentAccessDeniedError';
  }
}

export interface ToolAuditContext {
  /** Notebook the call applies to, when known. Tools may fill this in later. */
  notebookId: string | null;
}

export interface AgentToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface AgentToolConfig<TInput extends z.ZodType> {
  name: string;
  title?: string;
  description: string;
  inputSchema: TInput;
  outputSchema?: z.ZodType;
  annotations?: AgentToolAnnotations;
  /** Read tools stay available on `read_only` Notebooks. */
  readOnly: boolean;
  /** Resolves the Notebook whose access level must be enforced, if any. */
  resolveNotebookId?: (args: z.infer<TInput>) => string | null | undefined;
}

export type AgentToolHandler<TInput extends z.ZodType> = (
  args: z.infer<TInput>,
  mcpCtx: ServerContext,
  audit: ToolAuditContext,
) => Promise<CallToolResult>;

export function textResult(
  text: string,
  structuredContent?: Record<string, unknown>,
): CallToolResult {
  return {
    content: [{ type: 'text', text }],
    ...(structuredContent ? { structuredContent } : {}),
  };
}

export function errorMessageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function isAccessDenied(error: unknown): boolean {
  if (error instanceof AgentAccessDeniedError) {
    return true;
  }
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'agent_access_denied'
  );
}

function isAwaitingApproval(result: CallToolResult): boolean {
  const structured = result.structuredContent;
  return (
    typeof structured === 'object' &&
    structured !== null &&
    (structured as { status?: unknown }).status === 'awaiting_approval'
  );
}

function asAuditArgs(args: unknown): Record<string, unknown> {
  if (typeof args === 'object' && args !== null && !Array.isArray(args)) {
    return args as Record<string, unknown>;
  }
  return { value: args };
}

/**
 * Enforces a Notebook's Agent Access level. `off` denies every tool; `read_only`
 * denies mutations. A missing Notebook surfaces as a normal not-found error.
 */
export async function assertNotebookAccess(
  ctx: McpToolContext,
  notebookId: string,
  mode: McpAccessMode,
): Promise<void> {
  const access = await ctx.services.notebooks.getAgentAccess(notebookId);

  if (access === 'off') {
    throw new AgentAccessDeniedError(
      `Agent access is off for notebook ${notebookId}. Enable it in the notebook's settings.`,
    );
  }

  if (mode === 'write' && access === 'read_only') {
    throw new AgentAccessDeniedError(
      `Notebook ${notebookId} is read-only for agents. Change the notebook's Agent Access setting to allow changes.`,
    );
  }
}

async function recordAuditSafely(
  ctx: McpToolContext,
  input: {
    toolName: string;
    args: unknown;
    status: AgentAuditStatus;
    errorMessage: string | null;
    durationMs: number;
    notebookId: string | null;
  },
): Promise<void> {
  try {
    await ctx.services.audit.recordToolCall({
      agentKeyId: ctx.agentKeyId,
      toolName: input.toolName,
      args: asAuditArgs(input.args),
      status: input.status,
      errorMessage: input.errorMessage,
      durationMs: input.durationMs,
      notebookId: input.notebookId,
    });
  } catch (error) {
    // Auditing is best-effort: a failed insert must never hide the tool result.
    logger.warn(
      `Could not record audit row for ${input.toolName}: ${errorMessageOf(error)}`,
    );
  }
}

/**
 * Registers one MCP tool with the shared behaviour: Notebook access check,
 * exactly one audit row per call (success/error/denied/pending_approval), and
 * rethrow of the original error so the SDK can mark the tool result as an error.
 */
export function registerAgentTool<TInput extends z.ZodType>(
  server: McpServer,
  ctx: McpToolContext,
  config: AgentToolConfig<TInput>,
  handler: AgentToolHandler<TInput>,
): void {
  const run = async (
    rawArgs: unknown,
    mcpCtx: ServerContext,
  ): Promise<CallToolResult> => {
    const args = rawArgs as z.infer<TInput>;
    const audit: ToolAuditContext = {
      notebookId: config.resolveNotebookId?.(args) ?? null,
    };
    const startedAt = Date.now();
    let status: AgentAuditStatus = 'success';
    let errorMessage: string | null = null;

    try {
      if (audit.notebookId) {
        await assertNotebookAccess(
          ctx,
          audit.notebookId,
          config.readOnly ? 'read' : 'write',
        );
      }

      const result = await handler(args, mcpCtx, audit);
      if (isAwaitingApproval(result)) {
        status = 'pending_approval';
      }
      return result;
    } catch (error) {
      status = isAccessDenied(error) ? 'denied' : 'error';
      errorMessage = errorMessageOf(error);
      throw error;
    } finally {
      await recordAuditSafely(ctx, {
        toolName: config.name,
        args,
        status,
        errorMessage,
        durationMs: Date.now() - startedAt,
        notebookId: audit.notebookId,
      });
    }
  };

  // The SDK overloads accept either Standard Schema objects or raw Zod shapes;
  // a structural cast keeps the wrapper's own generic typing readable.
  const registrar = server as unknown as {
    registerTool: (
      name: string,
      toolConfig: Record<string, unknown>,
      callback: (
        args: unknown,
        mcpCtx: ServerContext,
      ) => Promise<CallToolResult>,
    ) => unknown;
  };

  registrar.registerTool(
    config.name,
    {
      title: config.title,
      description: config.description,
      inputSchema: config.inputSchema,
      ...(config.outputSchema ? { outputSchema: config.outputSchema } : {}),
      ...(config.annotations ? { annotations: config.annotations } : {}),
    },
    run,
  );
}

/** Progress token supplied by the client for this request, when present. */
export function progressTokenOf(
  ctx: ServerContext,
): string | number | undefined {
  const token = ctx.mcpReq._meta?.progressToken;
  if (typeof token === 'string' || typeof token === 'number') {
    return token;
  }
  return undefined;
}

/** Best-effort progress notification; clients may ignore it. */
export async function notifyProgress(
  ctx: ServerContext,
  progressToken: string | number | undefined,
  progress: number,
  total?: number,
  message?: string,
): Promise<void> {
  if (progressToken === undefined) {
    return;
  }

  try {
    await ctx.mcpReq.notify({
      method: 'notifications/progress',
      params: {
        progressToken,
        progress,
        ...(total !== undefined ? { total } : {}),
        ...(message !== undefined ? { message } : {}),
      },
    });
  } catch (error) {
    logger.debug(`Progress notification failed: ${errorMessageOf(error)}`);
  }
}

/** Abort-aware sleep used by polling tools. */
export function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortReason(signal));
      return;
    }

    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortReason(signal));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
    }
  });
}

export function abortReason(signal: AbortSignal): Error {
  const reason: unknown = signal.reason;
  if (reason instanceof Error) {
    return reason;
  }
  return new Error('Request cancelled');
}
