import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { studyMaterialFolders, studyMaterials } from '../../database/schema';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../common/errors/domain-error';
import { DRIZZLE } from '../database/database.module';
import { NotebooksService } from '../notebooks/notebooks.service';
import { z } from 'zod';
import {
  QuizContent,
  shuffleQuizOptions,
  StudyMaterialKind,
  validateContent,
} from './shapes';
import { normalizeContent } from './content-normalizer';

export interface CreateStudyMaterialInput {
  kind: StudyMaterialKind;
  title: string;
  content: unknown;
  folderId?: string;
}

export interface UpdateStudyMaterialInput {
  title?: string;
  content?: unknown;
}

export interface MoveStudyMaterialInput {
  folderId: string | null;
}

@Injectable()
export class StudyMaterialService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly notebooksService: NotebooksService,
  ) {}

  async list(
    userId: string,
    notebookId: string,
    filters?: { folderId?: string; kind?: StudyMaterialKind },
  ) {
    await this.notebooksService.assertNotebookOwner(userId, notebookId);
    const conditions = [
      eq(studyMaterials.notebookId, notebookId),
      isNull(studyMaterials.deletedAt),
    ];
    if (filters?.folderId !== undefined) {
      conditions.push(eq(studyMaterials.folderId, filters.folderId));
    }
    if (filters?.kind) {
      conditions.push(eq(studyMaterials.kind, filters.kind));
    }
    const materials = await this.db
      .select()
      .from(studyMaterials)
      .where(and(...conditions))
      .orderBy(desc(studyMaterials.createdAt));
    return materials.map((material) =>
      material.kind === 'quiz'
        ? { ...material, content: normalizeContent('quiz', material.content) }
        : material,
    );
  }

  async get(userId: string, smId: string) {
    return this.fetchOwned(userId, smId);
  }

  async create(
    userId: string,
    notebookId: string,
    input: CreateStudyMaterialInput,
  ) {
    await this.notebooksService.assertNotebookOwner(userId, notebookId);
    const validatedContent = validateContent(input.kind, input.content);
    if (input.folderId) {
      await this.assertFolderOwned(userId, notebookId, input.folderId);
    }
    const [sm] = await this.db
      .insert(studyMaterials)
      .values({
        notebookId,
        kind: input.kind,
        title: input.title.trim().slice(0, 200),
        content: validatedContent,
        folderId: input.folderId ?? null,
      })
      .returning();
    return sm.kind === 'quiz'
      ? { ...sm, content: normalizeContent('quiz', sm.content) }
      : sm;
  }

  async update(userId: string, smId: string, input: UpdateStudyMaterialInput) {
    const sm = await this.fetchOwned(userId, smId);
    const updates: Partial<typeof studyMaterials.$inferInsert> = {};
    if (input.title !== undefined) {
      const trimmed = input.title.trim();
      if (trimmed.length === 0) {
        throw new BadRequestError('Title cannot be empty');
      }
      updates.title = trimmed.slice(0, 200);
    }
    if (input.content !== undefined) {
      updates.content = validateContent(sm.kind, input.content);
    }
    if (Object.keys(updates).length === 0) {
      return sm;
    }
    const [updated] = await this.db
      .update(studyMaterials)
      .set(updates)
      .where(eq(studyMaterials.id, smId))
      .returning();
    return updated;
  }

  async delete(userId: string, smId: string) {
    const sm = await this.fetchOwned(userId, smId);
    if (sm.deletedAt) {
      return sm;
    }
    const [deleted] = await this.db
      .update(studyMaterials)
      .set({ deletedAt: new Date() })
      .where(eq(studyMaterials.id, smId))
      .returning();
    return deleted;
  }

  async restore(userId: string, smId: string) {
    const sm = await this.fetchOwned(userId, smId);
    if (!sm.deletedAt) {
      return sm;
    }
    let targetFolderId = sm.folderId;
    if (targetFolderId) {
      targetFolderId = await this.findAliveAncestor(targetFolderId);
    }
    const [restored] = await this.db
      .update(studyMaterials)
      .set({ deletedAt: null, folderId: targetFolderId })
      .where(eq(studyMaterials.id, smId))
      .returning();
    return restored;
  }

  async permanentDelete(userId: string, smId: string) {
    await this.fetchOwned(userId, smId);
    await this.db.delete(studyMaterials).where(eq(studyMaterials.id, smId));
  }

  async shuffle(userId: string, smId: string) {
    const sm = await this.fetchOwned(userId, smId);
    if (sm.kind !== 'quiz') {
      throw new BadRequestError('Only quizzes can be shuffled');
    }
    const shuffledContent = shuffleQuizOptions(
      sm.content as z.infer<typeof QuizContent>,
    );
    const [updated] = await this.db
      .update(studyMaterials)
      .set({ content: shuffledContent })
      .where(eq(studyMaterials.id, smId))
      .returning();
    return updated;
  }

  async move(userId: string, smId: string, input: MoveStudyMaterialInput) {
    const sm = await this.fetchOwned(userId, smId);
    if (input.folderId) {
      await this.assertFolderOwned(userId, sm.notebookId, input.folderId);
    }
    const [moved] = await this.db
      .update(studyMaterials)
      .set({ folderId: input.folderId })
      .where(eq(studyMaterials.id, smId))
      .returning();
    return moved;
  }

  async duplicate(userId: string, smId: string) {
    const source = await this.fetchOwned(userId, smId);
    if (source.deletedAt) {
      throw new BadRequestError('Cannot duplicate a deleted study material');
    }

    // Validate content before copying; ensures kind/content invariant
    const validatedContent = validateContent(source.kind, source.content);

    // Title derivation: append " copy" while preserving 200 char limit
    const suffix = ' copy';
    const trimmedTitle = source.title.trim();
    const maxBaseLength = 200 - suffix.length;
    const base = trimmedTitle.slice(0, maxBaseLength);
    const newTitle = `${base}${suffix}`;

    // Folder handling: preserve active same-notebook folder, else place at root; reject impossible cross-notebook
    let targetFolderId: string | null = source.folderId;
    if (targetFolderId) {
      const [folder] = await this.db
        .select({
          id: studyMaterialFolders.id,
          notebookId: studyMaterialFolders.notebookId,
          deletedAt: studyMaterialFolders.deletedAt,
        })
        .from(studyMaterialFolders)
        .where(eq(studyMaterialFolders.id, targetFolderId));
      if (!folder) {
        targetFolderId = null;
      } else if (folder.notebookId !== source.notebookId) {
        throw new ForbiddenError('Folder does not belong to this notebook');
      } else if (folder.deletedAt) {
        targetFolderId = null;
      }
    }

    const [copy] = await this.db
      .insert(studyMaterials)
      .values({
        notebookId: source.notebookId,
        kind: source.kind,
        title: newTitle,
        content: validatedContent,
        folderId: targetFolderId,
        options: source.options ?? null,
      })
      .returning();

    return copy.kind === 'quiz'
      ? { ...copy, content: normalizeContent('quiz', copy.content) }
      : copy;
  }

  private async findAliveAncestor(folderId: string): Promise<string | null> {
    let currentId: string | null = folderId;
    while (currentId) {
      const [folder] = await this.db
        .select()
        .from(studyMaterialFolders)
        .where(eq(studyMaterialFolders.id, currentId));
      if (!folder) return null;
      if (!folder.deletedAt) return folder.id;
      currentId = folder.parentId;
    }
    return null;
  }

  private async assertFolderOwned(
    _userId: string,
    notebookId: string,
    folderId: string,
  ) {
    const [folder] = await this.db
      .select({
        id: studyMaterialFolders.id,
        notebookId: studyMaterialFolders.notebookId,
        deletedAt: studyMaterialFolders.deletedAt,
      })
      .from(studyMaterialFolders)
      .where(eq(studyMaterialFolders.id, folderId));
    if (!folder) {
      throw new NotFoundError('Folder');
    }
    if (folder.notebookId !== notebookId) {
      throw new ForbiddenError('Folder does not belong to this notebook');
    }
    if (folder.deletedAt) {
      throw new BadRequestError('Cannot move to a folder in Trash');
    }
  }

  private async fetchOwned(userId: string, smId: string) {
    const [sm] = await this.db
      .select()
      .from(studyMaterials)
      .where(eq(studyMaterials.id, smId));
    if (!sm) {
      throw new NotFoundError('Study material');
    }
    await this.notebooksService.assertNotebookOwner(userId, sm.notebookId);
    return sm;
  }
}
