import { Module } from '@nestjs/common';
import { LibraryController } from './library.controller';
import { NotebookFolderService } from './notebook-folder.service';
import { NotebooksController } from './notebooks.controller';
import { NotebooksService } from './notebooks.service';

@Module({
  controllers: [NotebooksController, LibraryController],
  providers: [NotebooksService, NotebookFolderService],
  exports: [NotebooksService, NotebookFolderService],
})
export class NotebooksModule {}
