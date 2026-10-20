import {
  ResourceTemplate,
  type CallToolResult,
  type McpServer,
  type ServerContext,
} from '@modelcontextprotocol/server';
import { describe, expect, it, vi } from 'vitest';
import type { McpToolContext } from '../../src/modules/agent-access/mcp/mcp-context';
import { registerAgentPrompts } from '../../src/modules/agent-access/mcp/prompts';
import {
  buildContentJsonSchema,
  readStudyMaterialResource,
  registerAgentResources,
  STUDY_MATERIAL_KINDS,
} from '../../src/modules/agent-access/mcp/resources';
import {
  consumeGenerationStream,
  GenerationStreamEndedError,
  registerMaterialTools,
  sanitizeExportFilename,
} from '../../src/modules/agent-access/mcp/tools/materials.tools';

interface RegisteredTool {
  name: string;
  config: {
    inputSchema?: unknown;
    outputSchema?: unknown;
    annotations?: unknown;
  };
  handler: (args: unknown, ctx: ServerContext) => Promise<CallToolResult>;
}

interface ResourceContents {
  uri: string;
  mimeType?: string;
  text?: string;
}

interface RegisteredResource {
  name: string;
  uriOrTemplate: string | ResourceTemplate;
  config: { title?: string; description?: string; mimeType?: string };
  readCallback: (
    uri: URL,
    second?: unknown,
    third?: unknown,
  ) => Promise<{ contents: ResourceContents[] }>;
}

interface RegisteredPrompt {
  name: string;
  config: { title?: string; description?: string; argsSchema?: unknown };
  handler: (args: unknown) => {
    messages: Array<{
      role: string;
      content: { type: string; text: string };
    }>;
  };
}

function materialRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sm1',
    notebookId: 'nb1',
    kind: 'quiz',
    title: 'Cell biology',
    folderId: null,
    content: {
      title: 'Cell biology',
      questions: [
        {
          id: 'q1',
          prompt: 'What is the powerhouse of the cell?',
          options: [
            { id: 'q1-a', text: 'Nucleus', explanation: 'No.' },
            { id: 'q1-b', text: 'Mitochondria', explanation: 'Yes.' },
          ],
          correctOptionId: 'q1-b',
          hint: '',
          topic: '',
        },
      ],
    },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

function setup() {
  const tools = new Map<string, RegisteredTool>();
  const resources: RegisteredResource[] = [];
  const prompts: RegisteredPrompt[] = [];

  const server = {
    registerTool: (
      name: string,
      config: RegisteredTool['config'],
      handler: RegisteredTool['handler'],
    ) => {
      tools.set(name, { name, config, handler });
    },
    server: { getClientCapabilities: vi.fn().mockReturnValue(undefined) },
    registerResource: (
      name: string,
      uriOrTemplate: string | ResourceTemplate,
      config: RegisteredResource['config'],
      readCallback: RegisteredResource['readCallback'],
    ) => {
      resources.push({ name, uriOrTemplate, config, readCallback });
    },
    registerPrompt: (
      name: string,
      config: RegisteredPrompt['config'],
      handler: RegisteredPrompt['handler'],
    ) => {
      prompts.push({ name, config, handler });
    },
  } as unknown as McpServer;

  const notebooks = { getAgentAccess: vi.fn().mockResolvedValue('on') };
  const sources = {};
  const webSearch = {};
  const chat = {};
  const studyMaterials = {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    buildSlidesPptx: vi.fn(),
  };
  const generation = {
    generate: vi.fn(),
    cancel: vi.fn().mockResolvedValue(undefined),
  };
  const audit = { recordToolCall: vi.fn().mockResolvedValue({}) };
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

  registerMaterialTools(server, ctx);
  registerAgentResources(server, ctx);
  registerAgentPrompts(server);

  return {
    tools,
    resources,
    prompts,
    notebooks,
    studyMaterials,
    generation,
    ctx,
  };
}

