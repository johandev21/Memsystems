import type {
  CallToolResult,
  McpServer,
  ServerContext,
} from '@modelcontextprotocol/server';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { McpController } from '../../src/modules/agent-access/mcp/mcp.controller';
import type { McpToolContext } from '../../src/modules/agent-access/mcp/mcp-context';
import type { McpServerFactory } from '../../src/modules/agent-access/mcp/mcp-server.factory';
import {
  AgentAccessDeniedError,
  registerAgentTool,
  textResult,
} from '../../src/modules/agent-access/mcp/tool-helpers';
import { registerAskTools } from '../../src/modules/agent-access/mcp/tools/ask.tools';
import { registerNotebookTools } from '../../src/modules/agent-access/mcp/tools/notebooks.tools';
import {
  decodeBase64File,
  registerSourceTools,
} from '../../src/modules/agent-access/mcp/tools/sources.tools';

interface RegisteredTool {
  name: string;
  config: {
    inputSchema?: unknown;
    outputSchema?: unknown;
    annotations?: unknown;
  };
  handler: (args: unknown, ctx: ServerContext) => Promise<CallToolResult>;
}

const notebook = {
  id: 'nb1',
  title: 'Test notebook',
  description: 'A notebook',
  icon: 'notebook',
  groundingMode: 'strict',
  agentAccess: 'on' as const,
  agentAccessOverride: null,
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const source = {
  id: 'src1',
  notebookId: 'nb1',
  kind: 'text',
  title: 'Test source',
  url: null,
  contentType: null,
  fileSize: null,
  modality: 'document',
  processingStatus: 'ready',
  processingStage: null,
  processingErrorMessage: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

function setup(register: (server: McpServer, ctx: McpToolContext) => void) {
  const tools = new Map<string, RegisteredTool>();
  const server = {
    registerTool: (
      name: string,
      config: RegisteredTool['config'],
      handler: RegisteredTool['handler'],
    ) => {
      tools.set(name, { name, config, handler });
    },
    server: { getClientCapabilities: vi.fn().mockReturnValue(undefined) },
  } as unknown as McpServer;

  const audit = { recordToolCall: vi.fn().mockResolvedValue({}) };
  const notebooks = {
    getAgentAccess: vi.fn().mockResolvedValue('on'),
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
  };
  const sources = {
    list: vi.fn(),
    get: vi.fn(),
    createText: vi.fn(),
    createUrl: vi.fn(),
    createFile: vi.fn(),
  };
  const webSearch = { search: vi.fn(), import: vi.fn() };
  const chat = { sendMessage: vi.fn(), listMessages: vi.fn() };
  const studyMaterials = {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    buildSlidesPptx: vi.fn(),
  };
  const generation = { generate: vi.fn(), cancel: vi.fn() };
  const actions = {
    create: vi.fn(),
    executeDelete: vi.fn().mockResolvedValue(undefined),
    get: vi.fn(),
  };
  const settings = {
    get: vi.fn().mockResolvedValue({
      softDelete: 'ask',
      permanentDelete: 'never',
      resourceDelete: 'never',
      notebookDefault: 'on',
    }),
  };

  const ctx: McpToolContext = {
    era: 'legacy',
    server,
    agentKeyId: 'key_1',
    agentKeyName: 'Test key',
    defaultModel: 'openai/test-model',
    services: {
      notebooks:
        notebooks as unknown as McpToolContext['services']['notebooks'],
      sources: sources as unknown as McpToolContext['services']['sources'],
      webSearch:
        webSearch as unknown as McpToolContext['services']['webSearch'],
      chat: chat as unknown as McpToolContext['services']['chat'],
      studyMaterials:
        studyMaterials as unknown as McpToolContext['services']['studyMaterials'],
      generation:
        generation as unknown as McpToolContext['services']['generation'],
      audit: audit as unknown as McpToolContext['services']['audit'],
      actions:
        actions as unknown as McpToolContext['services']['actions'],
      settings:
        settings as unknown as McpToolContext['services']['settings'],
    },
  };

  register(server, ctx);
  return {
    tools,
    audit,
    notebooks,
    sources,
    webSearch,
    chat,
    studyMaterials,
    generation,
    actions,
    settings,
    server,
    ctx,
  };
}

function requestContext(
  options: {
    progressToken?: string | number;
    signal?: AbortSignal;
  } = {},
): ServerContext {
  return {
    mcpReq: {
      signal: options.signal ?? new AbortController().signal,
      _meta:
        options.progressToken !== undefined
          ? { progressToken: options.progressToken }
          : undefined,
      notify: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as ServerContext;
}

function structured(result: CallToolResult): Record<string, unknown> {
  return (result.structuredContent ?? {}) as Record<string, unknown>;
}

describe('MCP tool wrapper', () => {
  it('denies tools when Agent Access is off and records one denied audit row', async () => {
    const { tools, notebooks, audit } = setup(registerNotebookTools);
    notebooks.getAgentAccess.mockResolvedValue('off');

    const tool = tools.get('get_notebook');
    await expect(
      tool!.handler({ notebookId: 'nb1' }, requestContext()),
    ).rejects.toBeInstanceOf(AgentAccessDeniedError);

    expect(notebooks.get).not.toHaveBeenCalled();
    expect(audit.recordToolCall).toHaveBeenCalledTimes(1);
    expect(audit.recordToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        agentKeyId: 'key_1',
        toolName: 'get_notebook',
        status: 'denied',
        notebookId: 'nb1',
      }),
    );
  });

  it('denies mutations on read-only notebooks but allows reads', async () => {
    const { tools, notebooks, sources, audit } = setup(registerSourceTools);
    notebooks.getAgentAccess.mockResolvedValue('read_only');

    await expect(
      tools
        .get('add_text_source')!
        .handler(
          { notebookId: 'nb1', title: 'Notes', rawText: 'hello' },
          requestContext(),
        ),
    ).rejects.toBeInstanceOf(AgentAccessDeniedError);
    expect(sources.createText).not.toHaveBeenCalled();

    sources.list.mockResolvedValue([source]);
    const result = await tools
      .get('list_sources')!
      .handler({ notebookId: 'nb1', limit: 100 }, requestContext());
    expect(structured(result).total).toBe(1);

    expect(audit.recordToolCall).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ status: 'denied' }),
    );
    expect(audit.recordToolCall).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ status: 'success' }),
    );
  });

  it('records success once and returns the tool result', async () => {
    const { tools, notebooks, audit } = setup(registerNotebookTools);
    notebooks.get.mockResolvedValue(notebook);

    const result = await tools
      .get('get_notebook')!
      .handler({ notebookId: 'nb1' }, requestContext());

    expect(structured(result)).toMatchObject({
      id: 'nb1',
      title: 'Test notebook',
      agentAccess: 'on',
    });
    expect(audit.recordToolCall).toHaveBeenCalledTimes(1);
    expect(audit.recordToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'get_notebook',
        status: 'success',
        errorMessage: null,
        notebookId: 'nb1',
      }),
    );
  });

  it('records errors, keeps the message, and rethrows', async () => {
    const { tools, notebooks, audit } = setup(registerNotebookTools);
    notebooks.get.mockRejectedValue(new Error('Notebook not found'));

    await expect(
      tools
        .get('get_notebook')!
        .handler({ notebookId: 'nb1' }, requestContext()),
    ).rejects.toThrow('Notebook not found');

    expect(audit.recordToolCall).toHaveBeenCalledTimes(1);
    expect(audit.recordToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        errorMessage: 'Notebook not found',
      }),
    );
  });

  it('records pending_approval when a tool returns awaiting_approval', async () => {
    const { tools, notebooks, audit } = setup((server, ctx) => {
      registerAgentTool(
        server,
        ctx,
        {
          name: 'delete_thing',
          description: 'Synthetic approval-gated tool.',
          inputSchema: z.object({ notebookId: z.string() }),
          readOnly: false,
          resolveNotebookId: (args) => args.notebookId,
        },
        async () =>
          textResult('Approve in Settings.', {
            status: 'awaiting_approval',
            actionId: 'action_1',
          }),
      );
    });
    notebooks.getAgentAccess.mockResolvedValue('on');

    const result = await tools
      .get('delete_thing')!
      .handler({ notebookId: 'nb1' }, requestContext());

    expect(structured(result).status).toBe('awaiting_approval');
    expect(audit.recordToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'delete_thing',
        status: 'pending_approval',
      }),
    );
  });

  it('does not mask a successful result when audit insertion fails', async () => {
    const { tools, notebooks, audit } = setup(registerNotebookTools);
    notebooks.get.mockResolvedValue(notebook);
    audit.recordToolCall.mockRejectedValueOnce(new Error('database down'));

    const result = await tools
      .get('get_notebook')!
      .handler({ notebookId: 'nb1' }, requestContext());

    expect(structured(result).id).toBe('nb1');
  });

  it('does not check notebook access when creating a notebook', async () => {
    const { tools, notebooks, audit } = setup(registerNotebookTools);
    notebooks.create.mockResolvedValue(notebook);

    const result = await tools
      .get('create_notebook')!
      .handler({ title: 'Test notebook' }, requestContext());

    expect(structured(result).id).toBe('nb1');
    expect(notebooks.getAgentAccess).not.toHaveBeenCalled();
    expect(audit.recordToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'create_notebook',
        status: 'success',
      }),
    );
  });

  it('normalizes both paginated and unpaginated notebook lists', async () => {
    const { tools, notebooks } = setup(registerNotebookTools);

    notebooks.list.mockResolvedValueOnce([notebook]);
    const unpaginated = await tools
      .get('list_notebooks')!
      .handler({ limit: 50, offset: 0 }, requestContext());
    expect(structured(unpaginated)).toMatchObject({
      total: 1,
      notebooks: [{ id: 'nb1' }],
    });

    notebooks.list.mockResolvedValueOnce({ notebooks: [notebook], total: 7 });
    const paginated = await tools
      .get('list_notebooks')!
      .handler({ limit: 1, offset: 0 }, requestContext());
    expect(structured(paginated)).toMatchObject({
      total: 7,
      notebooks: [{ id: 'nb1' }],
    });
  });
});

