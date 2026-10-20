import type {
  CallToolResult,
  ElicitResult,
  McpServer,
  ServerContext,
} from '@modelcontextprotocol/server';
import { describe, expect, it, vi } from 'vitest';
import {
  EMPTY_TRASH_DISABLED_MESSAGE,
  NOTEBOOK_DELETE_DISABLED_MESSAGE,
} from '../../src/modules/agent-access/delete-policy';
import type { McpToolContext } from '../../src/modules/agent-access/mcp/mcp-context';
import {
  AgentAccessDeniedError,
} from '../../src/modules/agent-access/mcp/tool-helpers';
import { registerDeleteTools } from '../../src/modules/agent-access/mcp/tools/delete.tools';

interface RegisteredTool {
  name: string;
  config: {
    inputSchema?: unknown;
    outputSchema?: unknown;
    annotations?: unknown;
  };
  handler: (args: unknown, ctx: ServerContext) => Promise<CallToolResult>;
}

const defaultSettings = {
  softDelete: 'ask' as const,
  permanentDelete: 'never' as const,
  resourceDelete: 'never' as const,
  notebookDefault: 'on' as const,
};

function setup() {
  const tools = new Map<string, RegisteredTool>();

  const getClientCapabilities = vi.fn().mockReturnValue(undefined);
  const server = {
    registerTool: (
      name: string,
      config: RegisteredTool['config'],
      handler: RegisteredTool['handler'],
    ) => {
      tools.set(name, { name, config, handler });
    },
    server: { getClientCapabilities },
  } as unknown as McpServer;

  const audit = { recordToolCall: vi.fn().mockResolvedValue({}) };
  const notebooks = {
    getAgentAccess: vi.fn().mockResolvedValue('on'),
    get: vi.fn(),
    delete: vi.fn(),
  };
  const sources = { get: vi.fn(), delete: vi.fn() };
  const studyMaterials = {
    get: vi.fn(),
    delete: vi.fn(),
    permanentDelete: vi.fn(),
  };
  const actions = {
    create: vi.fn(),
    executeDelete: vi.fn().mockResolvedValue(undefined),
    get: vi.fn(),
  };
  const settings = { get: vi.fn().mockResolvedValue(defaultSettings) };

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
      webSearch: {} as McpToolContext['services']['webSearch'],
      chat: {} as McpToolContext['services']['chat'],
      studyMaterials:
        studyMaterials as unknown as McpToolContext['services']['studyMaterials'],
      generation: {} as McpToolContext['services']['generation'],
      audit: audit as unknown as McpToolContext['services']['audit'],
      actions: actions as unknown as McpToolContext['services']['actions'],
      settings: settings as unknown as McpToolContext['services']['settings'],
    },
  };

  registerDeleteTools(server, ctx);

  return {
    tools,
    audit,
    notebooks,
    sources,
    studyMaterials,
    actions,
    settings,
    getClientCapabilities,
    ctx,
  };
}

