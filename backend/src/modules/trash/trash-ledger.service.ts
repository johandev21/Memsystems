import { Inject, Injectable } from '@nestjs/common';
import { isNotNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import {
  notebookFolders,
  notebooks,
  sourceFolders,
  sources,
  studyMaterialFolders,
  studyMaterials,
} from '../../database/schema';
import { DRIZZLE } from '../database/database.module';

export type TrashKind =
  | 'notebook_folder'
  | 'notebook'
  | 'source_folder'
  | 'source'
  | 'study_material_folder'
  | 'study_material';

export interface TrashItemDto {
  id: string;
  name: string;
  kind: TrashKind;
  subtypeLabel?: string;
  notebookId?: string;
  notebookTitle?: string;
  deletedAt: Date;
  daysRemaining: number;
}

export interface TrashListResponse {
  items: TrashItemDto[];
  nextCursor: string | null;
}

const RETENTION_DAYS = 30;

function calculateDaysRemaining(deletedAt: Date): number {
  const elapsedMs = Date.now() - deletedAt.getTime();
  const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
  return Math.max(1, RETENTION_DAYS - elapsedDays);
}

function mapSubtypeLabel(item: {
  kind: TrashKind;
  rawKind?: string;
  contentType?: string | null;
  modality?: string | null;
}): string {
  if (
    item.kind === 'notebook_folder' ||
    item.kind === 'source_folder' ||
    item.kind === 'study_material_folder'
  ) {
    return 'Folder';
  }
  if (item.kind === 'notebook') {
    return 'Notebook';
  }
  if (item.kind === 'study_material') {
    switch (item.rawKind) {
      case 'quiz':
        return 'Quiz';
      case 'simple_flashcard':
        return 'Flashcards';
      case 'mind_map':
        return 'Mind Map';
      case 'roadmap':
        return 'Roadmap';
      case 'study_guide':
        return 'Study Guide';
      case 'cheat_sheet':
        return 'Cheat Sheet';
      default:
        return 'Study Material';
    }
  }
  if (item.kind === 'source') {
    if (item.modality === 'video') return 'Video';
    if (item.modality === 'audio') return 'Audio';
    if (item.modality === 'slides') return 'Slides';
    if (item.modality === 'ebook') return 'Ebook';
    if (item.modality === 'image') return 'Image';
    if (item.modality === 'dataset') return 'Dataset';
    if (item.contentType?.includes('pdf')) return 'PDF';
    if (item.rawKind === 'url') return 'URL';
    if (item.rawKind === 'file') return 'File';
    return 'Text';
  }
  return 'Item';
}

@Injectable()
export class TrashLedgerService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
  ) {}

  async list(cursor?: string, limit = 30): Promise<TrashListResponse> {
    // 1. Fetch deleted notebook_folders whose parent is not deleted
    // To ensure it's a top-level root in trash:
    // Either parent_id is null OR parent notebook_folder is NOT deleted
    const deletedNotebookFolders = await this.db
      .select({
        id: notebookFolders.id,
        name: notebookFolders.name,
        parentId: notebookFolders.parentId,
        deletedAt: notebookFolders.deletedAt,
      })
      .from(notebookFolders)
      .where(isNotNull(notebookFolders.deletedAt));

    const deletedNbFolderIds = new Set(deletedNotebookFolders.map((f) => f.id));
    const rootDeletedNbFolders: TrashItemDto[] = deletedNotebookFolders
      .filter((f) => !f.parentId || !deletedNbFolderIds.has(f.parentId))
      .map((f) => ({
        id: f.id,
        name: f.name,
        kind: 'notebook_folder' as const,
        subtypeLabel: 'Folder',
        deletedAt: f.deletedAt!,
        daysRemaining: calculateDaysRemaining(f.deletedAt!),
      }));

    // 2. Fetch deleted notebooks whose parent notebook_folder (if any) is NOT deleted
    const deletedNotebooks = await this.db
      .select({
        id: notebooks.id,
        title: notebooks.title,
        folderId: notebooks.folderId,
        deletedAt: notebooks.deletedAt,
      })
      .from(notebooks)
      .where(isNotNull(notebooks.deletedAt));

    const rootDeletedNotebooks: TrashItemDto[] = deletedNotebooks
      .filter((nb) => !nb.folderId || !deletedNbFolderIds.has(nb.folderId))
      .map((nb) => ({
        id: nb.id,
        name: nb.title,
        kind: 'notebook' as const,
        subtypeLabel: 'Notebook',
        deletedAt: nb.deletedAt!,
        daysRemaining: calculateDaysRemaining(nb.deletedAt!),
      }));

    const deletedNotebookIds = new Set(deletedNotebooks.map((nb) => nb.id));

    // Helper map of all notebook titles (including alive ones for notebookTitle context)
    const allNotebooks = await this.db
      .select({ id: notebooks.id, title: notebooks.title })
      .from(notebooks);
    const notebookTitleMap = new Map(
      allNotebooks.map((nb) => [nb.id, nb.title]),
    );

    // 3. Fetch deleted source_folders
    // Root in trash if:
    // - parent notebook is NOT deleted (not in deletedNotebookIds)
    // - AND (parentId is null OR parent source_folder is NOT deleted)
    const deletedSourceFolders = await this.db
      .select({
        id: sourceFolders.id,
        name: sourceFolders.name,
        notebookId: sourceFolders.notebookId,
        parentId: sourceFolders.parentId,
        deletedAt: sourceFolders.deletedAt,
      })
      .from(sourceFolders)
      .where(isNotNull(sourceFolders.deletedAt));

    const deletedSrcFolderIds = new Set(deletedSourceFolders.map((f) => f.id));
    const rootDeletedSourceFolders: TrashItemDto[] = deletedSourceFolders
      .filter(
        (f) =>
          !deletedNotebookIds.has(f.notebookId) &&
          (!f.parentId || !deletedSrcFolderIds.has(f.parentId)),
      )
      .map((f) => ({
        id: f.id,
        name: f.name,
        kind: 'source_folder' as const,
        subtypeLabel: 'Folder',
        notebookId: f.notebookId,
        notebookTitle: notebookTitleMap.get(f.notebookId),
        deletedAt: f.deletedAt!,
        daysRemaining: calculateDaysRemaining(f.deletedAt!),
      }));

    // 4. Fetch deleted sources
    // Root in trash if:
    // - parent notebook is NOT deleted
    // - AND (folderId is null OR parent source_folder is NOT deleted)
    const deletedSources = await this.db
      .select({
        id: sources.id,
        title: sources.title,
        kind: sources.kind,
        contentType: sources.contentType,
        modality: sources.modality,
        notebookId: sources.notebookId,
        folderId: sources.folderId,
        deletedAt: sources.deletedAt,
      })
      .from(sources)
      .where(isNotNull(sources.deletedAt));

    const rootDeletedSources: TrashItemDto[] = deletedSources
      .filter(
        (s) =>
          !deletedNotebookIds.has(s.notebookId) &&
          (!s.folderId || !deletedSrcFolderIds.has(s.folderId)),
      )
      .map((s) => ({
        id: s.id,
        name: s.title,
        kind: 'source' as const,
        subtypeLabel: mapSubtypeLabel({
          kind: 'source',
          rawKind: s.kind,
          contentType: s.contentType,
          modality: s.modality,
        }),
        notebookId: s.notebookId,
        notebookTitle: notebookTitleMap.get(s.notebookId),
        deletedAt: s.deletedAt!,
        daysRemaining: calculateDaysRemaining(s.deletedAt!),
      }));

    // 5. Fetch deleted study_material_folders
    // Root in trash if:
    // - parent notebook is NOT deleted
    // - AND (parentId is null OR parent study_material_folder is NOT deleted)
    const deletedSmFolders = await this.db
      .select({
        id: studyMaterialFolders.id,
        name: studyMaterialFolders.name,
        notebookId: studyMaterialFolders.notebookId,
        parentId: studyMaterialFolders.parentId,
        deletedAt: studyMaterialFolders.deletedAt,
      })
      .from(studyMaterialFolders)
      .where(isNotNull(studyMaterialFolders.deletedAt));

    const deletedSmFolderIds = new Set(deletedSmFolders.map((f) => f.id));
    const rootDeletedSmFolders: TrashItemDto[] = deletedSmFolders
      .filter(
        (f) =>
          !deletedNotebookIds.has(f.notebookId) &&
          (!f.parentId || !deletedSmFolderIds.has(f.parentId)),
      )
      .map((f) => ({
        id: f.id,
        name: f.name,
        kind: 'study_material_folder' as const,
        subtypeLabel: 'Folder',
        notebookId: f.notebookId,
        notebookTitle: notebookTitleMap.get(f.notebookId),
        deletedAt: f.deletedAt!,
        daysRemaining: calculateDaysRemaining(f.deletedAt!),
      }));

    // 6. Fetch deleted study_materials
    // Root in trash if:
    // - parent notebook is NOT deleted
    // - AND (folderId is null OR parent study_material_folder is NOT deleted)
    const deletedStudyMaterials = await this.db
      .select({
        id: studyMaterials.id,
        title: studyMaterials.title,
        kind: studyMaterials.kind,
        notebookId: studyMaterials.notebookId,
        folderId: studyMaterials.folderId,
        deletedAt: studyMaterials.deletedAt,
      })
      .from(studyMaterials)
      .where(isNotNull(studyMaterials.deletedAt));

    const rootDeletedStudyMaterials: TrashItemDto[] = deletedStudyMaterials
      .filter(
        (sm) =>
          !deletedNotebookIds.has(sm.notebookId) &&
          (!sm.folderId || !deletedSmFolderIds.has(sm.folderId)),
      )
      .map((sm) => ({
        id: sm.id,
        name: sm.title,
        kind: 'study_material' as const,
        subtypeLabel: mapSubtypeLabel({
          kind: 'study_material',
          rawKind: sm.kind,
        }),
        notebookId: sm.notebookId,
        notebookTitle: notebookTitleMap.get(sm.notebookId),
        deletedAt: sm.deletedAt!,
        daysRemaining: calculateDaysRemaining(sm.deletedAt!),
      }));

    // Combine all top-level roots
    const allRoots: TrashItemDto[] = [
      ...rootDeletedNbFolders,
      ...rootDeletedNotebooks,
      ...rootDeletedSourceFolders,
      ...rootDeletedSources,
      ...rootDeletedSmFolders,
      ...rootDeletedStudyMaterials,
    ];

    // Sort descending by deletedAt, secondary tiebreaker id
    allRoots.sort((a, b) => {
      const diff = b.deletedAt.getTime() - a.deletedAt.getTime();
      if (diff !== 0) return diff;
      return a.id.localeCompare(b.id);
    });

    // Pagination using cursor format: `${timestamp}_${id}`
    let startIndex = 0;
    if (cursor) {
      const idx = allRoots.findIndex(
        (item) => `${item.deletedAt.getTime()}_${item.id}` === cursor,
      );
      if (idx !== -1) {
        startIndex = idx + 1;
      }
    }

    const pageItems = allRoots.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < allRoots.length;
    const lastItem = pageItems[pageItems.length - 1];
    const nextCursor =
      hasMore && lastItem
        ? `${lastItem.deletedAt.getTime()}_${lastItem.id}`
        : null;

    return {
      items: pageItems,
      nextCursor,
    };
  }
}
