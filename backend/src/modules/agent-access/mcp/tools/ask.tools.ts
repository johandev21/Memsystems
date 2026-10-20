import type { McpServer, ServerContext } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { ChatService, ChatMessage } from '../../../chat/chat.service';
import type { McpToolContext } from '../mcp-context';
import { delay, registerAgentTool, textResult } from '../tool-helpers';

const ASSISTANT_LOOKUP_ATTEMPTS = 5;
const ASSISTANT_LOOKUP_DELAY_MS = 100;

/**
 * Drains the UI message stream so the assistant message is persisted before we
 * read it back. Stops as soon as the MCP request is cancelled.
 */
async function drainStream(
  response: Response,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();

  if (!response.body) {
    await response.text();
    return;
  }

  const reader = response.body.getReader();
  try {
    while (true) {
      signal.throwIfAborted();
      const { done } = await reader.read();
      if (done) {
        return;
      }
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}

async function findAssistantMessage(
  chat: ChatService,
  notebookId: string,
  userMessageId: string,
  signal: AbortSignal,
): Promise<ChatMessage> {
  for (let attempt = 0; attempt < ASSISTANT_LOOKUP_ATTEMPTS; attempt += 1) {
    const messages = await chat.listMessages(notebookId);
    const userIndex = messages.findIndex(
      (message) => message.id === userMessageId,
    );
    if (userIndex === -1) {
      throw new Error(
        `Could not find the persisted user message ${userMessageId}.`,
      );
    }

    const assistant = [...messages.slice(userIndex + 1)]
      .reverse()
      .find((message) => message.role === 'assistant');
    if (assistant) {
      return assistant;
    }

    if (attempt < ASSISTANT_LOOKUP_ATTEMPTS - 1) {
      await delay(ASSISTANT_LOOKUP_DELAY_MS, signal);
    }
  }

  throw new Error(
    'The assistant reply was not persisted. Check that the model connection is configured and try again.',
  );
}

export function registerAskTools(server: McpServer, ctx: McpToolContext): void {
  registerAgentTool(
    server,
    ctx,
    {
      name: 'ask_notebook',
      title: 'Ask a notebook',
      description:
        'Ask a question grounded in one notebook. Returns the answer plus the citations the assistant used.',
      inputSchema: z.object({
        notebookId: z.string().trim().min(1),
        question: z.string().trim().min(1).max(8_000),
        model: z.string().trim().min(1).max(200).optional(),
      }),
      outputSchema: z.object({
        answer: z.string(),
        citations: z.array(
          z.object({
            key: z.string(),
            number: z.number(),
            title: z.string(),
            kind: z.string(),
            url: z.string().optional(),
            quote: z.string().optional(),
          }),
        ),
      }),
      annotations: { readOnlyHint: true },
      // Asking persists chat messages but does not change notebook content, so
      // it remains available on read-only notebooks.
      readOnly: true,
      resolveNotebookId: (args) => args.notebookId,
    },
    async (args, mcpCtx: ServerContext) => {
      const signal = mcpCtx.mcpReq.signal;
      const { streamResponse, userMessageId } =
        await ctx.services.chat.sendMessage(args.notebookId, {
          content: args.question,
          model: args.model ?? ctx.defaultModel,
          abortSignal: signal,
        });

      await drainStream(streamResponse, signal);

      const assistant = await findAssistantMessage(
        ctx.services.chat,
        args.notebookId,
        userMessageId,
        signal,
      );

      const citations = assistant.citedSources.map((citation) => ({
        key: citation.citationKey,
        number: citation.number,
        title: citation.title,
        kind: citation.kind,
        ...(citation.url ? { url: citation.url } : {}),
        ...(citation.quote ? { quote: citation.quote } : {}),
      }));

      return textResult(assistant.content, {
        answer: assistant.content,
        citations,
      });
    },
  );
}