describe('source tools', () => {
  it('truncates get_source to 20 segments of 2000 characters', async () => {
    const { tools, notebooks, sources, audit } = setup(registerSourceTools);
    notebooks.getAgentAccess.mockResolvedValue('on');
    const segments = Array.from({ length: 25 }, (_, index) => ({
      id: `seg_${index}`,
      ordinal: index,
      kind: 'paragraph',
      content: 'x'.repeat(2_500),
      locator: {},
      metadata: {},
    }));
    sources.get.mockResolvedValue({
      ...source,
      indexingStatus: { status: 'ready', lastError: null },
      segments,
    });

    const result = await tools
      .get('get_source')!
      .handler({ sourceId: 'src1' }, requestContext());

    const payload = structured(result);
    const returnedSegments = payload.segments as Array<{
      content: string;
      truncated: boolean;
    }>;
    expect(returnedSegments).toHaveLength(20);
    expect(returnedSegments[0].content).toHaveLength(2_000);
    expect(returnedSegments[0].truncated).toBe(true);
    expect(payload.segmentCount).toBe(25);
    expect(payload.segmentsTruncated).toBe(true);
    expect(notebooks.getAgentAccess).toHaveBeenCalledWith('nb1');
    expect(audit.recordToolCall).toHaveBeenCalledWith(
      expect.objectContaining({ notebookId: 'nb1', status: 'success' }),
    );
  });

  it('checks the source notebook when get_source omits notebookId', async () => {
    const { tools, notebooks, sources, audit } = setup(registerSourceTools);
    notebooks.getAgentAccess.mockResolvedValue('off');
    sources.get.mockResolvedValue({
      ...source,
      indexingStatus: null,
      segments: [],
    });

    await expect(
      tools.get('get_source')!.handler({ sourceId: 'src1' }, requestContext()),
    ).rejects.toBeInstanceOf(AgentAccessDeniedError);

    expect(notebooks.getAgentAccess).toHaveBeenCalledWith('nb1');
    expect(audit.recordToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'get_source',
        status: 'denied',
        notebookId: 'nb1',
      }),
    );
  });

  it('rejects invalid base64 before touching storage', async () => {
    const { tools, sources, audit } = setup(registerSourceTools);

    await expect(
      tools.get('add_file_source')!.handler(
        {
          notebookId: 'nb1',
          filename: 'notes.txt',
          contentType: 'text/plain',
          contentBase64: 'not base64!',
        },
        requestContext(),
      ),
    ).rejects.toThrow(/valid base64/);

    expect(sources.createFile).not.toHaveBeenCalled();
    expect(audit.recordToolCall).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: 'add_file_source', status: 'error' }),
    );
  });

  it('decodes valid base64 and enforces the decoded size cap', () => {
    const encoded = Buffer.from('hello world').toString('base64');
    expect(decodeBase64File(encoded).toString('utf8')).toBe('hello world');
    expect(() => decodeBase64File(encoded, 5)).toThrow(/maximum size/);
  });

  it('forwards a decoded file to createFile', async () => {
    const { tools, sources } = setup(registerSourceTools);
    sources.createFile.mockResolvedValue(source);

    const result = await tools.get('add_file_source')!.handler(
      {
        notebookId: 'nb1',
        filename: 'hello.txt',
        contentType: 'text/plain',
        contentBase64: Buffer.from('hello').toString('base64'),
      },
      requestContext(),
    );

    expect(sources.createFile).toHaveBeenCalledWith(
      'nb1',
      Buffer.from('hello'),
      'hello.txt',
      'text/plain',
      undefined,
    );
    expect(structured(result).source).toMatchObject({ id: 'src1' });
  });

  it('returns timedOut without throwing when sources are still processing', async () => {
    const { tools, sources, audit } = setup(registerSourceTools);
    sources.list.mockResolvedValue([
      { ...source, processingStatus: 'processing' },
    ]);

    const result = await tools
      .get('wait_for_sources')!
      .handler({ notebookId: 'nb1', timeoutSeconds: 1 }, requestContext());

    expect(structured(result).timedOut).toBe(true);
    expect(audit.recordToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'wait_for_sources',
        status: 'success',
      }),
    );
  });

  it('emits a progress notification when the client provides a token', async () => {
    const { tools, sources } = setup(registerSourceTools);
    sources.list.mockResolvedValue([source]);
    const mcpCtx = requestContext({ progressToken: 'progress-1' });

    const result = await tools
      .get('wait_for_sources')!
      .handler({ notebookId: 'nb1', timeoutSeconds: 5 }, mcpCtx);

    expect(structured(result).timedOut).toBe(false);
    expect(mcpCtx.mcpReq.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'notifications/progress',
        params: expect.objectContaining({
          progressToken: 'progress-1',
          progress: 1,
          total: 1,
        }),
      }),
    );
  });

  it('stops waiting when the request is aborted', async () => {
    const { tools, sources, audit } = setup(registerSourceTools);
    sources.list.mockResolvedValue([
      { ...source, processingStatus: 'processing' },
    ]);
    const controller = new AbortController();
    controller.abort(new Error('client cancelled'));

    await expect(
      tools
        .get('wait_for_sources')!
        .handler(
          { notebookId: 'nb1', timeoutSeconds: 5 },
          requestContext({ signal: controller.signal }),
        ),
    ).rejects.toThrow('client cancelled');

    expect(audit.recordToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'wait_for_sources',
        status: 'error',
        errorMessage: 'client cancelled',
      }),
    );
  });
});

