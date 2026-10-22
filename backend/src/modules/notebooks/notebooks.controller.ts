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
  UploadedFile,
  UploadedFiles,
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
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import type { Response } from 'express';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { BadRequestError } from '../../common/errors/domain-error';
import { NotebookExportService } from './notebook-export.service';
import { NotebookImportService } from './notebook-import.service';
import { NotebooksService } from './notebooks.service';
import { CreateNotebookDto } from './dto/create-notebook.dto';
import { UpdateNotebookDto } from './dto/update-notebook.dto';

@ApiTags('Notebooks')
@Controller('notebooks')
export class NotebooksController {
  constructor(
    private readonly notebooksService: NotebooksService,
    private readonly notebookExportService: NotebookExportService,
    private readonly notebookImportService: NotebookImportService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List Notebooks',
    description:
      'Lists Notebooks in the workspace, newest first, with optional pagination and title search.',
  })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer' } })
  @ApiQuery({ name: 'offset', required: false, schema: { type: 'integer' } })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Case-insensitive title search.',
  })
  @ApiOkResponse({ description: 'Notebook summaries.' })
  async list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('search') search?: string,
  ) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;
    const parsedOffset = offset ? Number.parseInt(offset, 10) : undefined;
    return this.notebooksService.list({
      limit: Number.isNaN(parsedLimit) ? undefined : parsedLimit,
      offset: Number.isNaN(parsedOffset) ? undefined : parsedOffset,
      search,
    });
  }

  @Post()
  @ApiOperation({
    summary: 'Create Notebook',
    description:
      'Creates a Notebook and optionally places it in a Library Folder with an Agent Access override.',
  })
  @ApiBody({ type: CreateNotebookDto })
  @ApiCreatedResponse({ description: 'The created Notebook.' })
  @UsePipes(new ZodValidationPipe(CreateNotebookDto.schema))
  async create(@Body() body: CreateNotebookDto) {
    return this.notebooksService.create(body);
  }

  @Post('import')
  @ApiOperation({
    summary: 'Import Notebook',
    description:
      'Imports a previously exported Notebook archive into the Library.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        folderId: {
          type: 'string',
          description:
            'Library Folder that should contain the imported Notebook.',
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'The imported Notebook.' })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }),
  )
  async import(
    @UploadedFile() file?: Express.Multer.File,
    @Body('folderId') folderId?: string,
  ) {
    if (!file) {
      throw new BadRequestError('File is required', {
        messageKey: 'errors.notebooks.import.fileRequired',
      });
    }
    return this.notebookImportService.importNotebook(file.buffer, folderId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get Notebook',
    description:
      'Returns one Notebook with its Library Folder, grounding settings, resolved Agent Access, and banner metadata.',
  })
  @ApiParam({ name: 'id', description: 'Notebook id.' })
  @ApiOkResponse({ description: 'The Notebook.' })
  async get(@Param('id') id: string) {
    return this.notebooksService.get(id);
  }

  @Get(':id/export')
  @ApiOperation({
    summary: 'Export Notebook',
    description:
      'Downloads a portable archive of the Notebook, its Sources, and its Study Materials.',
  })
  @ApiParam({ name: 'id', description: 'Notebook id.' })
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({
    description: 'Notebook archive.',
    content: {
      'application/octet-stream': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  async export(@Param('id') id: string, @Res() res: Response) {
    return this.notebookExportService.exportNotebook(id, res);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update Notebook',
    description:
      'Updates Notebook metadata, Library Folder placement, grounding mode, Agent Access, or the banner focal point.',
  })
  @ApiParam({ name: 'id', description: 'Notebook id.' })
  @ApiBody({ type: UpdateNotebookDto })
  @ApiOkResponse({ description: 'The updated Notebook.' })
  @UsePipes(new ZodValidationPipe(UpdateNotebookDto.schema))
  async update(@Param('id') id: string, @Body() body: UpdateNotebookDto) {
    return this.notebooksService.update(id, body);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete Notebook',
    description:
      'Soft-deletes the Notebook and its contents. Restore it from Trash while it is still there.',
  })
  @ApiParam({ name: 'id', description: 'Notebook id.' })
  @ApiOkResponse({ description: 'The deleted Notebook.' })
  async delete(@Param('id') id: string) {
    return this.notebooksService.delete(id);
  }

  @Post(':id/banner')
  @ApiOperation({
    summary: 'Upload Notebook banner',
    description:
      'Uploads a Banner image and optional pre-rendered size variants, with an optional focal point.',
  })
  @ApiParam({ name: 'id', description: 'Notebook id.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        variant240: { type: 'string', format: 'binary' },
        variant480: { type: 'string', format: 'binary' },
        variant960: { type: 'string', format: 'binary' },
        variant1920: { type: 'string', format: 'binary' },
        focalPoint: {
          type: 'string',
          description: 'JSON object with numeric `x` and `y` in the range 0–1.',
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'The Notebook with its updated Banner.' })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'file', maxCount: 1 },
      { name: 'variant240', maxCount: 1 },
      { name: 'variant480', maxCount: 1 },
      { name: 'variant960', maxCount: 1 },
      { name: 'variant1920', maxCount: 1 },
    ]),
  )
  async uploadBanner(
    @Param('id') id: string,
    @UploadedFiles()
    files?: {
      file?: Express.Multer.File[];
      variant240?: Express.Multer.File[];
      variant480?: Express.Multer.File[];
      variant960?: Express.Multer.File[];
      variant1920?: Express.Multer.File[];
    },
    @Body('focalPoint') focalPointRaw?: string,
  ) {
    let focalPoint: { x: number; y: number } | undefined;
    if (focalPointRaw) {
      try {
        focalPoint = JSON.parse(focalPointRaw) as { x: number; y: number };
      } catch {
        void 0;
      }
    }

    const file = files?.file?.[0];
    if (!file) {
      throw new BadRequestError('File is required', {
        messageKey: 'errors.notebooks.banner.fileRequired',
      });
    }

    const variants = [
      { width: 240 as const, file: files?.variant240?.[0] },
      { width: 480 as const, file: files?.variant480?.[0] },
      { width: 960 as const, file: files?.variant960?.[0] },
      { width: 1920 as const, file: files?.variant1920?.[0] },
    ]
      .filter((entry) => entry.file !== undefined)
      .map((entry) => ({
        width: entry.width,
        buffer: entry.file!.buffer,
        contentType: entry.file!.mimetype,
      }));

    return this.notebooksService.uploadBanner(
      id,
      file.buffer,
      file.originalname,
      file.mimetype,
      focalPoint,
      variants,
    );
  }

  @Delete(':id/banner')
  @ApiOperation({
    summary: 'Remove Notebook banner',
    description:
      'Removes the Banner and its stored variants from the Notebook.',
  })
  @ApiParam({ name: 'id', description: 'Notebook id.' })
  @ApiOkResponse({ description: 'The Notebook without a Banner.' })
  async removeBanner(@Param('id') id: string) {
    return this.notebooksService.removeBanner(id);
  }
}
