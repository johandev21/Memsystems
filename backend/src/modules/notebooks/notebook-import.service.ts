import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import JSZip from 'jszip';
import { createId } from '@paralleldrive/cuid2';
import * as appSchema from '../../database/schema';
import { BadRequestError } from '../../common/errors/domain-error';
import { DRIZZLE } from '../database/database.module';
import { StorageService } from '../storage/storage.service';
import { NotebookResponse, NotebooksService } from './notebooks.service';
import { isGroundingMode, DEFAULT_GROUNDING_MODE } from './grounding-mode';

function getExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot !== -1 ? name.slice(dot) : '';
}

function getImageContentType(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}

type SourceModality = (typeof appSchema.sourceModalityEnum.enumValues)[number];
type SourceProcessingStatus =
  (typeof appSchema.sourceProcessingStatusEnum.enumValues)[number];
type SourceAddedVia = (typeof appSchema.sourceAddedViaEnum.enumValues)[number];
type SourceSegmentKind =
  (typeof appSchema.sourceSegmentKindEnum.enumValues)[number];
type StudyMaterialKind =
  (typeof appSchema.studyMaterialKindEnum.enumValues)[number];

interface ExportManifest {
  version: number;
  format: string;
  notebookId?: string;
  title?: string;
}

interface ExportNotebookData {
  id?: string;
  title: string;
  description?: string;
  icon?: string;
  groundingMode?: string;
  bannerFocalPoint?: { x: number; y: number } | null;
  bannerFile?: string | null;
}

interface ExportSourceFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt?: string;
}

interface ExportSource {
  id: string;
  folderId: string | null;
  kind: appSchema.SourceKind;
  modality: SourceModality | null;
  processingStatus: SourceProcessingStatus;
  addedVia: SourceAddedVia;
  title: string;
  rawText: string;
  url: string | null;
  contentType: string | null;
  fileSize: number | null;
  sha256: string | null;
  contentHash: string | null;
  metadata: appSchema.SourceMetadata | null;
  blobFile: string | null;
  createdAt?: string;
}

interface ExportVersion {
  id: string;
  sourceId: string;
  contentHash: string;
  extractorId: string;
  extractorVersion: string;
  normalizationVersion: number;
  modelProvider?: string | null;
  modelId?: string | null;
  status: SourceProcessingStatus;
  quality?: appSchema.SourceQualityAssessment | null;
  createdAt?: string;
}

interface ExportSegment {
  id: string;
  sourceVersionId: string;
  ordinal: number;
  kind: SourceSegmentKind;
  content: string;
  locator: appSchema.SourceSegmentLocator;
  metadata?: appSchema.SourceSegmentMetadata;
  createdAt?: string;
}

interface ExportChunk {
  id?: string;
  sourceId: string;
  chunkIndex: number;
  sourceVersionId?: string | null;
  segmentIds?: string[] | null;
  locator?: appSchema.SourceSegmentLocator | null;
  chunkingVersion?: number | null;
  contentHash?: string | null;
  content: string;
  headingPath?: string[];
  sourceKind: appSchema.SourceKind;
  contextHeader?: string;
  searchableText: string;
  embedding: number[];
  createdAt?: string;
}

interface ExportSmFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt?: string;
}

