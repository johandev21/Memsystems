import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { NotebooksModule } from '../notebooks/notebooks.module';
import { StorageModule } from '../storage/storage.module';
import { TrashController } from './trash.controller';
import { TrashLedgerService } from './trash-ledger.service';

@Module({
  imports: [DatabaseModule, NotebooksModule, StorageModule],
  controllers: [TrashController],
  providers: [TrashLedgerService],
  exports: [TrashLedgerService],
})
export class TrashModule {}
