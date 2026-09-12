import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UsePipes,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { BadRequestError } from '../../common/errors/domain-error';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ChatService } from './chat.service';

const textPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
  state: z.enum(['streaming', 'done']).optional(),
});

const reasoningPartSchema = z.object({
  type: z.literal('reasoning'),
  text: z.string(),
  state: z.enum(['streaming', 'done']).optional(),
});

const filePartSchema = z.object({
  type: z.literal('file'),
  mediaType: z.string(),
  url: z.string(),
  filename: z.string().optional(),
});

const messagePartSchema = z.union([
  textPartSchema,
  reasoningPartSchema,
  filePartSchema,
]);

const messageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(['user', 'assistant', 'system']),
  parts: z.array(messagePartSchema).min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const chatRequestSchema = z.object({
  messages: z.array(messageSchema).min(1),
  model: z.string().min(1),
  message: messageSchema.optional(),
  regenerateMessageId: z.string().optional(),
  language: z.string().min(1).max(35).optional(),
});

@Controller('notebooks/:id/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  async list(@Param('id') notebookId: string) {
    return this.chatService.listMessages(notebookId);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(chatRequestSchema))
  async sendMessage(
    @Param('id') notebookId: string,
    @Body() body: z.infer<typeof chatRequestSchema>,
    @Res() res: Response,
  ) {
    const userParts = this.chatService.extractUserMessageParts(body.messages);
    const content = this.chatService.extractUserMessageContent(body.messages);
    const hasFiles = userParts.some(
      (p) => (p as { type: string }).type === 'file',
    );
    if (!content.trim() && !hasFiles) {
      throw new BadRequestError('Empty user message', {
        messageKey: 'errors.chat.message.empty',
      });
    }

    const lastUserMessage = [...body.messages]
      .reverse()
      .find((m) => m.role === 'user');

    const generationController = new AbortController();
    const abortOnDisconnect = () => {
      if (!res.writableEnded && !generationController.signal.aborted) {
        generationController.abort();
      }
    };
    res.once('close', abortOnDisconnect);

    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const { streamResponse } = await this.chatService.sendMessage(
        notebookId,
        {
          content,
          parts: userParts,
          messageId: lastUserMessage?.id,
          regenerateMessageId: body.regenerateMessageId,
          model: body.model,
          language: body.language,
          abortSignal: generationController.signal,
        },
      );

      // Pipe Web Response headers & body directly to Express Response
      res.status(streamResponse.status);
      streamResponse.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });

      if (streamResponse.body) {
        reader = streamResponse.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value && !generationController.signal.aborted && !res.destroyed) {
            res.write(value);
          }
        }
      }

      if (!res.destroyed && !res.writableEnded) {
        res.end();
      }
    } catch (error) {
      if (!generationController.signal.aborted) throw error;
    } finally {
      res.off('close', abortOnDisconnect);
      reader?.releaseLock();
    }
  }

  @Delete()
  async clearMessages(@Param('id') notebookId: string) {
    await this.chatService.clearMessages(notebookId);
    return { success: true };
  }
}
