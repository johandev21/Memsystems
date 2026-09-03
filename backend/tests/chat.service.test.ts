import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiService } from '../src/modules/ai/ai.service';
import { ConnectionService } from '../src/modules/ai/connection.service';
import { RetrievalService } from '../src/modules/ai/retrieval.service';
import { ChatService } from '../src/modules/chat/chat.service';
import { DRIZZLE } from '../src/modules/database/database.module';
import { NotebooksService } from '../src/modules/notebooks/notebooks.service';

const mocks = vi.hoisted(() => ({
  streamText: vi.fn(),
}));

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return { ...actual, streamText: mocks.streamText };
});

describe('ChatService streaming lifecycle', () => {
  let service: ChatService;
  let insertedValues: Record<string, unknown>[];
  let retrieveRelevantChunks: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    insertedValues = [];

    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn().mockResolvedValue([]),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn((values: Record<string, unknown>) => {
          insertedValues.push(values);
          return {
            returning: vi.fn().mockResolvedValue([
              {
                id: (values.id as string) || 'user-message-1',
                role: values.role || 'user',
                content:
                  typeof values.content === 'string'
                    ? values.content
                    : 'Explain Plato',
                parts: values.parts || null,
                citedSourceIds: null,
                createdAt: new Date('2026-08-22T10:00:00.000Z'),
              },
            ]),
          };
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      })),
    };
    const provider = {
      createModel: vi.fn(() => ({ provider: 'test', modelId: 'test-model' })),
    };

    mocks.streamText.mockReturnValue({
      toUIMessageStreamResponse: vi.fn(() => new Response()),
    });

    retrieveRelevantChunks = vi.fn().mockResolvedValue([]);

    const module = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: DRIZZLE, useValue: db },
        {
          provide: NotebooksService,
          useValue: {
            assertNotebookOwner: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AiService,
          useValue: {
            getProviderForModel: vi.fn().mockResolvedValue(provider),
            getGatewayRequestOptions: vi.fn().mockResolvedValue({}),
          },
        },
        {
          provide: ConnectionService,
          useValue: { requireConnected: vi.fn().mockResolvedValue(undefined) },
        },
        {
          provide: RetrievalService,
          useValue: { retrieveRelevantChunks },
        },
      ],
    }).compile();

    service = module.get(ChatService);
  });

  it('passes request cancellation to the model stream', async () => {
    const abortController = new AbortController();

    await service.sendMessage('user-1', 'notebook-1', {
      content: 'Explain Plato',
      model: 'openai/gpt-5.6-sol',
      abortSignal: abortController.signal,
    });

    expect(mocks.streamText).toHaveBeenCalledWith(
      expect.objectContaining({ abortSignal: abortController.signal }),
    );
  });

  it('does not start a model stream after the client has disconnected', async () => {
    const abortController = new AbortController();
    abortController.abort(new Error('Client disconnected'));

    await expect(
      service.sendMessage('user-1', 'notebook-1', {
        content: 'Explain Plato',
        model: 'openai/gpt-5.6-sol',
        abortSignal: abortController.signal,
      }),
    ).rejects.toThrow('Client disconnected');
    expect(mocks.streamText).not.toHaveBeenCalled();
  });

  it('persists partial streamed text on abort using the client-visible message id', async () => {
    await service.sendMessage('user-1', 'notebook-1', {
      content: 'Explain Plato',
      model: 'openai/gpt-5.6-sol',
    });

    const streamOptions = mocks.streamText.mock.calls[0][0] as {
      onChunk: (event: {
        chunk: { type: string; text: string; id: string };
      }) => void;
      onAbort: () => Promise<void>;
    };
    streamOptions.onChunk({
      chunk: { type: 'text-delta', text: 'Justice begins with ', id: 'text-1' },
    });
    streamOptions.onChunk({
      chunk: { type: 'text-delta', text: 'a question.', id: 'text-1' },
    });
    await streamOptions.onAbort();

    const assistantInsert = insertedValues.find(
      (values) => values.role === 'assistant',
    );
    expect(assistantInsert).toMatchObject({
      content: 'Justice begins with a question.',
      citedSourceIds: [],
    });

    const streamResult = mocks.streamText.mock.results[0].value as {
      toUIMessageStreamResponse: ReturnType<typeof vi.fn>;
    };
    const responseOptions = streamResult.toUIMessageStreamResponse.mock
      .calls[0][0] as {
      generateMessageId: () => string;
    };
    expect(responseOptions.generateMessageId()).toBe(assistantInsert?.id);
  });

  it('persists message parts, reasoning, and usage metadata on finish', async () => {
    await service.sendMessage('user-1', 'notebook-1', {
      content: 'Explain the cave allegory',
      model: 'openai/gpt-5.6-sol',
    });

    const streamOptions = mocks.streamText.mock.calls[0][0] as {
      onEnd: (event: {
        text: string;
        reasoning?: string;
        usage?: {
          promptTokens: number;
          completionTokens: number;
          totalTokens: number;
        };
        finishReason?: string;
      }) => Promise<void>;
    };

    await streamOptions.onEnd({
      text: 'The cave represents human perception...',
      reasoning: 'Analyzing Plato Book VII...',
      usage: { inputTokens: 15, outputTokens: 40, totalTokens: 55 } as any,
      finishReason: 'stop',
    });

    const assistantInsert = insertedValues.find(
      (values) => values.role === 'assistant',
    );

    expect(assistantInsert).toMatchObject({
      content: 'The cave represents human perception...',
      reasoning: 'Analyzing Plato Book VII...',
      parts: [
        { type: 'reasoning', text: 'Analyzing Plato Book VII...' },
        { type: 'text', text: 'The cave represents human perception...' },
      ],
      metadata: expect.objectContaining({
        modelId: 'openai/gpt-5.6-sol',
        finishReason: 'stop',
        usage: { inputTokens: 15, outputTokens: 40, totalTokens: 55 },
      }),
    });
  });

  it('persists the gateway generation id for cost lookup', async () => {
    await service.sendMessage('user-1', 'notebook-1', {
      content: 'Explain the cave allegory',
      model: 'openai/gpt-5.6-sol',
    });

    const streamOptions = mocks.streamText.mock.calls[0][0] as {
      onLanguageModelCallEnd: (event: {
        providerMetadata?: Record<string, Record<string, unknown>>;
      }) => void;
      onEnd: (event: {
        text: string;
        finishReason?: string;
      }) => Promise<void>;
    };

    streamOptions.onLanguageModelCallEnd({
      providerMetadata: { gateway: { generationId: 'gen_test123' } },
    });
    await streamOptions.onEnd({
      text: 'The cave represents human perception...',
      finishReason: 'stop',
    });

    const assistantInsert = insertedValues.find(
      (values) => values.role === 'assistant',
    );
    expect(assistantInsert).toMatchObject({
      metadata: expect.objectContaining({
        gatewayGenerationId: 'gen_test123',
      }),
    });
  });

  it('handles multimodal image parts in user messages', async () => {
    await service.sendMessage('user-1', 'notebook-1', {
      content: 'What is shown in this chart?',
      parts: [
        {
          type: 'file',
          mediaType: 'image/png',
          url: 'data:image/png;base64,iVBORw0KGgo=',
        },
        { type: 'text', text: 'What is shown in this chart?' },
      ],
      model: 'openai/gpt-5.6-sol',
    });

    expect(mocks.streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.arrayContaining([
              { type: 'text', text: 'What is shown in this chart?' },
              { type: 'image', image: 'data:image/png;base64,iVBORw0KGgo=' },
            ]),
          }),
        ]),
      }),
    );
  });

  it('sends image-only input without embedding an empty retrieval query', async () => {
    await expect(
      service.sendMessage('user-1', 'notebook-1', {
        content: '',
        parts: [
          {
            type: 'file',
            mediaType: 'image/png',
            url: 'data:image/png;base64,iVBORw0KGgo=',
          },
        ],
        model: 'openai/gpt-5.6-sol',
      }),
    ).resolves.toMatchObject({ userMessageId: expect.any(String) });

    expect(retrieveRelevantChunks).not.toHaveBeenCalled();
    expect(
      insertedValues.find((values) => values.role === 'user'),
    ).toMatchObject({ content: '', parts: [{ type: 'file' }] });
    expect(mocks.streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: [
              { type: 'image', image: 'data:image/png;base64,iVBORw0KGgo=' },
            ],
          }),
        ]),
      }),
    );
  });
});
