import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  AgentRateLimit,
  AgentRateLimitGuard,
} from '../agent-access/agent-rate-limit.guard';
import { GenerationService } from './generation/generation.service';
import { StudyMaterialKind } from './content/shapes';
import { StudyMaterialFolderService } from './study-material-folder.service';
import { StudyMaterialService } from './study-material.service';
import { TrashService } from './trash.service';
import { CreateStudyMaterialDto } from './dto/create-study-material.dto';
import { UpdateStudyMaterialDto } from './dto/update-study-material.dto';
import { MoveStudyMaterialDto } from './dto/move-study-material.dto';
import { CreateStudyMaterialFolderDto } from './dto/create-study-material-folder.dto';
import { UpdateStudyMaterialFolderDto } from './dto/update-study-material-folder.dto';
import { GenerateStudyMaterialDto } from './dto/generate-study-material.dto';

export { generateRequestSchema } from './dto/generate-study-material.dto';

@ApiTags('Study Materials')
@Controller()
export class StudyMaterialsController {
  constructor(
    private readonly studyMaterialService: StudyMaterialService,
    private readonly folderService: StudyMaterialFolderService,
    private readonly trashService: TrashService,
    private readonly generationService: GenerationService,
  ) {}

  @Get('notebooks/:notebookId/study-materials')
  @ApiOperation({
    summary: 'List Study Materials',
    description:
      'Lists Study Materials in a Notebook, optionally filtered by Study Material Folder or Kind.',
  })
  @ApiParam({ name: 'notebookId', description: 'Notebook id.' })
  @ApiQuery({
    name: 'folderId',
    required: false,
    description: 'Study Material Folder id.',
  })
  @ApiQuery({
    name: 'kind',
    required: false,
    description: 'Study Material Kind.',
  })
  @ApiOkResponse({ description: 'Study Materials in the Notebook.' })
  async listStudyMaterials(
    @Param('notebookId') notebookId: string,
    @Query('folderId') folderId?: string,
    @Query('kind') kind?: string,
  ) {
    return this.studyMaterialService.list(notebookId, {
      folderId,
      kind: kind as StudyMaterialKind | undefined,
    });
  }

  @Post('notebooks/:notebookId/study-materials')
  @ApiOperation({
    summary: 'Create Study Material',
    description:
      'Creates a Study Material from a complete content object without running a Generation.',
  })
  @ApiParam({ name: 'notebookId', description: 'Notebook id.' })
  @ApiBody({ type: CreateStudyMaterialDto })
  @ApiCreatedResponse({ description: 'The created Study Material.' })
  @UsePipes(new ZodValidationPipe(CreateStudyMaterialDto.schema))
  async createStudyMaterial(
    @Param('notebookId') notebookId: string,
    @Body() body: CreateStudyMaterialDto,
  ) {
    return this.studyMaterialService.create(notebookId, body);
  }

  @Get('study-materials/:id')
  @ApiOperation({
    summary: 'Get Study Material',
    description:
      'Returns one Study Material with its Kind-specific content and Citations.',
  })
  @ApiParam({ name: 'id', description: 'Study Material id.' })
  @ApiOkResponse({ description: 'The Study Material.' })
  async getStudyMaterial(@Param('id') id: string) {
    return this.studyMaterialService.get(id);
  }