function requestContext(
  options: {
    progressToken?: string | number;
    signal?: AbortSignal;
    notify?: ReturnType<typeof vi.fn>;
  } = {},
): ServerContext {
  return {
    mcpReq: {
      signal: options.signal ?? new AbortController().signal,
      _meta:
        options.progressToken !== undefined
          ? { progressToken: options.progressToken }
          : undefined,
      notify: options.notify ?? vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as ServerContext;
}

function structured(result: CallToolResult): Record<string, unknown> {
  return (result.structuredContent ?? {}) as Record<string, unknown>;
}

const encoder = new TextEncoder();

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

function streamFromLines(lines: string[]): ReadableStream<Uint8Array> {
  return streamFromChunks(lines.map((line) => `${line}\n`));
}

const doneFrame = {
  done: true,
  requestId: 'req1',
  materialId: 'sm1',
  grounding: { droppedBlocks: 0, truncatedSourceIds: [] },
};

describe('consumeGenerationStream', () => {
  it('handles partial frames, ignores malformed lines, and returns the done frame', async () => {
    const onFrame = vi.fn();
    const stream = streamFromChunks([
      '{"title":"Cell',
      ' biology","questions":[',
      ']}',
      '\n\n',
      'not json at all\n',
      '{"title":"Cell biology"}\n',
      `${JSON.stringify(doneFrame)}\n`,
    ]);

    const result = await consumeGenerationStream(stream, { onFrame });

    expect(result).toEqual(doneFrame);
    // Only complete content frames count; partial JSON and garbage are skipped.
    expect(onFrame).toHaveBeenCalledTimes(2);
    expect(onFrame).toHaveBeenNthCalledWith(1, 1);
    expect(onFrame).toHaveBeenNthCalledWith(2, 2);
  });

  it('wraps a stream error with the underlying message', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"title":"partial"}\n'));
        controller.error(new Error('provider exploded'));
      },
    });

    await expect(consumeGenerationStream(stream)).rejects.toThrow(
      /Study material generation failed: provider exploded/,
    );
  });

  it('throws when the stream closes without a done frame', async () => {
    const stream = streamFromLines(['{"title":"Cell biology"}']);

    await expect(consumeGenerationStream(stream)).rejects.toBeInstanceOf(
      GenerationStreamEndedError,
    );
  });
});

