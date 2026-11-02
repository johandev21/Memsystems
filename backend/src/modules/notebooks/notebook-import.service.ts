import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createId } from '@paralleldrive/cuid2';
import * as appSchema from '../../database/schema';
import { DRIZZLE } from '../database/database.module';
import { StorageService } from '../storage/storage.service';
import { NotebookResponse, NotebooksService } from './notebooks.service';
import {
  parseNotebookArchive,
  uploadArchiveBlobs,
} from './notebook-archive-reader';
import { insertImportedNotebookGraph } from './notebook-import-graph';

@Injectable()
export class NotebookImportService {
  private readonly logger = new Logger(NotebookImportService.name);

  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly storageService: StorageService,
    private readonly notebooksService: NotebooksService,
  ) {}

  async importNotebook(
    fileBuffer: Buffer,
    targetFolderId?: string | null,
  ): Promise<NotebookResponse> {
    const parsed = await parseNotebookArchive(fileBuffer, this.logger);

    let resolvedFolderId: string | null = null;
    if (targetFolderId) {
      const [existingFolder] = await this.db
        .select({ id: appSchema.notebookFolders.id })
        .from(appSchema.notebookFolders)
        .where(
          and(
            eq(appSchema.notebookFolders.id, targetFolderId),
            isNull(appSchema.notebookFolders.deletedAt),
          ),
        );
      if (existingFolder) {
        resolvedFolderId = existingFolder.id;
      }
    }

    const newNotebookId = createId();
    const sourceFolderIdMap = new Map<string, string>();
    const sourceIdMap = new Map<string, string>();
    const versionIdMap = new Map<string, string>();
    const segmentIdMap = new Map<string, string>();
    const smFolderIdMap = new Map<string, string>();
    const smIdMap = new Map<string, string>();

    for (const folder of parsed.sourceFoldersList) {
      sourceFolderIdMap.set(folder.id, createId());
    }
    for (const src of parsed.sourcesList) {
      sourceIdMap.set(src.id, createId());
    }
    for (const ver of parsed.versionsList) {
      versionIdMap.set(ver.id, createId());
    }
    for (const seg of parsed.segmentsList) {
      segmentIdMap.set(seg.id, createId());
    }
    for (const smf of parsed.smFoldersList) {
      smFolderIdMap.set(smf.id, createId());
    }
    for (const sm of parsed.smList) {
      smIdMap.set(sm.id, createId());
    }

    const { newBannerKey, bannerPreset, sourceS3KeyMap } =
      await uploadArchiveBlobs(
        parsed.zip,
        parsed.notebookData,
        newNotebookId,
        parsed.sourcesList,
        sourceIdMap,
        this.storageService,
        this.logger,
      );

    await insertImportedNotebookGraph({
      db: this.db,
      newNotebookId,
      resolvedFolderId,
      notebookData: parsed.notebookData,
      bannerPreset,
      newBannerKey,
      sourceFoldersList: parsed.sourceFoldersList,
      sourceFolderIdMap,
      sourcesList: parsed.sourcesList,
      sourceIdMap,
      sourceS3KeyMap,
      versionsList: parsed.versionsList,
      versionIdMap,
      segmentsList: parsed.segmentsList,
      segmentIdMap,
      chunksList: parsed.chunksList,
      smFoldersList: parsed.smFoldersList,
      smFolderIdMap,
      smList: parsed.smList,
      smIdMap,
      audioByMaterialId: parsed.audioByMaterialId,
    });

    return this.notebooksService.get(newNotebookId);
  }
}
