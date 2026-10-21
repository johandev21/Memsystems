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
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { BadRequestError } from '../../common/errors/domain-error';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { SourcesService } from './sources.service';
import { WebSearchJobsService } from './acquisition/web-search-jobs.service';
import { WebSearchService } from './acquisition/web-search.service';
import { CreateTextSourceDto } from './dto/create-text-source.dto';
import { CreateUrlSourceDto } from './dto/create-url-source.dto';
import { UpdateSpeakerLabelsDto } from './dto/update-speaker-labels.dto';
import { AddTranscriptDto } from './dto/add-transcript.dto';
import { UpdateSourceDto } from './dto/update-source.dto';
import { MoveSourceDto } from './dto/move-source.dto';
import { WebSearchDto } from './dto/web-search.dto';
import { ImportWebSearchResultsDto } from './dto/import-web-search-results.dto';

@ApiTags('Sources')
@Controller()
export class SourcesController {
  constructor(
    private readonly sourcesService: SourcesService,
    private readonly webSearchService: WebSearchService,
    private readonly webSearchJobsService: WebSearchJobsService,
  ) {}

  @Get('notebooks/:notebookId/sources')
  @ApiOperation({
    summary: 'List Sources',
    description: 'Lists the Sources in a Notebook with their processing state.',
  })
  @ApiParam({ name: 'notebookId', description: 'Notebook id.' })
  @ApiOkResponse({ description: 'Sources in the Notebook.' })
  async listSources(@Param('notebookId') notebookId: string) {
    return this.sourcesService.list(notebookId);
  }

  @Post('notebooks/:notebookId/sources/text')
  @ApiOperation({
    summary: 'Add text Source',
    description:
      'Ingests plain text as a Source. The text is segmented, embedded, and indexed for retrieval.',
  })
  @ApiParam({ name: 'notebookId', description: 'Notebook id.' })
  @ApiBody({ type: CreateTextSourceDto })
  @ApiCreatedResponse({ description: 'The created Source.' })
  @UsePipes(new ZodValidationPipe(CreateTextSourceDto.schema))
  async createTextSource(
    @Param('notebookId') notebookId: string,
    @Body() body: CreateTextSourceDto,
  ) {
    return this.sourcesService.createText(notebookId, body);
  }

  @Post('notebooks/:notebookId/sources/url')
  @ApiOperation({
    summary: 'Add URL Source',
    description:
      'Ingests a URL as a Source, including optional captions or transcripts supplied by the client.',
  })
  @ApiParam({ name: 'notebookId', description: 'Notebook id.' })
  @ApiBody({ type: CreateUrlSourceDto })
  @ApiCreatedResponse({ description: 'The created Source.' })
  @UsePipes(new ZodValidationPipe(CreateUrlSourceDto.schema))
  async createUrlSource(
    @Param('notebookId') notebookId: string,
    @Body() body: CreateUrlSourceDto,
  ) {
    return this.sourcesService.createUrl(notebookId, body);
  }

