import { Logger } from '@nestjs/common';
import JSZip from 'jszip';
import * as appSchema from '../../database/schema';
import { BadRequestError } from '../../common/errors/domain-error';
import { StorageService } from '../storage/storage.service';
import { isPresetBannerId } from './preset-banners';
import { validateContent } from '../study-materials/content/shapes';

export type SourceModality =
  (typeof appSchema.sourceModalityEnum.enumValues)[number];
export type SourceProcessingStatus =
  (typeof appSchema.sourceProcessingStatusEnum.enumValues)[number];
export type SourceAddedVia =
  (typeof appSchema.sourceAddedViaEnum.enumValues)[number];
export type SourceSegmentKind =
  (typeof appSchema.sourceSegmentKindEnum.enumValues)[number];
export type StudyMaterialKind =
  (typeof appSchema.studyMaterialKindEnum.enumValues)[number];

export interface ExportManifest {
  version: number;
  format: string;
  notebookId?: string;
  title?: string;
}

export interface ExportNotebookData {
  id?: string;
  title: string;
  description?: string;
  icon?: string;
  groundingMode?: string;
  bannerFocalPoint?: { x: number; y: number } | null;
  bannerFile?: string | null;
  bannerPreset?: string | null;
}

export interface ExportSourceFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt?: string;
}

export interface ExportSource {
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

export interface ExportVersion {
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

export interface ExportSegment {
  id: string;
  sourceVersionId: string;
  ordinal: number;
  kind: SourceSegmentKind;
  content: string;
  locator: appSchema.SourceSegmentLocator;
  metadata?: appSchema.SourceSegmentMetadata;
  createdAt?: string;
}

export interface ExportChunk {
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

export interface ExportSmFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt?: string;
}

export interface ExportStudyMaterial {
  id: string;
  folderId: string | null;
  kind: StudyMaterialKind;
  title: string;
  content: unknown;
  options?: Record<string, unknown> | null;
  createdAt?: string;
  audioFile?: string;
}

export interface ParsedNotebookArchive {
  zip: JSZip;
  manifest: ExportManifest;
  notebookData: ExportNotebookData;
  sourceFoldersList: ExportSourceFolder[];
  sourcesList: ExportSource[];
  versionsList: ExportVersion[];
  segmentsList: ExportSegment[];
  chunksList: ExportChunk[];
  smFoldersList: ExportSmFolder[];
  smList: ExportStudyMaterial[];
  audioByMaterialId: Map<string, Buffer>;
}

export interface UploadedArchiveBlobs {
  newBannerKey: string | null;
  bannerPreset: string | null;
  sourceS3KeyMap: Map<string, string>;
}

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

const MAX_AUDIO_BYTES = 64 * 1024 * 1024;

function isWav(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 &&
    buffer.length <= MAX_AUDIO_BYTES &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WAVE'
  );
}

async function readArchiveJsonEntry<T>(
  zip: JSZip,
  path: string,
  fallback: T,
  logger: Logger,
): Promise<T> {
  const entry = zip.file(path);
  if (!entry) return fallback;
  try {
    return JSON.parse(await entry.async('string')) as T;
  } catch {
    logger.warn(`Failed to parse ${path} in .memsys archive, using fallback`);
    return fallback;
  }
}

export async function parseNotebookArchive(
  fileBuffer: Buffer,
  logger: Logger,
): Promise<ParsedNotebookArchive> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(fileBuffer);
  } catch {
    throw new BadRequestError('Invalid .memsys file: not a valid zip archive', {
      messageKey: 'errors.notebooks.import.invalidZip',
    });
  }

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

  const sourceFoldersList = await readArchiveJsonEntry<ExportSourceFolder[]>(
    zip,
    'sources/folders.json',
    [],
    logger,
  );
  const sourcesList = await readArchiveJsonEntry<ExportSource[]>(
    zip,
    'sources/sources.json',
    [],
    logger,
  );
  const versionsList = await readArchiveJsonEntry<ExportVersion[]>(
    zip,
    'sources/versions.json',
    [],
    logger,
  );
  const segmentsList = await readArchiveJsonEntry<ExportSegment[]>(
    zip,
    'sources/segments.json',
    [],
    logger,
  );
  const chunksList = await readArchiveJsonEntry<ExportChunk[]>(
    zip,
    'sources/chunks.json',
    [],
    logger,
  );
  const smFoldersList = await readArchiveJsonEntry<ExportSmFolder[]>(
    zip,
    'study-materials/folders.json',
    [],
    logger,
  );
  const smList = await readArchiveJsonEntry<ExportStudyMaterial[]>(
    zip,
    'study-materials/items.json',
    [],
    logger,
  );

  const audioByMaterialId = new Map<string, Buffer>();
  for (const sm of smList) {
    if (sm.kind !== 'audio_overview') continue;
    try {
      validateContent(sm.kind, sm.content);
    } catch {
      throw new BadRequestError('Invalid Audio Overview content in archive', {
        messageKey: 'errors.notebooks.import.invalidArchive',
      });
    }
    if (!sm.audioFile || !sm.audioFile.startsWith('blobs/')) {
      throw new BadRequestError('Audio Overview is missing its WAV file', {
        messageKey: 'errors.notebooks.import.invalidArchive',
      });
    }
    const audioEntry = zip.file(sm.audioFile);
    if (!audioEntry) {
      throw new BadRequestError('Audio Overview is missing its WAV file', {
        messageKey: 'errors.notebooks.import.invalidArchive',
      });
    }
    const audio = await audioEntry.async('nodebuffer');
    if (!isWav(audio)) {
      throw new BadRequestError('Audio Overview WAV is invalid or too large', {
        messageKey: 'errors.notebooks.import.invalidArchive',
      });
    }
    audioByMaterialId.set(sm.id, audio);
  }

  return {
    zip,
    manifest,
    notebookData,
    sourceFoldersList,
    sourcesList,
    versionsList,
    segmentsList,
    chunksList,
    smFoldersList,
    smList,
    audioByMaterialId,
  };
}

export async function uploadArchiveBlobs(
  zip: JSZip,
  notebookData: ExportNotebookData,
  newNotebookId: string,
  sourcesList: ExportSource[],
  sourceIdMap: Map<string, string>,
  storageService: StorageService,
  logger: Logger,
): Promise<UploadedArchiveBlobs> {
  let newBannerKey: string | null = null;
  const bannerPreset =
    notebookData.bannerPreset && isPresetBannerId(notebookData.bannerPreset)
      ? notebookData.bannerPreset
      : null;
  if (
    !bannerPreset &&
    notebookData.bannerFile &&
    zip.file(notebookData.bannerFile)
  ) {
    try {
      const bannerBuffer = await zip
        .file(notebookData.bannerFile)!
        .async('nodebuffer');
      const ext = getExtension(notebookData.bannerFile) || '.webp';
      newBannerKey = `banners/${newNotebookId}${ext}`;
      await storageService.putObject({
        key: newBannerKey,
        body: bannerBuffer,
        contentType: getImageContentType(ext),
      });
    } catch (err: unknown) {
      logger.warn(
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
        await storageService.putObject({
          key: newKey,
          body: blobBuffer,
          contentType: src.contentType || 'application/octet-stream',
        });
        sourceS3KeyMap.set(src.id, newKey);
      } catch (err: unknown) {
        logger.warn(
          `Failed to store source blob for ${src.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  return { newBannerKey, bannerPreset, sourceS3KeyMap };
}
