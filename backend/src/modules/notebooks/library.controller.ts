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
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { NotebookFolderService } from './notebook-folder.service';
import { NotebooksService } from './notebooks.service';
import { CreateLibraryFolderDto } from './dto/create-library-folder.dto';
import { UpdateLibraryFolderDto } from './dto/update-library-folder.dto';

@ApiTags('Library')
@Controller('library')
export class LibraryController {
  constructor(
    private readonly notebookFolderService: NotebookFolderService,
    private readonly notebooksService: NotebooksService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get Library',
    description:
      'Returns the Library Folder tree and every Notebook it contains.',
  })
  @ApiOkResponse({
    description: 'Library folders and notebooks.',
    schema: {
      type: 'object',
      properties: {
        folders: { type: 'array', items: { type: 'object' } },
        notebooks: { type: 'array', items: { type: 'object' } },
      },
    },
  })
  async getLibrary() {
    const [folders, notebooks] = await Promise.all([
      this.notebookFolderService.list(),
      this.notebooksService.list(),
    ]);
    return { folders, notebooks };
  }

  @Post('folders')
  @ApiOperation({
    summary: 'Create Library Folder',
    description:
      'Creates a Library Folder, optionally inside another Library Folder.',
  })
  @ApiBody({ type: CreateLibraryFolderDto })
  @ApiCreatedResponse({ description: 'The created Library Folder.' })
  @UsePipes(new ZodValidationPipe(CreateLibraryFolderDto.schema))
  async createFolder(@Body() body: CreateLibraryFolderDto) {
    return this.notebookFolderService.create(body);
  }

  @Patch('folders/:id')
  @ApiOperation({
    summary: 'Update Library Folder',
    description: 'Renames a Library Folder or moves it to another parent.',
  })
  @ApiParam({ name: 'id', description: 'Library Folder id.' })
  @ApiBody({ type: UpdateLibraryFolderDto })
  @ApiOkResponse({ description: 'The updated Library Folder.' })
  @UsePipes(new ZodValidationPipe(UpdateLibraryFolderDto.schema))
  async updateFolder(
    @Param('id') id: string,
    @Body() body: UpdateLibraryFolderDto,
  ) {
    return this.notebookFolderService.update(id, body);
  }

  @Delete('folders/:id')
  @ApiOperation({
    summary: 'Delete Library Folder',
    description:
      'Soft-deletes a Library Folder. Contained Notebooks are handled according to the folder delete rules.',
  })
  @ApiParam({ name: 'id', description: 'Library Folder id.' })
  @ApiOkResponse({ description: 'The deleted Library Folder.' })
  async deleteFolder(@Param('id') id: string) {
    return this.notebookFolderService.delete(id);
  }
}
