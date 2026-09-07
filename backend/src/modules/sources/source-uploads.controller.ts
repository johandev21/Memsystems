import {
  Body,
  Controller,
  Param,
  Post,
  Put,
  Req,
  UsePipes,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { SourceUploadsService } from './source-uploads.service';

const createUploadTargetSchema = z.object({
  filename: z.string().trim().min(1).max(500),
  contentType: z.string().trim().min(1).max(200),
  size: z.number().int().positive(),
  sha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/i)
    .optional(),
});

const finalizeUploadSchema = z.object({
  title: z.string().trim().max(500).optional(),
});

/** Direct upload control plane. The artifact PUT itself is streamed in local mode. */
@Controller()
export class SourceUploadsController {
  constructor(private readonly uploadsService: SourceUploadsService) {}

  @Post('notebooks/:notebookId/source-uploads')
  @UsePipes(new ZodValidationPipe(createUploadTargetSchema))
  createTarget(
    @Param('notebookId') notebookId: string,
    @Body() body: z.infer<typeof createUploadTargetSchema>,
  ) {
    return this.uploadsService.createTarget(notebookId, body);
  }

  @Put('source-uploads/:token')
  uploadLocal(@Param('token') token: string, @Req() request: Request) {
    return this.uploadsService.uploadLocal(token, request);
  }

  @Post('notebooks/:notebookId/source-uploads/:token/finalize')
  @UsePipes(new ZodValidationPipe(finalizeUploadSchema))
  finalize(
    @Param('notebookId') notebookId: string,
    @Param('token') token: string,
    @Body() body: z.infer<typeof finalizeUploadSchema>,
  ) {
    return this.uploadsService.finalize(notebookId, token, body.title);
  }
}
