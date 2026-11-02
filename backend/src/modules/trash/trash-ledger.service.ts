import { Inject, Injectable, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { DRIZZLE } from '../database/database.module';
import { JobQueueService } from '../jobs/job-queue.service';
import { NotebookFolderService } from '../notebooks/notebook-folder.service';
import { SourceFolderService } from '../sources/folders/source-folder.service';
import { StorageService } from '../storage/storage.service';
import { StudyMaterialFolderService } from '../study-materials/study-material-folder.service';
import { StudyMaterialService } from '../study-materials/study-material.service';
import {
  RETENTION_DAYS,
  TrashItemDto,
  TrashKind,
  TrashListResponse,
  calculateDaysRemaining,
  listTrashItems,
  mapSubtypeLabel,
} from './trash-listing';
import { restoreTrashItem } from './trash-restore';
import {
  emptyAllTrash,
  permanentDeleteTrashItem,
  purgeExpiredTrash,
} from './trash-purge';

export type { TrashItemDto, TrashKind, TrashListResponse };
export { RETENTION_DAYS, calculateDaysRemaining, mapSubtypeLabel };

@Injectable()
export class TrashLedgerService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly notebookFolderService: NotebookFolderService,
    private readonly sourceFolderService: SourceFolderService,
    private readonly studyMaterialFolderService: StudyMaterialFolderService,
    private readonly studyMaterialService: StudyMaterialService,
    private readonly storageService: StorageService,
    @Optional() private readonly jobQueue?: JobQueueService,
  ) {}

  async list(cursor?: string, limit = 30): Promise<TrashListResponse> {
    return listTrashItems(this.db, cursor, limit);
  }

  async restore(
    kind: TrashKind,
    id: string,
  ): Promise<{ success: boolean; id: string; kind: TrashKind }> {
    return restoreTrashItem(
      this.db,
      {
        notebookFolderService: this.notebookFolderService,
        sourceFolderService: this.sourceFolderService,
        studyMaterialFolderService: this.studyMaterialFolderService,
        studyMaterialService: this.studyMaterialService,
      },
      kind,
      id,
    );
  }

  async permanentDelete(
    kind: TrashKind,
    id: string,
  ): Promise<{ success: boolean; id: string; kind: TrashKind }> {
    return permanentDeleteTrashItem(
      this.db,
      this.storageService,
      this.jobQueue,
      kind,
      id,
    );
  }

  async deleteForever(
    kind: TrashKind,
    id: string,
  ): Promise<{ success: boolean; id: string; kind: TrashKind }> {
    return this.permanentDelete(kind, id);
  }

  async emptyTrash(): Promise<{ success: boolean; purged: boolean }> {
    return emptyAllTrash(this.db, this.storageService, this.jobQueue);
  }

  @Cron('0 0 * * *')
  async purgeExpired(retentionDays = RETENTION_DAYS): Promise<void> {
    return purgeExpiredTrash(
      this.db,
      this.storageService,
      this.jobQueue,
      retentionDays,
    );
  }
}
