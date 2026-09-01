import {
  Body,
  Controller,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
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
@UseGuards(AuthGuard)
export class SourceUploadsController {
  constructor(private readonly uploadsService: SourceUploadsService) {}

  @Post('notebooks/:notebookId/source-uploads')
  @UsePipes(new ZodValidationPipe(createUploadTargetSchema))
  createTarget(
    @CurrentUser('id') userId: string,
    @Param('notebookId') notebookId: string,
    @Body() body: z.infer<typeof createUploadTargetSchema>,
  ) {
    return this.uploadsService.createTarget(userId, notebookId, body);
  }

  @Put('source-uploads/:token')
  uploadLocal(
    @CurrentUser('id') userId: string,
    @Param('token') token: string,
    @Req() request: Request,
  ) {
    return this.uploadsService.uploadLocal(userId, token, request);
  }

  @Post('notebooks/:notebookId/source-uploads/:token/finalize')
  @UsePipes(new ZodValidationPipe(finalizeUploadSchema))
  finalize(
    @CurrentUser('id') userId: string,
    @Param('notebookId') notebookId: string,
    @Param('token') token: string,
    @Body() body: z.infer<typeof finalizeUploadSchema>,
  ) {
    return this.uploadsService.finalize(userId, notebookId, token, body.title);
  }
}