  @Get('study-materials/:id/export')
  @ApiOperation({
    summary: 'Export slides',
    description:
      'Builds and downloads a PowerPoint file for a slides Study Material.',
  })
  @ApiParam({ name: 'id', description: 'Study Material id.' })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  )
  @ApiOkResponse({
    description: 'PowerPoint file.',
    content: {
      'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        {
          schema: { type: 'string', format: 'binary' },
        },
    },
  })
  async exportSlides(@Param('id') id: string, @Res() res: Response) {
    const { title, buffer } =
      await this.studyMaterialService.buildSlidesPptx(id);
    const filename = `${title || 'slides'}.pptx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename.replace(/"/g, '')}"`,
    );
    res.setHeader('Content-Length', String(buffer.length));
    res.send(buffer);
  }

  @Patch('study-materials/:id')
  @ApiOperation({
    summary: 'Update Study Material',
    description: 'Updates the title or content of a Study Material.',
  })
  @ApiParam({ name: 'id', description: 'Study Material id.' })
  @ApiBody({ type: UpdateStudyMaterialDto })
  @ApiOkResponse({ description: 'The updated Study Material.' })
  @UsePipes(new ZodValidationPipe(UpdateStudyMaterialDto.schema))
  async updateStudyMaterial(
    @Param('id') id: string,
    @Body() body: UpdateStudyMaterialDto,
  ) {
    return this.studyMaterialService.update(id, body);
  }

  @Delete('study-materials/:id')
  @ApiOperation({
    summary: 'Delete Study Material',
    description:
      'Moves the Study Material to Trash. Restore it from Trash while it is still there.',
  })
  @ApiParam({ name: 'id', description: 'Study Material id.' })
  @ApiOkResponse({ description: 'The deleted Study Material.' })
  async deleteStudyMaterial(@Param('id') id: string) {
    return this.studyMaterialService.delete(id);
  }

  @Post('study-materials/:id/restore')
  @ApiOperation({
    summary: 'Restore Study Material',
    description: 'Restores the Study Material from Trash.',
  })
  @ApiParam({ name: 'id', description: 'Study Material id.' })
  @ApiCreatedResponse({ description: 'The restored Study Material.' })
  async restoreStudyMaterial(@Param('id') id: string) {
    return this.studyMaterialService.restore(id);
  }

  @Delete('study-materials/:id/permanent')
  @ApiOperation({
    summary: 'Permanently delete Study Material',
    description:
      'Permanently deletes the Study Material. This cannot be undone.',
  })
  @ApiParam({ name: 'id', description: 'Study Material id.' })
  @ApiOkResponse({
    description: 'Study Material permanently deleted.',
    schema: {
      type: 'object',
      properties: { success: { type: 'boolean' } },
    },
  })
  async permanentDeleteStudyMaterial(@Param('id') id: string) {
    await this.studyMaterialService.permanentDelete(id);
    return { success: true };
  }

  @Post('study-materials/:id/shuffle')
  @ApiOperation({
    summary: 'Shuffle quiz',
    description:
      'Shuffles the answer options of a quiz Study Material and returns it.',
  })
  @ApiParam({ name: 'id', description: 'Study Material id.' })
  @ApiCreatedResponse({ description: 'The shuffled quiz.' })
  async shuffleQuiz(@Param('id') id: string) {
    return this.studyMaterialService.shuffle(id);
  }

  @Patch('study-materials/:id/move')
  @ApiOperation({
    summary: 'Move Study Material',
    description:
      'Moves the Study Material into a Study Material Folder, or to the notebook root.',
  })
  @ApiParam({ name: 'id', description: 'Study Material id.' })
  @ApiBody({ type: MoveStudyMaterialDto })
  @ApiOkResponse({ description: 'The moved Study Material.' })
  @UsePipes(new ZodValidationPipe(MoveStudyMaterialDto.schema))
  async moveStudyMaterial(
    @Param('id') id: string,
    @Body() body: MoveStudyMaterialDto,
  ) {
    return this.studyMaterialService.move(id, body);
  }

  @Post('study-materials/:id/duplicate')
  @ApiOperation({
    summary: 'Duplicate Study Material',
    description: 'Creates a copy of the Study Material in the same folder.',
  })
  @ApiParam({ name: 'id', description: 'Study Material id.' })
  @ApiCreatedResponse({ description: 'The duplicated Study Material.' })
  async duplicateStudyMaterial(@Param('id') id: string) {
    return this.studyMaterialService.duplicate(id);
  }

  @Get('notebooks/:notebookId/folders')
  @ApiOperation({
    summary: 'List Study Material Folders',
    description: 'Lists the Study Material Folder tree for the Notebook.',
  })
  @ApiParam({ name: 'notebookId', description: 'Notebook id.' })
  @ApiOkResponse({ description: 'Study Material Folders.' })
  async listFolders(@Param('notebookId') notebookId: string) {
    return this.folderService.list(notebookId);
  }

  @Post('notebooks/:notebookId/folders')
  @ApiOperation({
    summary: 'Create Study Material Folder',
    description:
      'Creates a Study Material Folder inside the Notebook, optionally with a parent folder.',
  })
  @ApiParam({ name: 'notebookId', description: 'Notebook id.' })
  @ApiBody({ type: CreateStudyMaterialFolderDto })
  @ApiCreatedResponse({ description: 'The created Study Material Folder.' })
  @UsePipes(new ZodValidationPipe(CreateStudyMaterialFolderDto.schema))
  async createFolder(
    @Param('notebookId') notebookId: string,
    @Body() body: CreateStudyMaterialFolderDto,
  ) {
    return this.folderService.create(notebookId, body);
  }

  @Patch('folders/:id')
  @ApiOperation({
    summary: 'Update Study Material Folder',
    description: 'Renames a Study Material Folder or changes its parent.',
  })
  @ApiParam({ name: 'id', description: 'Study Material Folder id.' })
  @ApiBody({ type: UpdateStudyMaterialFolderDto })
  @ApiOkResponse({ description: 'The updated Study Material Folder.' })
  @UsePipes(new ZodValidationPipe(UpdateStudyMaterialFolderDto.schema))
  async updateFolder(
    @Param('id') id: string,
    @Body() body: UpdateStudyMaterialFolderDto,
  ) {
    return this.folderService.update(id, body);
  }

  @Delete('folders/:id')
  @ApiOperation({
    summary: 'Delete Study Material Folder',
    description: 'Moves the Study Material Folder and its contents to Trash.',
  })
  @ApiParam({ name: 'id', description: 'Study Material Folder id.' })
  @ApiOkResponse({ description: 'The deleted Study Material Folder.' })
  async deleteFolder(@Param('id') id: string) {
    return this.folderService.delete(id);
  }

  @Post('folders/:id/restore')
  @ApiOperation({
    summary: 'Restore Study Material Folder',
    description: 'Restores the Study Material Folder from Trash.',
  })
  @ApiParam({ name: 'id', description: 'Study Material Folder id.' })
  @ApiCreatedResponse({ description: 'The restored Study Material Folder.' })
  async restoreFolder(@Param('id') id: string) {
    return this.folderService.restore(id);
  }

  @Get('notebooks/:notebookId/trash')
  @ApiOperation({
    summary: 'List Trash',
    description:
      'Lists the soft-deleted Study Materials and Study Material Folders in the Notebook.',
  })
  @ApiParam({ name: 'notebookId', description: 'Notebook id.' })
  @ApiOkResponse({ description: 'Trash contents for the Notebook.' })
  async listTrash(@Param('notebookId') notebookId: string) {
    return this.trashService.list(notebookId);
  }

  @Delete('trash/study-materials/:id')
  @ApiOperation({
    summary: 'Permanently delete trashed Study Material',
    description:
      'Permanently deletes one Study Material from Trash. This cannot be undone.',
  })
  @ApiParam({ name: 'id', description: 'Study Material id.' })
  @ApiOkResponse({
    description: 'Study Material permanently deleted.',
    schema: {
      type: 'object',
      properties: { success: { type: 'boolean' } },
    },
  })
  async hardDeleteTrashMaterial(@Param('id') id: string) {
    await this.trashService.hardDeleteStudyMaterial(id);
    return { success: true };
  }

  @Delete('trash/folders/:id')
  @ApiOperation({
    summary: 'Permanently delete trashed Study Material Folder',
    description:
      'Permanently deletes one Study Material Folder from Trash. This cannot be undone.',
  })
  @ApiParam({ name: 'id', description: 'Study Material Folder id.' })
  @ApiOkResponse({
    description: 'Study Material Folder permanently deleted.',
    schema: {
      type: 'object',
      properties: { success: { type: 'boolean' } },
    },
  })
  async hardDeleteTrashFolder(@Param('id') id: string) {
    await this.trashService.hardDeleteFolder(id);
    return { success: true };
  }

  @Post('notebooks/:id/generate')
  @ApiOperation({
    summary: 'Generate Study Material',
    description:
      'Starts a Generation from a Brief and the selected Sources. Writes newline-delimited JSON: zero or more partial content frames, then exactly one terminal `done` or `error` frame. The response also carries the Generation Request id in `X-Generation-Request-Id`; use it to cancel the Generation.',
  })
  @ApiParam({ name: 'id', description: 'Notebook id.' })
  @ApiBody({ type: GenerateStudyMaterialDto })
  @ApiProduces('application/x-ndjson')
  @ApiResponse({
    status: 201,
    description:
      'NDJSON stream of Generation frames. Partial content frames are followed by one terminal `done` or `error` frame.',
    content: {
      'application/x-ndjson': {
        schema: { $ref: '#/components/schemas/GenerationStreamFrame' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description:
      'Generation failed before the stream started. Matches `GenerationFailureResponse`.',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/GenerationFailureResponse' },
      },
    },
  })
  @UseGuards(AgentRateLimitGuard)
  @AgentRateLimit('generate')
  @UsePipes(new ZodValidationPipe(GenerateStudyMaterialDto.schema))
  async generate(
    @Param('id') notebookId: string,
    @Body() body: GenerateStudyMaterialDto,
    @Res() res: Response,
  ) {
    const generationController = new AbortController();
    const abortOnDisconnect = () => {
      if (!res.writableEnded && !generationController.signal.aborted) {
        generationController.abort();
      }
    };
    res.once('close', abortOnDisconnect);

    const { stream, requestId } = await this.generationService.generate(
      notebookId,
      body,
      generationController.signal,
    );

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Generation-Request-Id', requestId);

    const reader = stream.getReader();
    let terminalSent = false;
    const writeTerminalError = (message: string) => {
      if (terminalSent) return;
      terminalSent = true;
      if (!res.headersSent) {
        res
          .status(500)
          .json({ error: message, code: 'generation_failed', requestId });
      } else {
        res.write(`${JSON.stringify({ error: message, requestId })}\n`);
      }
    };
    try {
      while (true) {
        let chunk: ReadableStreamReadResult<Uint8Array>;
        try {
          chunk = await reader.read();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          writeTerminalError(message);
          return;
        }
        if (chunk.done) break;
        if (chunk.value) {
          try {
            const text = Buffer.from(chunk.value).toString('utf8');
            for (const line of text.split('\n')) {
              const candidate = line.trim();
              if (!candidate) continue;
              try {
                const frame: unknown = JSON.parse(candidate);
                if (
                  frame &&
                  typeof frame === 'object' &&
                  ('done' in frame || 'error' in frame)
                ) {
                  terminalSent = true;
                }
              } catch {
                void 0;
              }
            }
          } catch {
            void 0;
          }
          res.write(chunk.value);
        }
      }
      if (!terminalSent) {
        writeTerminalError('Generation stream ended without a terminal frame.');
      }
    } finally {
      res.off('close', abortOnDisconnect);
      try {
        reader.releaseLock();
      } catch {
        void 0;
      }
      if (!res.writableEnded) res.end();
    }
  }

  @Post('notebooks/:id/generation-requests/:requestId/cancel')
  @ApiOperation({
    summary: 'Cancel Generation',
    description:
      'Cancels an in-flight Generation using its Generation Request id.',
  })
  @ApiParam({ name: 'id', description: 'Notebook id.' })
  @ApiParam({ name: 'requestId', description: 'Generation Request id.' })
  @ApiCreatedResponse({
    description: 'Generation cancelled.',
    schema: {
      type: 'object',
      properties: { success: { type: 'boolean' } },
    },
  })
  async cancelGeneration(@Param('requestId') requestId: string) {
    await this.generationService.cancel(requestId);
    return { success: true };
  }
}
