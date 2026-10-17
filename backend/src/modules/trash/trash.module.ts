import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { JobsModule } from '../jobs/jobs.module';
import { NotebooksModule } from '../notebooks/notebooks.module';
import { SourcesModule } from '../sources/sources.module';
import { StorageModule } from '../storage/storage.module';
import { StudyMaterialsModule } from '../study-materials/study-materials.module';
import { TrashController } from './trash.controller';
import { TrashLedgerService } from './trash-ledger.service';

@Module({
  imports: [
    DatabaseModule,
    NotebooksModule,
    SourcesModule,
    StudyMaterialsModule,
    StorageModule,
    JobsModule,
  ],
  controllers: [TrashController],
  providers: [TrashLedgerService],
  exports: [TrashLedgerService],
})
export class TrashModule {}
