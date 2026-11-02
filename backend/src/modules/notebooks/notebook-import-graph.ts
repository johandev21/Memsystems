import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createId } from '@paralleldrive/cuid2';
import * as appSchema from '../../database/schema';
import { PRESET_BANNER_PREFIX } from './preset-banners';
import { DEFAULT_GROUNDING_MODE, isGroundingMode } from './grounding-mode';
import {
  ExportChunk,
  ExportNotebookData,
  ExportSegment,
  ExportSmFolder,
  ExportSource,
  ExportSourceFolder,
  ExportStudyMaterial,
  ExportVersion,
} from './notebook-archive-reader';

export interface InsertImportedGraphParams {
  db: NodePgDatabase<typeof appSchema>;
  newNotebookId: string;
  resolvedFolderId: string | null;
  notebookData: ExportNotebookData;
  bannerPreset: string | null;
  newBannerKey: string | null;
  sourceFoldersList: ExportSourceFolder[];
  sourceFolderIdMap: Map<string, string>;
  sourcesList: ExportSource[];
  sourceIdMap: Map<string, string>;
  sourceS3KeyMap: Map<string, string>;
  versionsList: ExportVersion[];
  versionIdMap: Map<string, string>;
  segmentsList: ExportSegment[];
  segmentIdMap: Map<string, string>;
  chunksList: ExportChunk[];
  smFoldersList: ExportSmFolder[];
  smFolderIdMap: Map<string, string>;
  smList: ExportStudyMaterial[];
  smIdMap: Map<string, string>;
  audioByMaterialId: Map<string, Buffer>;
}

