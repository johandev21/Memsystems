import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import {
  studyMaterialAudio,
  studyMaterialFolders,
  studyMaterials,
} from '../../database/schema';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../common/errors/domain-error';
import { DRIZZLE } from '../database/database.module';
import { NotebooksService } from '../notebooks/notebooks.service';
import {
  QuizContentType,
  shuffleQuizOptions,
  StudyMaterialKind,
  validateContent,
} from './content/shapes';
import { normalizeContent } from './content/content-normalizer';
import { buildSlidePreviews, withSlidePreviews } from './slides/slides-preview';
import { resolveSlideDeck } from './slides/slides-design-resolver';
import { SlidesBuilderService } from './slides/slides-builder.service';

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

const MAX_AUDIO_BYTES = 64 * 1024 * 1024;

@Injectable()
export class StudyMaterialService {
  private readonly logger = new Logger(StudyMaterialService.name);

  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly notebooksService: NotebooksService,
    @Optional() private readonly slidesBuilder?: SlidesBuilderService,
  ) {}

  async list(
    notebookId: string,
    filters?: { folderId?: string; kind?: StudyMaterialKind },
  ) {
    await this.notebooksService.assertNotebookOwner(notebookId);
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

  async get(smId: string) {
    return this.fetchOwned(smId);
  }

  async create(notebookId: string, input: CreateStudyMaterialInput) {
    await this.notebooksService.assertNotebookOwner(notebookId);
    if (input.kind === 'audio_overview') {
      throw new BadRequestError('Audio Overview requires its WAV asset', {
        messageKey: 'errors.studyMaterials.contentMismatch',
        params: { kind: input.kind },
      });
    }
    const validatedContent = validateContent(input.kind, input.content);
    const storable =
      input.kind === 'slides'
        ? withSlidePreviews(validatedContent as Record<string, unknown>)
        : validatedContent;
    if (input.folderId) {
      await this.assertFolderOwned(notebookId, input.folderId);
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

  async createAudioOverview(
    notebookId: string,
    input: Omit<CreateStudyMaterialInput, 'kind'>,
    audio: Buffer,
  ) {
    await this.notebooksService.assertNotebookOwner(notebookId);
    const content = validateContent('audio_overview', input.content);
    this.assertWav(audio);
    if (input.folderId)
      await this.assertFolderOwned(notebookId, input.folderId);
    return this.db.transaction(async (tx) => {
      const [material] = await tx
        .insert(studyMaterials)
        .values({
          notebookId,
          kind: 'audio_overview',
          title: input.title.trim().slice(0, 200),
          content,
          folderId: input.folderId ?? null,
        })
        .returning();
      await tx.insert(studyMaterialAudio).values({
        studyMaterialId: material.id,
        audio,
        contentType: 'audio/wav',
      });
      return material;
    });
  }

  async getAudio(smId: string) {
    const material = await this.fetchOwned(smId);
    if (material.deletedAt || material.kind !== 'audio_overview') {
      throw new NotFoundError('Study material audio', {
        messageKey: 'errors.studyMaterials.studyMaterialNotFound',
      });
    }
    const [audio] = await this.db
      .select({
        audio: studyMaterialAudio.audio,
        contentType: studyMaterialAudio.contentType,
      })
      .from(studyMaterialAudio)
      .where(eq(studyMaterialAudio.studyMaterialId, smId));
    if (!audio) {
      throw new NotFoundError('Study material audio', {
        messageKey: 'errors.studyMaterials.studyMaterialNotFound',
      });
    }
    return audio;
  }

  async update(smId: string, input: UpdateStudyMaterialInput) {
    const sm = await this.fetchOwned(smId);
    const updates: Partial<typeof studyMaterials.$inferInsert> = {};
    if (input.title !== undefined) {
      const trimmed = input.title.trim();
      if (trimmed.length === 0) {
        throw new BadRequestError('Title cannot be empty', {
          messageKey: 'errors.studyMaterials.titleEmpty',
        });
      }
      updates.title = trimmed.slice(0, 200);
    }
    if (input.content !== undefined) {
      const validated = validateContent(sm.kind, input.content);
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

  async delete(smId: string) {
    const sm = await this.fetchOwned(smId);
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

  async restore(smId: string) {
    const sm = await this.fetchOwned(smId);
    if (!sm.deletedAt) {
      return sm;
    }
    let targetFolderId = sm.folderId;
    if (targetFolderId) {
      targetFolderId = await this.findAliveAncestor(targetFolderId);
    }
    const now = new Date();
    const [restored] = await this.db
      .update(studyMaterials)
      .set({ deletedAt: null, folderId: targetFolderId, updatedAt: now })
      .where(eq(studyMaterials.id, smId))
      .returning();
    return restored;
  }

  async permanentDelete(smId: string) {
    await this.fetchOwned(smId);
    await this.db.delete(studyMaterials).where(eq(studyMaterials.id, smId));
  }

  async shuffle(smId: string) {
    const sm = await this.fetchOwned(smId);
    if (sm.kind !== 'quiz') {
      throw new BadRequestError('Only quizzes can be shuffled', {
        messageKey: 'errors.studyMaterials.onlyQuizzesShuffled',
      });
    }
    const shuffledContent = shuffleQuizOptions(sm.content as QuizContentType);
    const [updated] = await this.db
      .update(studyMaterials)
      .set({ content: shuffledContent })
      .where(eq(studyMaterials.id, smId))
      .returning();
    return updated;
  }

  async move(smId: string, input: MoveStudyMaterialInput) {
    const sm = await this.fetchOwned(smId);
    if (input.folderId) {
      await this.assertFolderOwned(sm.notebookId, input.folderId);
    }
    const [moved] = await this.db
      .update(studyMaterials)
      .set({ folderId: input.folderId })
      .where(eq(studyMaterials.id, smId))
      .returning();
    return moved;
  }

  async buildSlidesPptx(
    smId: string,
  ): Promise<{ title: string; buffer: Buffer }> {
    const sm = await this.fetchOwned(smId);
    if (sm.kind !== 'slides') {
      throw new BadRequestError('Only slides can be exported as PowerPoint', {
        messageKey: 'errors.studyMaterials.exportOnlySlides',
      });
    }
    if (sm.deletedAt) {
      throw new BadRequestError('Cannot export a deleted study material', {
        messageKey: 'errors.studyMaterials.exportDeleted',
      });
    }
    const validated = validateContent('slides', sm.content) as Record<
      string,
      unknown
    >;
    const { previews, ...deck } = validated;
    void previews;
    if (!this.slidesBuilder) {
      throw new BadRequestError('Slides export is unavailable', {
        messageKey: 'errors.studyMaterials.exportUnavailable',
      });
    }
    const buffer = await this.slidesBuilder.buildPptxBuffer(deck);
    return { title: sm.title, buffer };
  }

  async duplicate(smId: string) {
    const source = await this.fetchOwned(smId);
    if (source.deletedAt) {
      throw new BadRequestError('Cannot duplicate a deleted study material', {
        messageKey: 'errors.studyMaterials.duplicateDeleted',
      });
    }

    const validatedContent = validateContent(source.kind, source.content);
    const storable =
      source.kind === 'slides'
        ? withSlidePreviews(validatedContent as Record<string, unknown>)
        : validatedContent;

    const suffix = ' copy';
    const trimmedTitle = source.title.trim();
    const maxBaseLength = 200 - suffix.length;
    const base = trimmedTitle.slice(0, maxBaseLength);
    const newTitle = `${base}${suffix}`;

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
        throw new ForbiddenError('Folder does not belong to this notebook', {
          messageKey: 'errors.studyMaterials.folderNotInNotebook',
        });
      } else if (folder.deletedAt) {
        targetFolderId = null;
      }
    }

    const copy = await this.db.transaction(async (tx) => {
      const [created] = await tx
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
      if (source.kind === 'audio_overview') {
        const [audio] = await tx
          .select()
          .from(studyMaterialAudio)
          .where(eq(studyMaterialAudio.studyMaterialId, source.id));
        if (!audio) {
          throw new NotFoundError('Study material audio', {
            messageKey: 'errors.studyMaterials.studyMaterialNotFound',
          });
        }
        await tx.insert(studyMaterialAudio).values({
          studyMaterialId: created.id,
          audio: audio.audio,
          contentType: audio.contentType,
        });
      }
      return created;
    });

    return this.refreshDerivedContent(
      copy.kind === 'quiz'
        ? { ...copy, content: normalizeContent('quiz', copy.content) }
        : copy,
    );
  }

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

  private async assertFolderOwned(notebookId: string, folderId: string) {
    const [folder] = await this.db
      .select({
        id: studyMaterialFolders.id,
        notebookId: studyMaterialFolders.notebookId,
        deletedAt: studyMaterialFolders.deletedAt,
      })
      .from(studyMaterialFolders)
      .where(eq(studyMaterialFolders.id, folderId));
    if (!folder) {
      throw new NotFoundError('Folder', {
        messageKey: 'errors.studyMaterials.folderNotFound',
      });
    }
    if (folder.notebookId !== notebookId) {
      throw new ForbiddenError('Folder does not belong to this notebook', {
        messageKey: 'errors.studyMaterials.folderNotInNotebook',
      });
    }
    if (folder.deletedAt) {
      throw new BadRequestError('Cannot move to a folder in Trash', {
        messageKey: 'errors.studyMaterials.folderInTrash',
      });
    }
  }

  private async fetchOwned(smId: string) {
    const [sm] = await this.db
      .select()
      .from(studyMaterials)
      .where(eq(studyMaterials.id, smId));
    if (!sm) {
      throw new NotFoundError('Study material', {
        messageKey: 'errors.studyMaterials.studyMaterialNotFound',
      });
    }
    await this.notebooksService.assertNotebookOwner(sm.notebookId);
    return this.refreshDerivedContent(sm);
  }

  private assertWav(audio: Buffer) {
    if (
      !Buffer.isBuffer(audio) ||
      audio.length < 12 ||
      audio.length > MAX_AUDIO_BYTES ||
      audio.toString('ascii', 0, 4) !== 'RIFF' ||
      audio.toString('ascii', 8, 12) !== 'WAVE'
    ) {
      throw new BadRequestError('Audio must be a valid bounded WAV file', {
        messageKey: 'errors.studyMaterials.contentMismatch',
        params: { kind: 'audio_overview' },
      });
    }
  }
}