describe('ask_notebook', () => {
  it('drains the stream and returns the persisted answer with citations', async () => {
    const { tools, chat, audit } = setup(registerAskTools);
    chat.sendMessage.mockResolvedValue({
      streamResponse: new Response('data: {"type":"finish"}\n\n'),
      userMessageId: 'user_1',
    });
    chat.listMessages.mockResolvedValue([
      {
        id: 'user_1',
        role: 'user',
        content: 'What is the main idea?',
        citedSources: [],
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        id: 'assistant_1',
        role: 'assistant',
        content: 'The main idea is grounded [ref:R1].',
        citedSources: [
          {
            citationKey: 'R1',
            number: 1,
            title: 'Test source',
            kind: 'text',
            url: 'https://example.com/article',
            quote: 'A quote',
          },
        ],
        createdAt: new Date('2026-01-01T00:00:01.000Z'),
      },
    ]);

    const result = await tools
      .get('ask_notebook')!
      .handler(
        { notebookId: 'nb1', question: 'What is the main idea?' },
        requestContext(),
      );

    expect(structured(result)).toEqual({
      answer: 'The main idea is grounded [ref:R1].',
      citations: [
        {
          key: 'R1',
          number: 1,
          title: 'Test source',
          kind: 'text',
          url: 'https://example.com/article',
          quote: 'A quote',
        },
      ],
    });
    expect(chat.sendMessage).toHaveBeenCalledWith(
      'nb1',
      expect.objectContaining({
        content: 'What is the main idea?',
        model: 'openai/test-model',
      }),
    );
    expect(audit.recordToolCall).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: 'ask_notebook', status: 'success' }),
    );
  });
});

describe('McpController', () => {
  it('forwards the parsed body to the SDK node handler', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const controller = new McpController({
      getNodeHandler: () => handler,
    } as unknown as McpServerFactory);
    const request = { body: { jsonrpc: '2.0', method: 'tools/list' } };
    const response = {};

    await controller.handlePost(request as never, response as never);

    expect(handler).toHaveBeenCalledWith(request, response, request.body);
  });
});
