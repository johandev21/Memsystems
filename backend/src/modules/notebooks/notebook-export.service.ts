import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Response } from 'express';
import { ZipArchive } from 'archiver';
import * as appSchema from '../../database/schema';
import {
  notebooks,
  sourceChunks,
  sourceFolders,
  sources,
  sourceSegments,
  sourceVersions,
  studyMaterialFolders,
  studyMaterials,
} from '../../database/schema';
import { NotFoundError } from '../../common/errors/domain-error';
import { DRIZZLE } from '../database/database.module';
import { StorageService } from '../storage/storage.service';

function sanitizeFilename(name: string): string {
  const slug = name
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'notebook';
}

function getExtension(key: string): string {
  const dot = key.lastIndexOf('.');
  return dot !== -1 ? key.slice(dot) : '';
}

@Injectable()
export class NotebookExportService {
  private readonly logger = new Logger(NotebookExportService.name);

  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly storageService: StorageService,
  ) {}

  async exportNotebook(notebookId: string, res: Response): Promise<void> {
    const [notebook] = await this.db
      .select()
      .from(notebooks)
      .where(and(eq(notebooks.id, notebookId), isNull(notebooks.deletedAt)));

    if (!notebook) {
      throw new NotFoundError('Notebook', {
        messageKey: 'errors.notebooks.notebook.notFound',
      });
    }

    // 1. Gather all notebook contents (excluding chat state)
    const sourceFoldersList = await this.db
      .select({
        id: sourceFolders.id,
        name: sourceFolders.name,
        parentId: sourceFolders.parentId,
        createdAt: sourceFolders.createdAt,
      })
      .from(sourceFolders)
      .where(
        and(
          eq(sourceFolders.notebookId, notebookId),
          isNull(sourceFolders.deletedAt),
        ),
      )
      .orderBy(asc(sourceFolders.createdAt));

    const sourcesList = await this.db
      .select()
      .from(sources)
      .where(and(eq(sources.notebookId, notebookId), isNull(sources.deletedAt)))
      .orderBy(asc(sources.createdAt));

    const sourceIds = sourcesList.map((s) => s.id);

    const versionsList =
      sourceIds.length > 0
        ? await this.db
            .select()
            .from(sourceVersions)
            .where(inArray(sourceVersions.sourceId, sourceIds))
            .orderBy(asc(sourceVersions.createdAt))
        : [];

    const versionIds = versionsList.map((v) => v.id);

    const segmentsList =
      versionIds.length > 0
        ? await this.db
            .select()
            .from(sourceSegments)
            .where(inArray(sourceSegments.sourceVersionId, versionIds))
            .orderBy(asc(sourceSegments.ordinal))
        : [];

    const chunksList = await this.db
      .select({
        id: sourceChunks.id,
        sourceId: sourceChunks.sourceId,
        chunkIndex: sourceChunks.chunkIndex,
        sourceVersionId: sourceChunks.sourceVersionId,
        segmentIds: sourceChunks.segmentIds,
        locator: sourceChunks.locator,
        chunkingVersion: sourceChunks.chunkingVersion,
        contentHash: sourceChunks.contentHash,
        content: sourceChunks.content,
        headingPath: sourceChunks.headingPath,
        sourceKind: sourceChunks.sourceKind,
        contextHeader: sourceChunks.contextHeader,
        searchableText: sourceChunks.searchableText,
        embedding: sourceChunks.embedding,
        createdAt: sourceChunks.createdAt,
      })
      .from(sourceChunks)
      .where(eq(sourceChunks.notebookId, notebookId))
      .orderBy(asc(sourceChunks.chunkIndex));

    const smFoldersList = await this.db
      .select({
        id: studyMaterialFolders.id,
        name: studyMaterialFolders.name,
        parentId: studyMaterialFolders.parentId,
        createdAt: studyMaterialFolders.createdAt,
      })
      .from(studyMaterialFolders)
      .where(
        and(
          eq(studyMaterialFolders.notebookId, notebookId),
          isNull(studyMaterialFolders.deletedAt),
        ),
      )
      .orderBy(asc(studyMaterialFolders.createdAt));

    const smList = await this.db
      .select({
        id: studyMaterials.id,
        folderId: studyMaterials.folderId,
        kind: studyMaterials.kind,
        title: studyMaterials.title,
        content: studyMaterials.content,
        options: studyMaterials.options,
        createdAt: studyMaterials.createdAt,
      })
      .from(studyMaterials)
      .where(
        and(
          eq(studyMaterials.notebookId, notebookId),
          isNull(studyMaterials.deletedAt),
        ),
      )
      .orderBy(desc(studyMaterials.createdAt));

    // 2. Prepare blob file mappings
    const blobEntries: { storageKey: string; archivePath: string }[] = [];

    let bannerArchiveFile: string | null = null;
    if (notebook.banner) {
      const ext = getExtension(notebook.banner) || '.webp';
      bannerArchiveFile = `blobs/banner${ext}`;
      blobEntries.push({
        storageKey: notebook.banner,
        archivePath: bannerArchiveFile,
      });
    }

    const exportedSources = sourcesList.map((src) => {
      let blobFile: string | null = null;
      if (src.s3Key) {
        const ext = getExtension(src.s3Key) || '';
        blobFile = `blobs/source-${src.id}${ext}`;
        blobEntries.push({
          storageKey: src.s3Key,
          archivePath: blobFile,
        });
      }

      return {
        id: src.id,
        folderId: src.folderId,
        kind: src.kind,
        modality: src.modality,
        processingStatus: src.processingStatus,
        addedVia: src.addedVia,
        title: src.title,
        rawText: src.rawText,
        url: src.url,
        contentType: src.contentType,
        fileSize: src.fileSize,
        sha256: src.sha256,
        contentHash: src.contentHash,
        metadata: src.metadata,
        blobFile,
        createdAt: src.createdAt,
      };
    });

    // 3. Configure response and zip archive
    const baseSlug = sanitizeFilename(notebook.title);
    const downloadFilename = `${baseSlug}.memsys`;

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${baseSlug}.memsys"; filename*=UTF-8''${encodeURIComponent(downloadFilename)}`,
    );

    const archive = new ZipArchive({
      zlib: { level: 6 },
    });

    archive.on('error', (err) => {
      this.logger.error(
        `Archiving error during notebook export: ${err.message}`,
        err.stack,
      );
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create export archive' });
      } else {
        res.destroy(err);
      }
    });

    archive.pipe(res);

    // 4. Append manifest & metadata JSON files
    const manifest = {
      version: 1,
      format: 'memsys',
      exportedAt: new Date().toISOString(),
      notebookId: notebook.id,
      title: notebook.title,
      stats: {
        sourceFoldersCount: sourceFoldersList.length,
        sourcesCount: exportedSources.length,
        sourceVersionsCount: versionsList.length,
        sourceSegmentsCount: segmentsList.length,
        sourceChunksCount: chunksList.length,
        studyMaterialFoldersCount: smFoldersList.length,
        studyMaterialsCount: smList.length,
        blobsCount: blobEntries.length,
      },
    };

    const notebookData = {
      id: notebook.id,
      title: notebook.title,
      description: notebook.description,
      icon: notebook.icon,
      groundingMode: notebook.groundingMode,
      bannerFocalPoint: notebook.bannerFocalPoint,
      bannerFile: bannerArchiveFile,
      layout: {
        sourcesCollapsed: false,
        studioCollapsed: false,
        panelSizes: { sources: 20, chat: 60, studio: 20 },
      },
    };

    archive.append(JSON.stringify(manifest, null, 2), {
      name: 'manifest.json',
    });
    archive.append(JSON.stringify(notebookData, null, 2), {
      name: 'notebook.json',
    });
    archive.append(JSON.stringify(sourceFoldersList, null, 2), {
      name: 'sources/folders.json',
    });
    archive.append(JSON.stringify(exportedSources, null, 2), {
      name: 'sources/sources.json',
    });
    archive.append(JSON.stringify(versionsList, null, 2), {
      name: 'sources/versions.json',
    });
    archive.append(JSON.stringify(segmentsList, null, 2), {
      name: 'sources/segments.json',
    });
    archive.append(JSON.stringify(chunksList, null, 2), {
      name: 'sources/chunks.json',
    });
    archive.append(JSON.stringify(smFoldersList, null, 2), {
      name: 'study-materials/folders.json',
    });
    archive.append(JSON.stringify(smList, null, 2), {
      name: 'study-materials/items.json',
    });

    // 5. Append binary blobs safely
    for (const blob of blobEntries) {
      const exists = await this.storageService.objectExists(blob.storageKey);
      if (exists) {
        try {
          const stream = await this.storageService.getObjectStream(
            blob.storageKey,
          );
          archive.append(stream, { name: blob.archivePath });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `Could not stream blob "${blob.storageKey}" for export: ${message}`,
          );
        }
      } else {
        this.logger.warn(
          `Storage key "${blob.storageKey}" not found, omitting from archive`,
        );
      }
    }

    await archive.finalize();
  }
}
