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
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { SourceFolderService } from './source-folder.service';
import { CreateSourceFolderDto } from './dto/create-source-folder.dto';
import { UpdateSourceFolderDto } from './dto/update-source-folder.dto';

@ApiTags('Sources')
@Controller()
export class SourceFoldersController {
  constructor(private readonly folderService: SourceFolderService) {}

  @Get('notebooks/:notebookId/source-folders')
  @ApiOperation({
    summary: 'List Source Folders',
    description: 'Lists the Source Folder tree for the Notebook.',
  })
  @ApiParam({ name: 'notebookId', description: 'Notebook id.' })
  @ApiOkResponse({ description: 'Source Folders in the Notebook.' })
  async listSourceFolders(@Param('notebookId') notebookId: string) {
    return this.folderService.list(notebookId);
  }

  @Post('notebooks/:notebookId/source-folders')
  @ApiOperation({
    summary: 'Create Source Folder',
    description:
      'Creates a Source Folder inside the Notebook, optionally with a parent folder.',
  })
  @ApiParam({ name: 'notebookId', description: 'Notebook id.' })
  @ApiBody({ type: CreateSourceFolderDto })
  @ApiCreatedResponse({ description: 'The created Source Folder.' })
  @UsePipes(new ZodValidationPipe(CreateSourceFolderDto.schema))
  async createSourceFolder(
    @Param('notebookId') notebookId: string,
    @Body() body: CreateSourceFolderDto,
  ) {
    return this.folderService.create(notebookId, body);
  }

  @Patch('source-folders/:id')
  @ApiOperation({
    summary: 'Update Source Folder',
    description: 'Renames a Source Folder or changes its parent.',
  })
  @ApiParam({ name: 'id', description: 'Source Folder id.' })
  @ApiBody({ type: UpdateSourceFolderDto })
  @ApiOkResponse({ description: 'The updated Source Folder.' })
  @UsePipes(new ZodValidationPipe(UpdateSourceFolderDto.schema))
  async updateSourceFolder(
    @Param('id') id: string,
    @Body() body: UpdateSourceFolderDto,
  ) {
    return this.folderService.update(id, body);
  }

  @Delete('source-folders/:id')
  @ApiOperation({
    summary: 'Delete Source Folder',
    description: 'Deletes a Source Folder. Its Sources move back to the root.',
  })
  @ApiParam({ name: 'id', description: 'Source Folder id.' })
  @ApiOkResponse({ description: 'The deleted Source Folder.' })
  async deleteSourceFolder(@Param('id') id: string) {
    return this.folderService.delete(id);
  }
}
