import { Module } from '@nestjs/common';
import { LibraryController } from './library.controller';
import { NotebookExportService } from './notebook-export.service';
import { NotebookFolderService } from './notebook-folder.service';
import { NotebooksController } from './notebooks.controller';
import { NotebooksService } from './notebooks.service';

@Module({
  controllers: [NotebooksController, LibraryController],
  providers: [NotebooksService, NotebookFolderService, NotebookExportService],
  exports: [NotebooksService, NotebookFolderService, NotebookExportService],
})
export class NotebooksModule {}
