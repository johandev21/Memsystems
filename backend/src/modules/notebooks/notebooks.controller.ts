import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { BadRequestError } from '../../common/errors/domain-error';
import { NotebooksService } from './notebooks.service';

const createNotebookSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be at most 200 characters'),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .optional(),
  icon: z.string().max(50, 'Icon must be at most 50 characters').optional(),
});

const updateNotebookSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  bannerFocalPoint: z
    .object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
    })
    .nullable()
    .optional(),
});

@Controller('notebooks')
export class NotebooksController {
  constructor(private readonly notebooksService: NotebooksService) {}

  @Get()
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
  @UsePipes(new ZodValidationPipe(createNotebookSchema))
  async create(@Body() body: z.infer<typeof createNotebookSchema>) {
    return this.notebooksService.create(body);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.notebooksService.get(id);
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(updateNotebookSchema))
  async update(
    @Param('id') id: string,
    @Body() body: z.infer<typeof updateNotebookSchema>,
  ) {
    return this.notebooksService.update(id, body);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.notebooksService.delete(id);
  }

  @Post(':id/banner')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'file', maxCount: 1 },
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
        // Ignore malformed focal point JSON
      }
    }

    const file = files?.file?.[0];
    if (!file) {
      throw new BadRequestError('File is required', {
        messageKey: 'errors.notebooks.banner.fileRequired',
      });
    }

    const variants = [
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
  async removeBanner(@Param('id') id: string) {
    return this.notebooksService.removeBanner(id);
  }
}
