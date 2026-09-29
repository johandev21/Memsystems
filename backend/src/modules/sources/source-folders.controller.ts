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
import { SourceFolderService } from './source-folder.service';

const createSourceFolderSchema = z.object({
  name: z.string().min(1, 'Folder name cannot be empty').max(200),
  parentId: z.string().nullable().optional(),
});

const updateSourceFolderSchema = z.object({
  name: z.string().min(1, 'Folder name cannot be empty').max(200).optional(),
  parentId: z.string().nullable().optional(),
});

@Controller()
export class SourceFoldersController {
  constructor(private readonly folderService: SourceFolderService) {}

  @Get('notebooks/:notebookId/source-folders')
  async listSourceFolders(@Param('notebookId') notebookId: string) {
    return this.folderService.list(notebookId);
  }

  @Post('notebooks/:notebookId/source-folders')
  @UsePipes(new ZodValidationPipe(createSourceFolderSchema))
  async createSourceFolder(
    @Param('notebookId') notebookId: string,
    @Body() body: z.infer<typeof createSourceFolderSchema>,
  ) {
    return this.folderService.create(notebookId, body);
  }

  @Patch('source-folders/:id')
  @UsePipes(new ZodValidationPipe(updateSourceFolderSchema))
  async updateSourceFolder(
    @Param('id') id: string,
    @Body() body: z.infer<typeof updateSourceFolderSchema>,
  ) {
    return this.folderService.update(id, body);
  }

  @Delete('source-folders/:id')
  async deleteSourceFolder(@Param('id') id: string) {
    return this.folderService.delete(id);
  }
}