  @Post('notebooks/:notebookId/sources/file')
  @ApiOperation({
    summary: 'Add file Source',
    description:
      'Uploads a file as a Source. Extraction, transcription, and indexing run in the background.',
  })
  @ApiParam({ name: 'notebookId', description: 'Notebook id.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        title: {
          type: 'string',
          description: 'Optional Source title; defaults to the filename.',
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'The created Source.' })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }),
  )
  async createFileSource(
    @Param('notebookId') notebookId: string,
    @UploadedFile() file?: Express.Multer.File,
    @Body('title') title?: string,
  ) {
    if (!file) {
      throw new BadRequestError('File is required', {
        messageKey: 'errors.sources.create.fileRequired',
      });
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
  @ApiOperation({
    summary: 'Get Source',
    description:
      'Returns one Source with its versions, segments, and processing state.',
  })
  @ApiParam({ name: 'id', description: 'Source id.' })
  @ApiOkResponse({ description: 'The Source.' })
  async getSource(@Param('id') id: string) {
    return this.sourcesService.get(id);
  }

  @Post('sources/:id/reindex')
  @ApiOperation({
    summary: 'Reindex Source',
    description:
      'Re-chunks, re-embeds, and reindexes one Source for retrieval.',
  })
  @ApiParam({ name: 'id', description: 'Source id.' })
  @ApiCreatedResponse({ description: 'The Source after reindexing.' })
  async reindexSource(@Param('id') id: string) {
    return this.sourcesService.reindex(id);
  }

  @Post('sources/:id/retry')
  @ApiOperation({
    summary: 'Retry Source processing',
    description: 'Retries ingestion for a Source that failed to process.',
  })
  @ApiParam({ name: 'id', description: 'Source id.' })
  @ApiCreatedResponse({ description: 'The retried Source.' })
  async retrySource(@Param('id') id: string) {
    return this.sourcesService.retry(id);
  }

  @Post('sources/:id/cancel')
  @ApiOperation({
    summary: 'Cancel Source processing',
    description: 'Cancels an in-flight processing stage for the Source.',
  })
  @ApiParam({ name: 'id', description: 'Source id.' })
  @ApiCreatedResponse({ description: 'Processing cancelled.' })
  async cancelSource(@Param('id') id: string) {
    await this.sourcesService.cancel(id);
  }

  @Delete('sources/:id')
  @ApiOperation({
    summary: 'Delete Source',
    description:
      'Soft-deletes the Source and removes it from retrieval. Restore it from Trash while it is still there.',
  })
  @ApiParam({ name: 'id', description: 'Source id.' })
  @ApiOkResponse({ description: 'The deleted Source.' })
  async deleteSource(@Param('id') id: string) {
    return this.sourcesService.delete(id);
  }

  @Patch('sources/:id')
  @ApiOperation({
    summary: 'Update Source',
    description: 'Renames the Source.',
  })
  @ApiParam({ name: 'id', description: 'Source id.' })
  @ApiBody({ type: UpdateSourceDto })
  @ApiOkResponse({ description: 'The updated Source.' })
  @UsePipes(new ZodValidationPipe(UpdateSourceDto.schema))
  async updateSource(@Param('id') id: string, @Body() body: UpdateSourceDto) {
    return this.sourcesService.update(id, body);
  }

  @Patch('sources/:id/move')
  @ApiOperation({
    summary: 'Move Source',
    description: 'Moves the Source into a Source Folder, or to the root.',
  })
  @ApiParam({ name: 'id', description: 'Source id.' })
  @ApiBody({ type: MoveSourceDto })
  @ApiOkResponse({ description: 'The moved Source.' })
  @UsePipes(new ZodValidationPipe(MoveSourceDto.schema))
  async moveSource(@Param('id') id: string, @Body() body: MoveSourceDto) {
    return this.sourcesService.move(id, body.folderId);
  }

  @Get('sources/:id/download')
  @ApiOperation({
    summary: 'Get Source download link',
    description:
      'Returns a short-lived download link for the Source file, when the Source has one.',
  })
  @ApiParam({ name: 'id', description: 'Source id.' })
  @ApiOkResponse({ description: 'Download information for the Source.' })
  async downloadSource(@Param('id') id: string) {
    return this.sourcesService.getDownload(id);
  }

  @Patch('sources/:id/speakers')
  @ApiOperation({
    summary: 'Update speaker labels',
    description:
      'Replaces raw transcript speaker labels with display names for the Source.',
  })
  @ApiParam({ name: 'id', description: 'Source id.' })
  @ApiBody({ type: UpdateSpeakerLabelsDto })
  @ApiOkResponse({ description: 'The updated Source.' })
  @UsePipes(new ZodValidationPipe(UpdateSpeakerLabelsDto.schema))
  async updateSpeakerLabels(
    @Param('id') id: string,
    @Body() body: UpdateSpeakerLabelsDto,
  ) {
    return this.sourcesService.updateSpeakerLabels(id, body.speakerMap);
  }

  @Post('sources/:id/transcript')
  @ApiOperation({
    summary: 'Add Source transcript',
    description:
      'Attaches a transcript to the Source as a new Source Version and reindexes it.',
  })
  @ApiParam({ name: 'id', description: 'Source id.' })
  @ApiBody({ type: AddTranscriptDto })
  @ApiCreatedResponse({
    description: 'The Source with the new transcript version.',
  })
  @UsePipes(new ZodValidationPipe(AddTranscriptDto.schema))
  async addTranscript(@Param('id') id: string, @Body() body: AddTranscriptDto) {
    return this.sourcesService.addTranscript(id, body.transcriptText);
  }

  @Post('notebooks/:notebookId/sources/reindex')
  @ApiOperation({
    summary: 'Reindex Notebook Sources',
    description:
      'Re-chunks and re-embeds every Source in the Notebook for retrieval.',
  })
  @ApiParam({ name: 'notebookId', description: 'Notebook id.' })
  @ApiCreatedResponse({ description: 'Reindexing started.' })
  async reindexNotebook(@Param('notebookId') notebookId: string) {
    return this.sourcesService.reindexNotebook(notebookId);
  }

  @Post('sources/reembed-all')
  @ApiOperation({
    summary: 'Re-embed all Sources',
    description:
      'Re-embeds every Source chunk in the workspace with the current Embeddings Connection.',
  })
  @ApiCreatedResponse({ description: 'Re-embedding started.' })
  async reembedAllSources() {
    return this.sourcesService.reembedAll();
  }

  @Post('notebooks/:notebookId/sources/reindex-all')
  @ApiOperation({
    summary: 'Reindex all Notebook Sources',
    description:
      'Alias of `reindex` that reindexes every Source in the Notebook.',
  })
  @ApiParam({ name: 'notebookId', description: 'Notebook id.' })
  @ApiCreatedResponse({ description: 'Reindexing started.' })
  async reindexAllSources(@Param('notebookId') notebookId: string) {
    return this.sourcesService.reindexNotebook(notebookId);
  }

  @Post('notebooks/:notebookId/sources/web-search')
  @ApiOperation({
    summary: 'Start Web Search',
    description:
      'Enqueues a Web Search for candidate Sources for the Notebook.',
  })
  @ApiParam({ name: 'notebookId', description: 'Notebook id.' })
  @ApiBody({ type: WebSearchDto })
  @ApiCreatedResponse({ description: 'The queued Web Search job.' })
  @UsePipes(new ZodValidationPipe(WebSearchDto.schema))
  async webSearch(
    @Param('notebookId') notebookId: string,
    @Body() body: WebSearchDto,
  ) {
    return this.webSearchJobsService.enqueue(notebookId, body);
  }

  @Get('notebooks/:notebookId/sources/web-search/latest')
  @ApiOperation({
    summary: 'Get latest Web Search',
    description:
      'Returns the most recent Web Search job for the Notebook, including its candidates.',
  })
  @ApiParam({ name: 'notebookId', description: 'Notebook id.' })
  @ApiOkResponse({ description: 'The latest Web Search job, or null.' })
  async latestWebSearchJob(@Param('notebookId') notebookId: string) {
    return this.webSearchJobsService.latest(notebookId);
  }

  @Delete('notebooks/:notebookId/sources/web-search/latest')
  @ApiOperation({
    summary: 'Dismiss Web Search',
    description: 'Dismisses the latest Web Search job for the Notebook.',
  })
  @ApiParam({ name: 'notebookId', description: 'Notebook id.' })
  @ApiOkResponse({ description: 'Web Search dismissed.' })
  async dismissWebSearchJob(@Param('notebookId') notebookId: string) {
    await this.webSearchJobsService.dismiss(notebookId);
  }

  @Post('notebooks/:notebookId/sources/web-search/import')
  @ApiOperation({
    summary: 'Import Web Search results',
    description:
      'Imports selected Web Search candidates into the Notebook as Sources.',
  })
  @ApiParam({ name: 'notebookId', description: 'Notebook id.' })
  @ApiBody({ type: ImportWebSearchResultsDto })
  @ApiCreatedResponse({ description: 'The imported Sources.' })
  @UsePipes(new ZodValidationPipe(ImportWebSearchResultsDto.schema))
  async webSearchImport(
    @Param('notebookId') notebookId: string,
    @Body() body: ImportWebSearchResultsDto,
  ) {
    return this.webSearchService.import(notebookId, {
      candidates: body.candidates,
      query: body.query ?? '',
    });
  }
}