describe('generate_study_material', () => {
  it('returns the material id and a summary derived from the content', async () => {
    const { tools, studyMaterials, generation } = setup();
    studyMaterials.get.mockResolvedValue(materialRow());
    generation.generate.mockResolvedValue({
      stream: streamFromLines([
        '{"title":"Cell biology"}',
        JSON.stringify(doneFrame),
      ]),
      requestId: 'req1',
    });

    const result = await tools
      .get('generate_study_material')!
      .handler(
        { notebookId: 'nb1', kind: 'quiz' },
        requestContext({ progressToken: 'progress-1' }),
      );

    expect(structured(result)).toEqual({
      materialId: 'sm1',
      requestId: 'req1',
      kind: 'quiz',
      title: 'Cell biology',
      summary: 'Quiz "Cell biology" with 1 question',
      grounding: { droppedBlocks: 0, truncatedSourceIds: [] },
    });
    expect(generation.generate).toHaveBeenCalledWith(
      'nb1',
      expect.objectContaining({ kind: 'quiz', brief: '', sourceIds: [] }),
      expect.any(AbortSignal),
    );
  });

  it('throttles progress notifications and skips them without a token', async () => {
    const { tools, studyMaterials, generation } = setup();
    studyMaterials.get.mockResolvedValue(materialRow());
    const frames = Array.from({ length: 200 }, (_, index) =>
      JSON.stringify({ title: `partial ${index}` }),
    );
    generation.generate.mockImplementation(() =>
      Promise.resolve({
        stream: streamFromLines([...frames, JSON.stringify(doneFrame)]),
        requestId: 'req1',
      }),
    );

    const notify = vi.fn().mockResolvedValue(undefined);
    const withToken = requestContext({
      progressToken: 'progress-1',
      notify,
    });
    await tools
      .get('generate_study_material')!
      .handler({ notebookId: 'nb1', kind: 'quiz' }, withToken);

    const callCount = notify.mock.calls.length;
    expect(callCount).toBeGreaterThanOrEqual(1);
    expect(callCount).toBeLessThan(frames.length / 2);

    const progresses = notify.mock.calls.map(
      (call) => (call[0] as { params: { progress: number } }).params.progress,
    );
    expect(progresses).toEqual([...progresses].sort((a, b) => a - b));
    expect(
      (notify.mock.calls[0][0] as { params: { message?: string } }).params
        .message,
    ).toContain('Generating');

    const withoutToken = requestContext();
    await tools
      .get('generate_study_material')!
      .handler({ notebookId: 'nb1', kind: 'quiz' }, withoutToken);
    expect(withoutToken.mcpReq.notify).not.toHaveBeenCalled();
  });

  it('cancels the generation request when the stream ends after an abort', async () => {
    const { tools, generation } = setup();
    const controller = new AbortController();
    controller.abort();
    generation.generate.mockResolvedValue({
      stream: streamFromLines(['{"title":"Cell biology"}']),
      requestId: 'req1',
    });

    await expect(
      tools
        .get('generate_study_material')!
        .handler(
          { notebookId: 'nb1', kind: 'quiz' },
          requestContext({ signal: controller.signal }),
        ),
    ).rejects.toThrow('Generation cancelled.');

    expect(generation.cancel).toHaveBeenCalledWith('req1');
  });

  it('reports a failed generation with the underlying error', async () => {
    const { tools, generation } = setup();
    generation.generate.mockResolvedValue({
      stream: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.error(new Error('model offline'));
        },
      }),
      requestId: 'req1',
    });

    await expect(
      tools
        .get('generate_study_material')!
        .handler({ notebookId: 'nb1', kind: 'quiz' }, requestContext()),
    ).rejects.toThrow(/model offline/);
    expect(generation.cancel).not.toHaveBeenCalled();
  });
});

describe('export_study_material', () => {
  it('returns base64 PowerPoint bytes for slides', async () => {
    const { tools, studyMaterials } = setup();
    const buffer = Buffer.from('fake-pptx');
    studyMaterials.get.mockResolvedValue(
      materialRow({ kind: 'slides', title: 'Deck 1/2' }),
    );
    studyMaterials.buildSlidesPptx.mockResolvedValue({
      title: 'Deck 1/2',
      buffer,
    });

    const result = await tools
      .get('export_study_material')!
      .handler({ studyMaterialId: 'sm1' }, requestContext());

    expect(structured(result)).toEqual({
      format: 'pptx',
      filename: 'Deck 1 2.pptx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      sizeBytes: buffer.length,
      contentBase64: buffer.toString('base64'),
    });
  });

  it('returns JSON content for other kinds', async () => {
    const { tools, studyMaterials } = setup();
    const row = materialRow({ kind: 'roadmap', title: 'Plan' });
    studyMaterials.get.mockResolvedValue(row);

    const result = await tools
      .get('export_study_material')!
      .handler({ studyMaterialId: 'sm1' }, requestContext());

    expect(structured(result)).toEqual({
      format: 'json',
      filename: 'Plan.json',
      mimeType: 'application/json',
      content: row.content,
    });
    expect(studyMaterials.buildSlidesPptx).not.toHaveBeenCalled();
  });

  it('sanitizes path separators and control characters in filenames', () => {
    const withControlChar = `../../etc/pass${String.fromCharCode(1)}wd`;
    const filename = sanitizeExportFilename(withControlChar, 'json');

    expect(filename).not.toContain('/');
    expect(filename).not.toContain('\\');
    expect(filename).not.toContain('..');
    expect(filename).not.toContain(String.fromCharCode(1));
    expect(filename.endsWith('.json')).toBe(true);
    expect(sanitizeExportFilename('   ', 'json')).toBe('study-material.json');
    expect(
      sanitizeExportFilename('x'.repeat(200), 'json').length,
    ).toBeLessThanOrEqual(85);
  });
});

