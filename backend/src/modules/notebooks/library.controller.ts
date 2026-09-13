import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UsePipes,
} from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { NotebookFolderService } from './notebook-folder.service';
import { NotebooksService } from './notebooks.service';

const createFolderSchema = z.object({
  name: z
    .string()
    .min(1, 'Folder name is required')
    .max(200, 'Folder name must be at most 200 characters'),
  parentId: z.string().nullable().optional(),
});

const updateFolderSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  parentId: z.string().nullable().optional(),
});

@Controller('library')
export class LibraryController {
  constructor(
    private readonly notebookFolderService: NotebookFolderService,
    private readonly notebooksService: NotebooksService,
  ) {}

  @Get()
  async getLibrary() {
    const [folders, notebooks] = await Promise.all([
      this.notebookFolderService.list(),
      this.notebooksService.list(),
    ]);
    return { folders, notebooks };
  }

  @Post('folders')
  @UsePipes(new ZodValidationPipe(createFolderSchema))
  async createFolder(@Body() body: z.infer<typeof createFolderSchema>) {
    return this.notebookFolderService.create(body);
  }

  @Patch('folders/:id')
  @UsePipes(new ZodValidationPipe(updateFolderSchema))
  async updateFolder(
    @Param('id') id: string,
    @Body() body: z.infer<typeof updateFolderSchema>,
  ) {
    return this.notebookFolderService.update(id, body);
  }

  @Delete('folders/:id')
  async deleteFolder(@Param('id') id: string) {
    return this.notebookFolderService.delete(id);
  }
}
