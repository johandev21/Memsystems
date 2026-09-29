import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { inspect } from 'node:util';
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
  CapabilityUnsupportedError,
  EntitlementError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  RateLimitedError,
  ServiceUnavailableError,
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
import { Output, generateText } from 'ai';
import { AiService } from '../ai/ai.service';
import { classifyGatewayError } from '../ai/providers/gateway-errors';
import { resolveModelId } from '../ai/providers/model-catalog';
import {
  type ProblemEvaluationResult,
  ProblemEvaluationSchema,
  validatePracticeProblems,
} from './practice-problems-content';
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
  private readonly logger = new Logger(StudyMaterialService.name);

  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly notebooksService: NotebooksService,
    @Optional() private readonly slidesBuilder?: SlidesBuilderService,
    @Optional() private readonly aiService?: AiService,
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
    const [restored] = await this.db
      .update(studyMaterials)
      .set({ deletedAt: null, folderId: targetFolderId })
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
        throw new ForbiddenError('Folder does not belong to this notebook', {
          messageKey: 'errors.studyMaterials.folderNotInNotebook',
        });
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

  async evaluatePracticeProblem(
    smId: string,
    input: { problemId: string; studentAnswer: string; modelId: string },
  ): Promise<ProblemEvaluationResult> {
    this.logger.debug(
      `[EVAL-DEBUG] start smId=${smId} problemId=${input.problemId} modelId=${input.modelId} resolvedModel=${resolveModelId(input.modelId)} answerLength=${input.studentAnswer?.length ?? 0}`,
    );
    const sm = await this.fetchOwned(smId);
    if (sm.kind !== 'practice_problems') {
      throw new BadRequestError(
        'Study material is not a practice problems set',
        { messageKey: 'errors.studyMaterials.notPracticeProblems' },
      );
    }

    const validated = validatePracticeProblems(sm.content);
    const problem = validated.problems.find((p) => p.id === input.problemId);
    if (!problem) {
      throw new NotFoundError('Practice problem', {
        messageKey: 'errors.studyMaterials.practiceProblemNotFound',
      });
    }

    if (!this.aiService) {
      throw new BadRequestError('AI service is not configured', {
        messageKey: 'errors.studyMaterials.aiNotConfigured',
      });
    }

    const modelId = input.modelId;
    const provider = await this.aiService.getProviderForModel(modelId);
    this.aiService.requireStructuredOutput(
      provider,
      modelId,
      'errors.studyMaterials.evaluation.structuredOutputUnsupported',
    );
    this.logger.debug(
      `[EVAL-DEBUG] provider resolved modelId=${modelId} provider=${provider.id}`,
    );
    const model = provider.createModel(modelId);
    const requestOptions = this.aiService.getGatewayRequestOptions();

    const systemPrompt = `You are an expert tutor evaluating a student's answer to a practice problem.
Compare the student's attempt against the reference problem statement, givens, constraints, acceptable alternatives, reference answer, worked steps, and verification checklist.

Evaluate the attempt objectively and constructively:
- status: "correct" if the student solves the problem accurately and respects key constraints.
- status: "partially_correct" if the student understands the core methodology but made minor arithmetic, sign, edge-case, or incomplete step errors.
- status: "needs_improvement" if the attempt has fundamental misconceptions, wrong formulas, violated constraints, or missed the main question.
- feedback: 1-3 concise sentences giving encouraging, pedagogical guidance.
- strengths: list 1-3 specific things the student did right or understood well.
- missingPoints: list 1-3 specific gaps, misconceptions, missing constraints, or incorrect steps. If the student answer was fully correct, this can be empty.`;

    const userPrompt = `Problem Prompt:
${problem.prompt}

${problem.givens.length > 0 ? `Givens:\n${problem.givens.map((g) => `- ${g}`).join('\n')}\n` : ''}
${problem.constraints.length > 0 ? `Constraints:\n${problem.constraints.map((c) => `- ${c}`).join('\n')}\n` : ''}
${problem.checklist.length > 0 ? `Checklist:\n${problem.checklist.map((c) => `- ${c}`).join('\n')}\n` : ''}
${problem.acceptableAlternatives.length > 0 ? `Acceptable Alternatives:\n${problem.acceptableAlternatives.map((a) => `- ${a}`).join('\n')}\n` : ''}

Reference Answer:
${problem.answer}

Worked Steps:
${problem.steps.map((s, i) => `${i + 1}. ${s.title}: ${s.explanation}`).join('\n\n')}

Student's Attempt:
"""
${input.studentAnswer.trim()}
"""

Evaluate this student attempt now.`;

    let result: Awaited<ReturnType<typeof generateText>>;
    try {
      this.logger.debug(
        `[EVAL-DEBUG] generateText start modelId=${modelId} promptLength=${userPrompt.length}`,
      );
      result = await generateText({
        model,
        output: Output.object({ schema: ProblemEvaluationSchema }),
        instructions: systemPrompt,
        prompt: userPrompt,
        ...requestOptions,
      });
      this.logger.debug(
        `[EVAL-DEBUG] generateText ok modelId=${modelId} outputPreview=${JSON.stringify(result.output)?.slice(0, 300)}`,
      );
    } catch (err) {
      this.logger.error(
        `[EVAL-DEBUG] generateText failed modelId=${modelId} kind=${classifyGatewayError(err).kind} ${describeGatewayError(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw toEvaluationDomainError(err, modelId, provider);
    }

    const parsed = ProblemEvaluationSchema.safeParse(result.output);
    if (parsed.success) {
      return parsed.data;
    }
    this.logger.error(
      `[EVAL-DEBUG] output parse failed modelId=${modelId} rawPreview=${JSON.stringify(result.output)?.slice(0, 500)}`,
    );
    throw new InternalError('Invalid output format from model', {
      messageKey: 'errors.studyMaterials.invalidModelOutput',
    });
  }
}

function describeGatewayError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current; depth++) {
    const name = current instanceof Error ? current.name : typeof current;
    const message =
      current instanceof Error
        ? current.message
        : inspect(current, { depth: 2, breakLength: Infinity });
    const status =
      current && typeof current === 'object'
        ? ((current as { statusCode?: unknown }).statusCode ??
          (current as { status?: unknown }).status)
        : undefined;
    const retryable =
      current && typeof current === 'object' && 'isRetryable' in current
        ? (current as { isRetryable?: unknown }).isRetryable
        : undefined;
    parts.push(
      `[depth${depth} name=${name} status=${String(status)} retryable=${String(retryable)} msg=${message.slice(0, 300)}]`,
    );
    if (current && typeof current === 'object' && 'lastError' in current) {
      current = (current as { lastError?: unknown }).lastError;
      continue;
    }
    if (current instanceof Error && 'cause' in current && current.cause) {
      current = current.cause;
      continue;
    }
    break;
  }
  return parts.join(' ');
}

function toEvaluationDomainError(
  error: unknown,
  modelId: string,
  provider: { listModels?: () => { id: string; displayName: string }[] },
): Error {
  const classified = classifyGatewayError(error);
  const modelName =
    provider
      .listModels?.()
      .find((candidate) => candidate.id === resolveModelId(modelId))
      ?.displayName ?? modelId;
  if (classified.kind === 'entitlement') {
    return new EntitlementError(
      `${modelName} is not available on your plan. Try another model or add credits.`,
      {
        cause: error instanceof Error ? error : undefined,
        messageKey: 'errors.studyMaterials.evaluation.entitlement',
        params: { modelName },
      },
    );
  }
  if (classified.kind === 'rate_limited') {
    return new RateLimitedError(
      'The AI service is busy right now. Please retry in a moment.',
      {
        cause: error instanceof Error ? error : undefined,
        messageKey: 'errors.studyMaterials.evaluation.rateLimited',
      },
    );
  }
  if (classified.kind === 'transient') {
    return new ServiceUnavailableError(
      'The AI service is temporarily unavailable. Please try again shortly.',
      {
        cause: error instanceof Error ? error : undefined,
        messageKey: 'errors.studyMaterials.evaluation.transient',
      },
    );
  }
  if (classified.kind === 'capability') {
    return new CapabilityUnsupportedError(
      `${modelName} doesn't support answer evaluation. Switch to another model and try again.`,
      {
        cause: error instanceof Error ? error : undefined,
        messageKey: 'errors.studyMaterials.evaluation.capability',
        params: { modelName },
      },
    );
  }
  return error instanceof Error ? error : new Error(String(error));
}
