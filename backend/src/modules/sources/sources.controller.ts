import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { BadRequestError } from '../../common/errors/domain-error';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { SourcesService } from './sources.service';
import { WebSearchJobsService } from './web-search-jobs.service';
import { WebSearchService } from './web-search.service';

const textSourceSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  rawText: z.string().min(1, 'rawText is required'),
});

const urlSourceSchema = z.object({
  url: z.string().min(1, 'URL or identifier is required').max(2048),
  title: z.string().max(500).optional(),
  oauthToken: z.string().max(2048).optional(),
  captionText: z
    .string()
    .max(1024 * 1024)
    .optional(),
  captionFormat: z
    .enum(['vtt', 'srt', 'json3', 'xml', 'plain', 'auto'])
    .optional(),
});

const updateSpeakerLabelsSchema = z.object({
  speakerMap: z.record(z.string().min(1), z.string().min(1)),
});

const addTranscriptSchema = z.object({
  transcriptText: z.string().min(1, 'Transcript text is required'),
});

const webSearchSchema = z.object({
  query: z.string().min(1, 'Query is required').max(500),
  modelId: z.string().min(1, 'modelId is required'),
});

const webSearchImportCandidateSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  title: z.string().max(500).optional(),
  description: z.string().max(500).nullable().optional(),
});

const webSearchImportSchema = z.object({
  candidates: z
    .array(webSearchImportCandidateSchema)
    .min(1, 'At least one candidate is required')
    .max(50, 'Up to 50 candidates allowed per import'),
  modelId: z.string().min(1, 'modelId is required'),
  query: z.string().max(500).optional(),
});

@Controller()
export class SourcesController {
  constructor(
    private readonly sourcesService: SourcesService,
    private readonly webSearchService: WebSearchService,
    private readonly webSearchJobsService: WebSearchJobsService,
  ) {}

  @Get('notebooks/:notebookId/sources')
  async listSources(@Param('notebookId') notebookId: string) {
    return this.sourcesService.list(notebookId);
  }

  @Post('notebooks/:notebookId/sources/text')
  @UsePipes(new ZodValidationPipe(textSourceSchema))
  async createTextSource(
    @Param('notebookId') notebookId: string,
    @Body() body: z.infer<typeof textSourceSchema>,
  ) {
    return this.sourcesService.createText(notebookId, body);
  }

  @Post('notebooks/:notebookId/sources/url')
  @UsePipes(new ZodValidationPipe(urlSourceSchema))
  async createUrlSource(
    @Param('notebookId') notebookId: string,
    @Body() body: z.infer<typeof urlSourceSchema>,
  ) {
    return this.sourcesService.createUrl(notebookId, body);
  }

  @Post('notebooks/:notebookId/sources/file')
  // Keep this compatibility endpoint bounded while larger files use the
  // direct target/stream flow. Multer rejects before exposing file.buffer.
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }),
  )
  async createFileSource(
    @Param('notebookId') notebookId: string,
    @UploadedFile() file?: Express.Multer.File,
    @Body('title') title?: string,
  ) {
    if (!file) {
      throw new BadRequestError('File is required');
    }
    return this.sourcesService.createFile(
      notebookId,
      file.buffer,
      file.originalname,
      file.mimetype,
      title,
    );
  }

  @Get('sources/:id')
  async getSource(@Param('id') id: string) {
    return this.sourcesService.get(id);
  }

  @Post('sources/:id/reindex')
  async reindexSource(@Param('id') id: string) {
    return this.sourcesService.reindex(id);
  }

  @Post('sources/:id/retry')
  async retrySource(@Param('id') id: string) {
    return this.sourcesService.retry(id);
  }

  @Post('sources/:id/cancel')
  async cancelSource(@Param('id') id: string) {
    await this.sourcesService.cancel(id);
  }

  @Delete('sources/:id')
  async deleteSource(@Param('id') id: string) {
    return this.sourcesService.delete(id);
  }

  @Get('sources/:id/download')
  async downloadSource(@Param('id') id: string) {
    return this.sourcesService.getDownload(id);
  }

  @Patch('sources/:id/speakers')
  @UsePipes(new ZodValidationPipe(updateSpeakerLabelsSchema))
  async updateSpeakerLabels(
    @Param('id') id: string,
    @Body() body: z.infer<typeof updateSpeakerLabelsSchema>,
  ) {
    return this.sourcesService.updateSpeakerLabels(id, body.speakerMap);
  }

  @Post('sources/:id/transcript')
  @UsePipes(new ZodValidationPipe(addTranscriptSchema))
  async addTranscript(
    @Param('id') id: string,
    @Body() body: z.infer<typeof addTranscriptSchema>,
  ) {
    return this.sourcesService.addTranscript(id, body.transcriptText);
  }

  @Post('notebooks/:notebookId/sources/reindex')
  async reindexNotebook(@Param('notebookId') notebookId: string) {
    return this.sourcesService.reindexNotebook(notebookId);
  }

  @Post('notebooks/:notebookId/sources/reindex-all')
  async reindexAllSources(@Param('notebookId') notebookId: string) {
    return this.sourcesService.reindexNotebook(notebookId);
  }

  @Post('notebooks/:notebookId/sources/web-search')
  @UsePipes(new ZodValidationPipe(webSearchSchema))
  async webSearch(
    @Param('notebookId') notebookId: string,
    @Body() body: z.infer<typeof webSearchSchema>,
  ) {
    return this.webSearchJobsService.enqueue(notebookId, body);
  }

  @Get('notebooks/:notebookId/sources/web-search/latest')
  async latestWebSearchJob(@Param('notebookId') notebookId: string) {
    return this.webSearchJobsService.latest(notebookId);
  }

  @Delete('notebooks/:notebookId/sources/web-search/latest')
  async dismissWebSearchJob(@Param('notebookId') notebookId: string) {
    await this.webSearchJobsService.dismiss(notebookId);
  }

  @Post('notebooks/:notebookId/sources/web-search/import')
  @UsePipes(new ZodValidationPipe(webSearchImportSchema))
  async webSearchImport(
    @Param('notebookId') notebookId: string,
    @Body() body: z.infer<typeof webSearchImportSchema>,
  ) {
    return this.webSearchService.import(notebookId, {
      candidates: body.candidates,
      modelId: body.modelId,
      query: body.query ?? '',
    });
  }
}
