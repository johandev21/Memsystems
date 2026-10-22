import { EventEmitter } from 'node:events';
import { Test } from '@nestjs/testing';
import type { Response as ExpressResponse } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatController } from '../../src/modules/chat/chat.controller';
import { ChatService } from '../../src/modules/chat/chat.service';

class DisconnectingResponse extends EventEmitter {
  readonly writes: Uint8Array[] = [];
  readonly end = vi.fn(() => {
    this.writableEnded = true;
  });
  readonly setHeader = vi.fn();
  readonly status = vi.fn(() => this);
  destroyed = false;
  writableEnded = false;

  write(value: Uint8Array): boolean {
    this.writes.push(value);
    if (this.writes.length === 1) {
      this.destroyed = true;
      this.emit('close');
    }
    return true;
  }
}

describe('ChatController streaming lifecycle', () => {
  const extractUserMessageContent = vi.fn(() => 'Explain Plato');
  const extractUserMessageParts = vi.fn(() => [
    { type: 'text', text: 'Explain Plato' },
  ]);
  const sendMessage = vi.fn();
  const selectMessage = vi.fn();
  let controller: ChatController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        {
          provide: ChatService,
          useValue: {
            extractUserMessageContent,
            extractUserMessageParts,
            sendMessage,
            selectMessage,
          },
        },
      ],
    }).compile();

    controller = module.get(ChatController);
  });

  it('passes an explicit null root parent through to the chat service', async () => {
    sendMessage.mockResolvedValue({
      streamResponse: new Response(new ReadableStream<Uint8Array>({ start(c) { c.close(); } })),
      userMessageId: 'root-user-1',
    });

    await controller.sendMessage(
      'notebook-1',
      {
        model: 'deepseek/deepseek-v4.1-flash-1017',
        messages: [
          {
            role: 'user',
            parts: [{ type: 'text', text: 'Who was Plato?' }],
          },
        ],
        parentMessageId: null,
      },
      new DisconnectingResponse() as unknown as ExpressResponse,
    );

    expect(sendMessage.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ parentMessageId: null }),
    );
  });

  it('returns the assistant endpoint selected for a completed user branch', async () => {
    selectMessage.mockResolvedValue('assistant-answer');

    await expect(
      controller.selectMessage('notebook-1', { messageId: 'user-branch' }),
    ).resolves.toEqual({ selectedMessageId: 'assistant-answer' });

    expect(selectMessage).toHaveBeenCalledWith('notebook-1', 'user-branch');
  });

  it('aborts generation when the client closes the streaming response', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(streamController) {
        streamController.enqueue(encoder.encode('partial'));
        streamController.enqueue(encoder.encode('should-not-be-written'));
        streamController.close();
      },
    });
    sendMessage.mockResolvedValue({
      streamResponse: new Response(stream),
      userMessageId: 'user-message-1',
    });
    const response = new DisconnectingResponse();

    await controller.sendMessage(
      'notebook-1',
      {
        model: 'openai/gpt-5.6-sol',
        messages: [
          {
            role: 'user',
            parts: [{ type: 'text', text: 'Explain Plato' }],
          },
        ],
      },
      response as unknown as ExpressResponse,
    );

    const sendInput = sendMessage.mock.calls[0]?.[1] as {
      abortSignal?: AbortSignal;
    };
    expect(sendInput.abortSignal?.aborted).toBe(true);
    expect(response.writes).toHaveLength(1);
    expect(response.end).not.toHaveBeenCalled();
  });
});