interface ExportStudyMaterial {
  id: string;
  folderId: string | null;
  kind: StudyMaterialKind;
  title: string;
  content: unknown;
  options?: Record<string, unknown> | null;
  createdAt?: string;
}

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
    // 1. Unpack archive
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(fileBuffer);
    } catch {
      throw new BadRequestError(
        'Invalid .memsys file: not a valid zip archive',
        {
          messageKey: 'errors.notebooks.import.invalidZip',
        },
      );
    }

    // 2. Validate manifest
    const manifestEntry = zip.file('manifest.json');
    if (!manifestEntry) {
      throw new BadRequestError('Invalid .memsys file: missing manifest.json', {
        messageKey: 'errors.notebooks.import.missingManifest',
      });
    }

    let manifest: ExportManifest;
    try {
      manifest = JSON.parse(
        await manifestEntry.async('string'),
      ) as ExportManifest;
    } catch {
      throw new BadRequestError('Invalid .memsys file: corrupt manifest.json', {
        messageKey: 'errors.notebooks.import.corruptManifest',
      });
    }

    if (manifest.format !== 'memsys') {
      throw new BadRequestError(
        `Unsupported archive format: expected "memsys", received "${manifest.format}"`,
        { messageKey: 'errors.notebooks.import.unsupportedFormat' },
      );
    }

    // 3. Read notebook configuration
    const notebookEntry = zip.file('notebook.json');
    if (!notebookEntry) {
      throw new BadRequestError('Invalid .memsys file: missing notebook.json', {
        messageKey: 'errors.notebooks.import.missingNotebook',
      });
    }

    let notebookData: ExportNotebookData;
    try {
      notebookData = JSON.parse(
        await notebookEntry.async('string'),
      ) as ExportNotebookData;
    } catch {
      throw new BadRequestError('Invalid .memsys file: corrupt notebook.json', {
        messageKey: 'errors.notebooks.import.corruptNotebook',
      });
    }

    if (
      !notebookData.title ||
      typeof notebookData.title !== 'string' ||
      !notebookData.title.trim()
    ) {
      throw new BadRequestError(
        'Invalid .memsys file: missing or invalid title in notebook.json',
        { messageKey: 'errors.notebooks.import.missingTitle' },
      );
    }

    // 4. Read collection structures (defaulting to empty arrays if omitted)
    const readJsonEntry = async <T>(path: string, fallback: T): Promise<T> => {
      const entry = zip.file(path);
      if (!entry) return fallback;
      try {
        return JSON.parse(await entry.async('string')) as T;
      } catch {
        this.logger.warn(
          `Failed to parse ${path} in .memsys archive, using fallback`,
        );
        return fallback;
      }
    };

    const sourceFoldersList = await readJsonEntry<ExportSourceFolder[]>(
      'sources/folders.json',
      [],
    );
    const sourcesList = await readJsonEntry<ExportSource[]>(
      'sources/sources.json',
      [],
    );
    const versionsList = await readJsonEntry<ExportVersion[]>(
      'sources/versions.json',
      [],
    );
    const segmentsList = await readJsonEntry<ExportSegment[]>(
      'sources/segments.json',
      [],
    );
    const chunksList = await readJsonEntry<ExportChunk[]>(
      'sources/chunks.json',
      [],
    );
    const smFoldersList = await readJsonEntry<ExportSmFolder[]>(
      'study-materials/folders.json',
      [],
    );
    const smList = await readJsonEntry<ExportStudyMaterial[]>(
      'study-materials/items.json',
      [],
    );

    // 5. Verify target folder if provided
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

    // 6. Generate fresh IDs for all imported entities
    const newNotebookId = createId();
    const sourceFolderIdMap = new Map<string, string>();
    const sourceIdMap = new Map<string, string>();
    const versionIdMap = new Map<string, string>();
    const segmentIdMap = new Map<string, string>();
    const smFolderIdMap = new Map<string, string>();
    const smIdMap = new Map<string, string>();

    for (const folder of sourceFoldersList) {
      sourceFolderIdMap.set(folder.id, createId());
    }
    for (const src of sourcesList) {
      sourceIdMap.set(src.id, createId());
    }
    for (const ver of versionsList) {
      versionIdMap.set(ver.id, createId());
    }
    for (const seg of segmentsList) {
      segmentIdMap.set(seg.id, createId());
    }
    for (const smf of smFoldersList) {
      smFolderIdMap.set(smf.id, createId());
    }
    for (const sm of smList) {
      smIdMap.set(sm.id, createId());
    }

    // 7. Extract and upload blobs to storage
    let newBannerKey: string | null = null;
    if (notebookData.bannerFile && zip.file(notebookData.bannerFile)) {
      try {
        const bannerBuffer = await zip
          .file(notebookData.bannerFile)!
          .async('nodebuffer');
        const ext = getExtension(notebookData.bannerFile) || '.webp';
        newBannerKey = `banners/${newNotebookId}${ext}`;
        await this.storageService.putObject({
          key: newBannerKey,
          body: bannerBuffer,
          contentType: getImageContentType(ext),
        });
      } catch (err: unknown) {
        this.logger.warn(
          `Failed to store banner blob: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const sourceS3KeyMap = new Map<string, string>();
    for (const src of sourcesList) {
      if (src.blobFile && zip.file(src.blobFile)) {
        try {
          const blobBuffer = await zip.file(src.blobFile)!.async('nodebuffer');
          const ext = getExtension(src.blobFile);
          const newSourceId = sourceIdMap.get(src.id)!;
          const newKey = `sources/${newSourceId}${ext}`;
          await this.storageService.putObject({
            key: newKey,
            body: blobBuffer,
            contentType: src.contentType || 'application/octet-stream',
          });
          sourceS3KeyMap.set(src.id, newKey);
        } catch (err: unknown) {
          this.logger.warn(
            `Failed to store source blob for ${src.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    // 8. Atomic Database Inserts
    const groundingMode = isGroundingMode(notebookData.groundingMode)
      ? notebookData.groundingMode
      : DEFAULT_GROUNDING_MODE;

    await this.db.transaction(async (tx) => {
      // 8a. Insert notebook
      await tx.insert(appSchema.notebooks).values({
        id: newNotebookId,
        title: notebookData.title,
        description: notebookData.description ?? '',
        icon: notebookData.icon ?? 'notebook',
        folderId: resolvedFolderId,
        banner: newBannerKey,
        bannerVariants: null,
        bannerFocalPoint: notebookData.bannerFocalPoint ?? null,
        groundingMode,
      });

      // 8b. Insert source folders (level-by-level to respect parentId FK)
      const insertedSourceFolders = new Set<string>();
      let pendingSourceFolders = [...sourceFoldersList];
      while (pendingSourceFolders.length > 0) {
        const readyBatch = pendingSourceFolders.filter(
          (f) => !f.parentId || insertedSourceFolders.has(f.parentId),
        );
        if (readyBatch.length === 0) {
          // Break potential cycle or dangling parent by re-rooting
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
            createdAt: folder.createdAt
              ? new Date(folder.createdAt)
              : new Date(),
          });
          insertedSourceFolders.add(folder.id);
        }
        pendingSourceFolders = pendingSourceFolders.filter(
          (f) => !insertedSourceFolders.has(f.id),
        );
      }

      // 8c. Insert sources (without currentVersionId initially)
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

      // 8d. Insert source versions
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

        // Track the version to link back to source
        if (!versionsBySourceId.has(newSourceId)) {
          versionsBySourceId.set(newSourceId, newVersionId);
        }
      }

      // Link sources to their version
      for (const [sourceId, versionId] of versionsBySourceId.entries()) {
        await tx
          .update(appSchema.sources)
          .set({ currentVersionId: versionId })
          .where(eq(appSchema.sources.id, sourceId));
      }

      // 8e. Insert source segments
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

      // 8f. Insert source chunks (batched in chunks of 100)
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

      // 8g. Insert study material folders (level-by-level to respect parentId FK)
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
            createdAt: folder.createdAt
              ? new Date(folder.createdAt)
              : new Date(),
          });
          insertedSmFolders.add(folder.id);
        }
        pendingSmFolders = pendingSmFolders.filter(
          (f) => !insertedSmFolders.has(f.id),
        );
      }

      // 8h. Insert study materials (batched in chunks of 100)
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
    });

    return this.notebooksService.get(newNotebookId);
  }
}
