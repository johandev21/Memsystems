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
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { BadRequestError } from '../../common/errors/domain-error';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ChatService } from './chat.service';
import { ChatRequestDto } from './dto/chat-request.dto';

@ApiTags('Chat')
@Controller('notebooks/:id/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  @ApiOperation({
    summary: 'List Chat messages',
    description:
      'Returns the persisted Chat messages for the Notebook, including Citations on assistant messages.',
  })
  @ApiParam({ name: 'id', description: 'Notebook id.' })
  @ApiOkResponse({ description: 'Chat messages for the Notebook.' })
  async list(@Param('id') notebookId: string) {
    return this.chatService.listMessages(notebookId);
  }

  @Post()
  @ApiOperation({
    summary: 'Send Chat message',
    description:
      'Starts a Chat Turn. The reply is grounded in the Notebook Sources and streamed as AI SDK UI message frames. Citations appear inline as keys such as `[ref:R1]`; the final `finish` frame lists the cited Sources and citation check counts.',
  })
  @ApiParam({ name: 'id', description: 'Notebook id.' })
  @ApiBody({ type: ChatRequestDto })
  @ApiProduces('text/event-stream')
  @ApiResponse({
    status: 201,
    description: 'Server-sent event stream of Chat UI message frames.',
    content: {
      'text/event-stream': {
        schema: { $ref: '#/components/schemas/ChatUiStreamFrame' },
      },
    },
  })
  @UsePipes(new ZodValidationPipe(ChatRequestDto.schema))
  async sendMessage(
    @Param('id') notebookId: string,
    @Body() body: ChatRequestDto,
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
          groundingMode: body.groundingMode,
          abortSignal: generationController.signal,
        },
      );

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
  @ApiOperation({
    summary: 'Clear Chat',
    description: 'Deletes every Chat message in the Notebook.',
  })
  @ApiParam({ name: 'id', description: 'Notebook id.' })
  @ApiOkResponse({
    description: 'Chat cleared.',
    schema: {
      type: 'object',
      properties: { success: { type: 'boolean' } },
    },
  })
  async clearMessages(@Param('id') notebookId: string) {
    await this.chatService.clearMessages(notebookId);
    return { success: true };
  }
}
