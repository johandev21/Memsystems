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
                id: 'user-message-1',
                role: 'user',
                content: 'Explain Plato',
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
          },
        },
        {
          provide: ConnectionService,
          useValue: { requireConnected: vi.fn().mockResolvedValue(undefined) },
        },
        {
          provide: RetrievalService,
          useValue: { retrieveRelevantChunks: vi.fn().mockResolvedValue([]) },
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
});