function requestContext(
  options: {
    elicitInput?: (params: unknown) => Promise<ElicitResult>;
  } = {},
): ServerContext {
  return {
    mcpReq: {
      signal: new AbortController().signal,
      elicitInput: options.elicitInput ?? vi.fn(),
      notify: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as ServerContext;
}

function structured(result: CallToolResult): Record<string, unknown> {
  return (result.structuredContent ?? {}) as Record<string, unknown>;
}

const material = {
  id: 'sm1',
  notebookId: 'nb1',
  title: 'Cell biology',
  kind: 'quiz',
  content: {},
};

const source = {
  id: 'src1',
  notebookId: 'nb1',
  title: 'Reading',
};

const notebook = { id: 'nb1', title: 'Biology' };

describe('MCP delete tools', () => {
  it('executes a soft delete immediately when the policy allows it', async () => {
    const { tools, studyMaterials, actions, audit, settings } = setup();
    settings.get.mockResolvedValue({ ...defaultSettings, softDelete: 'allow' });
    studyMaterials.get.mockResolvedValue(material);

    const result = await tools
      .get('delete_study_material')!
      .handler({ studyMaterialId: 'sm1' }, requestContext());

    expect(structured(result).status).toBe('deleted');
    expect(actions.executeDelete).toHaveBeenCalledWith({
      targetType: 'study_material',
      targetIds: ['sm1'],
      payload: null,
    });
    expect(audit.recordToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'delete_study_material',
        status: 'success',
        notebookId: 'nb1',
      }),
    );
  });

  it('queues a pending action when approval is required and the client cannot elicit', async () => {
    const { tools, studyMaterials, actions, audit } = setup();
    studyMaterials.get.mockResolvedValue(material);
    actions.create.mockResolvedValue({
      id: 'action_1',
      expiresAt: new Date('2026-01-01T00:15:00.000Z'),
    });

    const result = await tools
      .get('delete_study_material')!
      .handler({ studyMaterialId: 'sm1' }, requestContext());

    expect(structured(result)).toMatchObject({
      status: 'awaiting_approval',
      actionId: 'action_1',
      targetType: 'study_material',
      targetIds: ['sm1'],
    });
    expect(actions.executeDelete).not.toHaveBeenCalled();
    expect(actions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        agentKeyId: 'key_1',
        toolName: 'delete_study_material',
        targetType: 'study_material',
        targetIds: ['sm1'],
        notebookId: 'nb1',
      }),
    );
    expect(audit.recordToolCall).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending_approval' }),
    );
  });

  it('executes when the client elicits confirmation', async () => {
    const { tools, studyMaterials, actions, getClientCapabilities } = setup();
    getClientCapabilities.mockReturnValue({ elicitation: { form: {} } });
    studyMaterials.get.mockResolvedValue(material);
    const elicitInput = vi
      .fn()
      .mockResolvedValue({ action: 'accept', content: { confirm: true } });

    const result = await tools
      .get('delete_study_material')!
      .handler(
        { studyMaterialId: 'sm1' },
        requestContext({ elicitInput }),
      );

    expect(elicitInput).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Cell biology'),
        requestedSchema: expect.objectContaining({ type: 'object' }),
      }),
    );
    expect(structured(result).status).toBe('deleted');
    expect(actions.executeDelete).toHaveBeenCalled();
    expect(actions.create).not.toHaveBeenCalled();
  });

  it('denies the delete when elicitation is declined', async () => {
    const { tools, studyMaterials, actions, audit, getClientCapabilities } =
      setup();
    getClientCapabilities.mockReturnValue({ elicitation: { form: {} } });
    studyMaterials.get.mockResolvedValue(material);
    const elicitInput = vi
      .fn()
      .mockResolvedValue({ action: 'accept', content: { confirm: false } });

    await expect(
      tools
        .get('delete_study_material')!
        .handler(
          { studyMaterialId: 'sm1' },
          requestContext({ elicitInput }),
        ),
    ).rejects.toBeInstanceOf(AgentAccessDeniedError);

    expect(actions.executeDelete).not.toHaveBeenCalled();
    expect(audit.recordToolCall).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'denied' }),
    );
  });

  it('refuses notebook deletes with the actionable policy message', async () => {
    const { tools, notebooks, actions, audit } = setup();
    notebooks.get.mockResolvedValue(notebook);

    await expect(
      tools
        .get('delete_notebook')!
        .handler({ notebookId: 'nb1' }, requestContext()),
    ).rejects.toThrow(NOTEBOOK_DELETE_DISABLED_MESSAGE);

    expect(actions.create).not.toHaveBeenCalled();
    expect(actions.executeDelete).not.toHaveBeenCalled();
    expect(audit.recordToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'delete_notebook',
        status: 'denied',
        notebookId: 'nb1',
      }),
    );
  });

  it('queues source deletes when resource deletes are set to ask', async () => {
    const { tools, sources, actions, settings } = setup();
    settings.get.mockResolvedValue({
      ...defaultSettings,
      resourceDelete: 'ask',
    });
    sources.get.mockResolvedValue(source);
    actions.create.mockResolvedValue({
      id: 'action_2',
      expiresAt: new Date('2026-01-01T00:15:00.000Z'),
    });

    const result = await tools
      .get('delete_source')!
      .handler({ sourceId: 'src1' }, requestContext());

    expect(structured(result)).toMatchObject({
      status: 'awaiting_approval',
      actionId: 'action_2',
      targetType: 'source',
    });
    expect(actions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'delete_source',
        targetIds: ['src1'],
        notebookId: 'nb1',
        summary: expect.stringContaining('Reading'),
      }),
    );
  });

  it('refuses empty_trash when permanent deletes are disabled', async () => {
    const { tools, actions } = setup();

    await expect(
      tools.get('empty_trash')!.handler({}, requestContext()),
    ).rejects.toThrow(EMPTY_TRASH_DISABLED_MESSAGE);

    expect(actions.create).not.toHaveBeenCalled();
    expect(actions.executeDelete).not.toHaveBeenCalled();
  });

  it('queues empty_trash when permanent deletes are set to ask', async () => {
    const { tools, actions, settings } = setup();
    settings.get.mockResolvedValue({
      ...defaultSettings,
      permanentDelete: 'ask',
    });
    actions.create.mockResolvedValue({
      id: 'action_3',
      expiresAt: new Date('2026-01-01T00:15:00.000Z'),
    });

    const result = await tools.get('empty_trash')!.handler({}, requestContext());

    expect(structured(result).status).toBe('awaiting_approval');
    expect(actions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: 'trash',
        targetIds: [],
      }),
    );
  });

  it('returns the status of an action owned by the same agent key', async () => {
    const { tools, actions } = setup();
    actions.get.mockResolvedValue({
      id: 'action_1',
      agentKeyId: 'key_1',
      agentKeyName: 'Test key',
      toolName: 'delete_source',
      notebookId: 'nb1',
      targetType: 'source',
      targetIds: ['src1'],
      summary: 'Delete source "Reading" (src1) and move it to Trash.',
      payload: null,
      status: 'pending',
      errorMessage: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      expiresAt: new Date('2026-01-01T00:15:00.000Z'),
      resolvedAt: null,
    });

    const result = await tools
      .get('get_action_status')!
      .handler({ actionId: 'action_1' }, requestContext());

    expect(structured(result)).toMatchObject({
      id: 'action_1',
      status: 'pending',
      targetType: 'source',
    });
  });

  it('hides actions owned by another agent key', async () => {
    const { tools, actions } = setup();
    actions.get.mockResolvedValue({
      id: 'action_1',
      agentKeyId: 'key_2',
      toolName: 'delete_source',
      notebookId: 'nb1',
      targetType: 'source',
      targetIds: ['src1'],
      summary: 'Delete source.',
      status: 'pending',
      errorMessage: null,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      resolvedAt: null,
    });

    await expect(
      tools
        .get('get_action_status')!
        .handler({ actionId: 'action_1' }, requestContext()),
    ).rejects.toThrow('was not found');
  });
});