export async function insertImportedNotebookGraph(
  params: InsertImportedGraphParams,
): Promise<void> {
  const {
    db,
    newNotebookId,
    resolvedFolderId,
    notebookData,
    bannerPreset,
    newBannerKey,
    sourceFoldersList,
    sourceFolderIdMap,
    sourcesList,
    sourceIdMap,
    sourceS3KeyMap,
    versionsList,
    versionIdMap,
    segmentsList,
    segmentIdMap,
    chunksList,
    smFoldersList,
    smFolderIdMap,
    smList,
    smIdMap,
    audioByMaterialId,
  } = params;

  const groundingMode = isGroundingMode(notebookData.groundingMode)
    ? notebookData.groundingMode
    : DEFAULT_GROUNDING_MODE;

  await db.transaction(async (tx) => {
    await tx.insert(appSchema.notebooks).values({
      id: newNotebookId,
      title: notebookData.title,
      description: notebookData.description ?? '',
      icon: notebookData.icon ?? 'notebook',
      folderId: resolvedFolderId,
      banner: bannerPreset
        ? `${PRESET_BANNER_PREFIX}${bannerPreset}`
        : newBannerKey,
      bannerVariants: null,
      bannerFocalPoint: notebookData.bannerFocalPoint ?? null,
      groundingMode,
    });

    const insertedSourceFolders = new Set<string>();
    let pendingSourceFolders = [...sourceFoldersList];
    while (pendingSourceFolders.length > 0) {
      const readyBatch = pendingSourceFolders.filter(
        (f) => !f.parentId || insertedSourceFolders.has(f.parentId),
      );
      if (readyBatch.length === 0) {
        for (const f of pendingSourceFolders) {
          f.parentId = null;
        }
        continue;
      }

      for (const folder of readyBatch) {
        await tx.insert(appSchema.sourceFolders).values({
          id: sourceFolderIdMap.get(folder.id)!,
          notebookId: newNotebookId,
          parentId: folder.parentId
            ? (sourceFolderIdMap.get(folder.parentId) ?? null)
            : null,
          name: folder.name,
          createdAt: folder.createdAt ? new Date(folder.createdAt) : new Date(),
        });
        insertedSourceFolders.add(folder.id);
      }
      pendingSourceFolders = pendingSourceFolders.filter(
        (f) => !insertedSourceFolders.has(f.id),
      );
    }

    for (const src of sourcesList) {
      const newSourceId = sourceIdMap.get(src.id)!;
      await tx.insert(appSchema.sources).values({
        id: newSourceId,
        notebookId: newNotebookId,
        folderId: src.folderId
          ? (sourceFolderIdMap.get(src.folderId) ?? null)
          : null,
        kind: src.kind,
        modality: src.modality ?? null,
        processingStatus: src.processingStatus ?? 'ready',
        processingStage: null,
        addedVia: src.addedVia ?? 'manual',
        metadata: src.metadata ?? null,
        title: src.title,
        rawText: src.rawText ?? '',
        url: src.url ?? null,
        s3Key: sourceS3KeyMap.get(src.id) ?? null,
        contentType: src.contentType ?? null,
        fileSize: src.fileSize ?? null,
        sha256: src.sha256 ?? null,
        contentHash: src.contentHash ?? null,
        createdAt: src.createdAt ? new Date(src.createdAt) : new Date(),
      });
    }

    const versionsBySourceId = new Map<string, string>();
    for (const ver of versionsList) {
      const newVersionId = versionIdMap.get(ver.id)!;
      const newSourceId = sourceIdMap.get(ver.sourceId);
      if (!newSourceId) continue;

      await tx.insert(appSchema.sourceVersions).values({
        id: newVersionId,
        sourceId: newSourceId,
        contentHash: ver.contentHash,
        extractorId: ver.extractorId,
        extractorVersion: ver.extractorVersion,
        normalizationVersion: ver.normalizationVersion ?? 1,
        modelProvider: ver.modelProvider ?? null,
        modelId: ver.modelId ?? null,
        status: ver.status ?? 'ready',
        quality: ver.quality ?? null,
        createdAt: ver.createdAt ? new Date(ver.createdAt) : new Date(),
      });

      if (!versionsBySourceId.has(newSourceId)) {
        versionsBySourceId.set(newSourceId, newVersionId);
      }
    }

    for (const [sourceId, versionId] of versionsBySourceId.entries()) {
      await tx
        .update(appSchema.sources)
        .set({ currentVersionId: versionId })
        .where(eq(appSchema.sources.id, sourceId));
    }

    for (const seg of segmentsList) {
      const newSegId = segmentIdMap.get(seg.id)!;
      const newVersionId = versionIdMap.get(seg.sourceVersionId);
      if (!newVersionId) continue;

      await tx.insert(appSchema.sourceSegments).values({
        id: newSegId,
        sourceVersionId: newVersionId,
        ordinal: seg.ordinal,
        kind: seg.kind,
        content: seg.content,
        locator: seg.locator,
        metadata: seg.metadata ?? {},
        createdAt: seg.createdAt ? new Date(seg.createdAt) : new Date(),
      });
    }

    const chunkRecords = chunksList
      .map((chunk) => {
        const newSourceId = sourceIdMap.get(chunk.sourceId);
        if (!newSourceId) return null;

        const remappedSegmentIds = Array.isArray(chunk.segmentIds)
          ? chunk.segmentIds
              .map((oldId) => segmentIdMap.get(oldId))
              .filter((id): id is string => Boolean(id))
          : [];

        return {
          id: createId(),
          sourceId: newSourceId,
          notebookId: newNotebookId,
          chunkIndex: chunk.chunkIndex,
          sourceVersionId: chunk.sourceVersionId
            ? (versionIdMap.get(chunk.sourceVersionId) ?? null)
            : null,
          segmentIds: remappedSegmentIds,
          locator: chunk.locator ?? null,
          chunkingVersion: chunk.chunkingVersion ?? 1,
          contentHash: chunk.contentHash ?? null,
          content: chunk.content,
          headingPath: chunk.headingPath ?? [],
          sourceKind: chunk.sourceKind,
          contextHeader: chunk.contextHeader ?? '',
          searchableText: chunk.searchableText,
          embedding: chunk.embedding,
          createdAt: chunk.createdAt ? new Date(chunk.createdAt) : new Date(),
        };
      })
      .filter((rec): rec is NonNullable<typeof rec> => rec !== null);

    for (let i = 0; i < chunkRecords.length; i += 100) {
      await tx
        .insert(appSchema.sourceChunks)
        .values(chunkRecords.slice(i, i + 100));
    }

    const insertedSmFolders = new Set<string>();
    let pendingSmFolders = [...smFoldersList];
    while (pendingSmFolders.length > 0) {
      const readyBatch = pendingSmFolders.filter(
        (f) => !f.parentId || insertedSmFolders.has(f.parentId),
      );
      if (readyBatch.length === 0) {
        for (const f of pendingSmFolders) {
          f.parentId = null;
        }
        continue;
      }

      for (const folder of readyBatch) {
        await tx.insert(appSchema.studyMaterialFolders).values({
          id: smFolderIdMap.get(folder.id)!,
          notebookId: newNotebookId,
          parentId: folder.parentId
            ? (smFolderIdMap.get(folder.parentId) ?? null)
            : null,
          name: folder.name,
          createdAt: folder.createdAt ? new Date(folder.createdAt) : new Date(),
        });
        insertedSmFolders.add(folder.id);
      }
      pendingSmFolders = pendingSmFolders.filter(
        (f) => !insertedSmFolders.has(f.id),
      );
    }

    const smRecords = smList.map((sm) => ({
      id: smIdMap.get(sm.id)!,
      notebookId: newNotebookId,
      folderId: sm.folderId ? (smFolderIdMap.get(sm.folderId) ?? null) : null,
      kind: sm.kind,
      title: sm.title,
      content: sm.content,
      options: sm.options ?? null,
      createdAt: sm.createdAt ? new Date(sm.createdAt) : new Date(),
    }));

    for (let i = 0; i < smRecords.length; i += 100) {
      await tx
        .insert(appSchema.studyMaterials)
        .values(smRecords.slice(i, i + 100));
    }

    for (const [oldId, audio] of audioByMaterialId) {
      const studyMaterialId = smIdMap.get(oldId);
      if (!studyMaterialId) continue;
      await tx.insert(appSchema.studyMaterialAudio).values({
        studyMaterialId,
        audio,
        contentType: 'audio/wav',
      });
    }
  });
}
