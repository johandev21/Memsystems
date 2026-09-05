import { Inject, Injectable, Optional } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import {
  sources,
  studyMaterialFolders,
  studyMaterials,
} from '../../database/schema';
import {
  validateStudyGuide,
  validateStudyGuideSources,
} from './study-guide-content';
import {
  validateCaseStudy,
  validateCaseStudySources,
} from './case-study-content';
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
import { buildSlidePreviews, withSlidePreviews } from './slides-preview';
import { resolveSlideDeck } from './slides-design-resolver';
import { SlidesBuilderService } from './slides-builder.service';

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
    @Optional() private readonly slidesBuilder?: SlidesBuilderService,
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
      this.refreshDerivedContent(
        material.kind === 'quiz'
          ? { ...material, content: normalizeContent('quiz', material.content) }
          : material,
      ),
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
    const validatedContent =
      input.kind === 'study_guide'
        ? await this.validateGuideSources(notebookId, input.content)
        : input.kind === 'case_study'
          ? await this.validateCaseSources(notebookId, input.content)
          : validateContent(input.kind, input.content);
    const storable =
      input.kind === 'slides'
        ? withSlidePreviews(validatedContent as Record<string, unknown>)
        : validatedContent;
    if (input.folderId) {
      await this.assertFolderOwned(userId, notebookId, input.folderId);
    }
    const [sm] = await this.db
      .insert(studyMaterials)
      .values({
        notebookId,
        kind: input.kind,
        title: input.title.trim().slice(0, 200),
        content: storable,
        folderId: input.folderId ?? null,
      })
      .returning();
    return this.refreshDerivedContent(
      sm.kind === 'quiz'
        ? { ...sm, content: normalizeContent('quiz', sm.content) }
        : sm,
    );
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
      const validated =
        sm.kind === 'study_guide'
          ? await this.validateGuideSources(
              sm.notebookId,
              input.content,
              validateStudyGuide(sm.content).sourceIds,
            )
          : sm.kind === 'case_study'
            ? await this.validateCaseSources(
                sm.notebookId,
                input.content,
                validateCaseStudy(sm.content).sourceIds,
              )
            : validateContent(sm.kind, input.content);
      updates.content =
        sm.kind === 'slides'
          ? withSlidePreviews(validated as Record<string, unknown>)
          : validated;
    }
    if (Object.keys(updates).length === 0) {
      return sm;
    }
    const [updated] = await this.db
      .update(studyMaterials)
      .set(updates)
      .where(eq(studyMaterials.id, smId))
      .returning();
    return this.refreshDerivedContent(updated);
  }

  private async validateCaseSources(
    notebookId: string,
    content: unknown,
    selectedSourceIds?: string[],
  ) {
    const study = validateCaseStudy(content);
    const requestedIds = selectedSourceIds ?? [
      ...new Set([
        ...study.sourceIds,
        ...study.analyses.flatMap((analysis) => [
          ...analysis.sourceIds,
          ...analysis.conceptApplications.flatMap((app) => app.sourceIds),
          ...analysis.alternativePerspectives.flatMap((alt) => alt.sourceIds),
        ]),
      ]),
    ];
    if (!requestedIds.length) return validateCaseStudySources(study, []);
    const available = await this.db
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.notebookId, notebookId));
    const allowed = available
      .filter((source) => requestedIds.includes(source.id))
      .map((source) => source.id);
    return validateCaseStudySources(study, allowed);
  }

  private async validateGuideSources(
    notebookId: string,
    content: unknown,
    selectedSourceIds?: string[],
  ) {
    const guide = validateStudyGuide(content);
    const requestedIds = selectedSourceIds ?? [
      ...new Set([
        ...guide.sourceIds,
        ...guide.sections.flatMap((section) => section.sourceIds),
      ]),
    ];
    if (!requestedIds.length) return validateStudyGuideSources(guide, []);
    const available = await this.db
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.notebookId, notebookId));
    const allowed = available
      .filter((source) => requestedIds.includes(source.id))
      .map((source) => source.id);
    return validateStudyGuideSources(guide, allowed);
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

  async buildSlidesPptx(
    userId: string,
    smId: string,
  ): Promise<{ title: string; buffer: Buffer }> {
    const sm = await this.fetchOwned(userId, smId);
    if (sm.kind !== 'slides') {
      throw new BadRequestError('Only slides can be exported as PowerPoint');
    }
    if (sm.deletedAt) {
      throw new BadRequestError('Cannot export a deleted study material');
    }
    // Validate to guarantee the builder receives a well-formed deck.
    // Previews are derived presentation images and are stripped before
    // building so the .pptx contains only native editable elements.
    const validated = validateContent('slides', sm.content) as Record<
      string,
      unknown
    >;
    const { previews, ...deck } = validated;
    void previews;
    if (!this.slidesBuilder) {
      throw new BadRequestError('Slides export is unavailable');
    }
    const buffer = await this.slidesBuilder.buildPptxBuffer(deck);
    return { title: sm.title, buffer };
  }

  async duplicate(userId: string, smId: string) {
    const source = await this.fetchOwned(userId, smId);
    if (source.deletedAt) {
      throw new BadRequestError('Cannot duplicate a deleted study material');
    }

    // Validate content before copying; ensures kind/content invariant
    const validatedContent = validateContent(source.kind, source.content);
    const storable =
      source.kind === 'slides'
        ? withSlidePreviews(validatedContent as Record<string, unknown>)
        : validatedContent;

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
        content: storable,
        folderId: targetFolderId,
        options: source.options ?? null,
      })
      .returning();

    return this.refreshDerivedContent(
      copy.kind === 'quiz'
        ? { ...copy, content: normalizeContent('quiz', copy.content) }
        : copy,
    );
  }

  /**
   * Previews are derived presentation images, not source of truth. Regenerate
   * them on read so decks persisted before a renderer fix (or with missing
   * previews) self-heal without a data migration. Legacy prose decks are
   * resolved into scenes in-memory so old rows render through the new scene
   * model; they are persisted as v2 on the next update. The .pptx export
   * path strips previews, so this never affects the editable deck.
   */
  private refreshDerivedContent<T extends { kind: string; content: unknown }>(
    row: T,
  ): T {
    if (row.kind !== 'slides') return row;
    const record =
      row.content && typeof row.content === 'object'
        ? (row.content as Record<string, unknown>)
        : {};
    const { previews, ...deck } = record;
    void previews;
    const resolved = resolveSlideDeck(deck);
    return {
      ...row,
      content: { ...resolved, previews: buildSlidePreviews(resolved) },
    };
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
    return this.refreshDerivedContent(sm);
  }
}
