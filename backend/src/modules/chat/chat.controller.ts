import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { BadRequestError } from '../../common/errors/domain-error';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ChatService } from './chat.service';

const textPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
  state: z.enum(['streaming', 'done']).optional(),
});

const reasoningPartSchema = z.object({
  type: z.literal('reasoning'),
  text: z.string(),
});

const messagePartSchema = z.union([textPartSchema, reasoningPartSchema]);

const messageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(['user', 'assistant']),
  parts: z.array(messagePartSchema).min(1),
});

const chatRequestSchema = z.object({
  messages: z.array(messageSchema).min(1),
  model: z.string().min(1),
});

@Controller('notebooks/:id/chat')
@UseGuards(AuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  async list(
    @CurrentUser('id') userId: string,
    @Param('id') notebookId: string,
  ) {
    return this.chatService.listMessages(userId, notebookId);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(chatRequestSchema))
  async sendMessage(
    @CurrentUser('id') userId: string,
    @Param('id') notebookId: string,
    @Body() body: z.infer<typeof chatRequestSchema>,
    @Res() res: Response,
  ) {
    const content = this.chatService.extractUserMessageContent(body.messages);
    if (!content.trim()) {
      throw new BadRequestError('Empty user message');
    }

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
        userId,
        notebookId,
        {
          content,
          model: body.model,
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
  async clearMessages(
    @CurrentUser('id') userId: string,
    @Param('id') notebookId: string,
  ) {
    await this.chatService.clearMessages(userId, notebookId);
    return { success: true };
  }
}