describe('schema resources', () => {
  it('produces draft 2020-12 JSON Schemas for all five kinds', () => {
    expect(STUDY_MATERIAL_KINDS).toHaveLength(5);

    for (const kind of STUDY_MATERIAL_KINDS) {
      const schema = buildContentJsonSchema(kind);
      expect(schema.$schema).toBe(
        'https://json-schema.org/draft/2020-12/schema',
      );
      expect(schema.type).toBe('object');
    }
  });

  it('registers one readable resource per kind', async () => {
    const { resources } = setup();
    const staticResources = resources.filter(
      (resource) => typeof resource.uriOrTemplate === 'string',
    );

    expect(staticResources).toHaveLength(5);

    for (const kind of STUDY_MATERIAL_KINDS) {
      const uri = `memsystems://schemas/${kind}`;
      const resource = staticResources.find(
        (entry) => entry.uriOrTemplate === uri,
      );
      expect(resource).toBeDefined();
      expect(resource?.config.mimeType).toBe('application/schema+json');

      const result = await resource!.readCallback(new URL(uri));
      const parsed = JSON.parse(result.contents[0].text ?? '{}');
      expect(parsed.$schema).toBe(
        'https://json-schema.org/draft/2020-12/schema',
      );
      expect(parsed.type).toBe('object');
    }
  });
});

describe('study material resource', () => {
  it('returns the material for allowed notebooks', async () => {
    const { resources, studyMaterials } = setup();
    studyMaterials.get.mockResolvedValue(materialRow());
    const template = resources.find(
      (resource) => resource.uriOrTemplate instanceof ResourceTemplate,
    );
    expect(template).toBeDefined();

    const result = await template!.readCallback(
      new URL('memsystems://study-materials/sm1'),
      { id: 'sm1' },
      requestContext(),
    );
    const parsed = JSON.parse(result.contents[0].text ?? '{}');

    expect(parsed).toMatchObject({
      id: 'sm1',
      notebookId: 'nb1',
      kind: 'quiz',
      title: 'Cell biology',
      folderId: null,
    });
    expect(result.contents[0].mimeType).toBe('application/json');
  });

  it('denies notebooks whose Agent Access is off', async () => {
    const { notebooks, studyMaterials, ctx } = setup();
    studyMaterials.get.mockResolvedValue(materialRow());
    notebooks.getAgentAccess.mockResolvedValue('off');

    await expect(readStudyMaterialResource(ctx, 'sm1')).rejects.toThrow(
      'Agent access is off for this notebook.',
    );
  });
});

describe('prompts', () => {
  function promptByName(name: string) {
    const { prompts } = setup();
    const prompt = prompts.find((entry) => entry.name === name);
    expect(prompt).toBeDefined();
    return prompt!;
  }

  it('generate_quiz points at the tool and the quiz schema', () => {
    const message = promptByName('generate_quiz').handler({
      notebookId: 'nb1',
      topic: 'Mitosis',
      questionCount: 5,
    }).messages[0];

    expect(message.role).toBe('user');
    expect(message.content.type).toBe('text');
    expect(message.content.text).toContain('generate_study_material');
    expect(message.content.text).toContain('memsystems://schemas/quiz');
    expect(message.content.text).toContain('questionCount: 5');
  });

  it('author_quiz points at create_study_material and the quiz schema', () => {
    const message = promptByName('author_quiz').handler({
      notebookId: 'nb1',
    }).messages[0];

    expect(message.content.text).toContain('create_study_material');
    expect(message.content.text).toContain('memsystems://schemas/quiz');
    expect(message.content.text).toContain('correctOptionId');
  });

  it('study_from_sources walks through sources, generation, and summary', () => {
    const message = promptByName('study_from_sources').handler({
      notebookId: 'nb1',
    }).messages[0];

    expect(message.content.text).toContain('list_sources');
    expect(message.content.text).toContain('wait_for_sources');
    expect(message.content.text).toContain('generate_study_material');
    expect(message.content.text).toContain('get_study_material');
  });
});
