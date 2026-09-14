import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { sources } from '../../database/schema';
import { NotFoundError } from '../../common/errors/domain-error';
import { BadRequestError } from '../../common/errors/domain-error';
import { ConnectionService } from '../ai/connection.service';
import { DRIZZLE } from '../database/database.module';
import { NotebooksService } from '../notebooks/notebooks.service';
import {
  GenerationRequestManager,
  StartGenerationInput,
} from './generation-request-manager';
import { StudyMaterialKind } from './shapes';
import { StreamHandler } from './stream-handler';

const MODELS_BY_KIND: Record<StudyMaterialKind, string> = {
  quiz: 'openai/gpt-5.6-sol',
  simple_flashcard: 'openai/gpt-5.6-sol',
  roadmap: 'openai/gpt-5.6-sol',
  mind_map: 'openai/gpt-5.6-sol',
  slides: 'openai/gpt-5.6-sol',
  study_guide: 'openai/gpt-5.6-sol',
  practice_problems: 'openai/gpt-5.6-sol',
  case_study: 'openai/gpt-5.6-sol',
};

@Injectable()
export class GenerationService {
  private readonly activeRequests = new Map<string, AbortController>();

  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly notebooksService: NotebooksService,
    private readonly connectionService: ConnectionService,
    private readonly requestManager: GenerationRequestManager,
    private readonly streamHandler: StreamHandler,
  ) {}

  async generate(
    notebookId: string,
    input: StartGenerationInput,
    externalSignal?: AbortSignal,
  ) {
    await this.notebooksService.assertNotebookOwner(notebookId);

    const modelId = input.model ?? MODELS_BY_KIND[input.kind];
    await this.connectionService.requireConnected(modelId);

    const sourceTexts =
      input.sourceIds.length > 0
        ? await this.fetchSourceTexts(notebookId, input.sourceIds)
        : [];

    if (input.kind === 'study_guide') {
      if (
        sourceTexts.length !== new Set(input.sourceIds).size ||
        sourceTexts.some((source) => !source.rawText.trim())
      ) {
        throw new BadRequestError(
          'Selected sources are unavailable or have no readable content. Update your selection and retry.',
          { messageKey: 'errors.generation.sourcesUnavailable' },
        );
      }
      if (!sourceTexts.length && !input.brief.trim()) {
        throw new BadRequestError(
          'Select a source or enter a brief for your study guide.',
          { messageKey: 'errors.generation.sourceOrBrief.studyGuide' },
        );
      }
    }

    if (input.kind === 'practice_problems') {
      const problemCount =
        input.practiceProblemsOptions?.problemCount ?? input.questionCount;
      if (problemCount != null && (problemCount < 1 || problemCount > 30)) {
        throw new BadRequestError(
          'Problem count must be between {{min}} and {{max}}.',
          {
            messageKey: 'errors.generation.problemCount',
            params: { min: 1, max: 30 },
          },
        );
      }
      if (!sourceTexts.length && !input.brief.trim()) {
        throw new BadRequestError(
          'Select a source or enter a brief for your practice problems.',
          { messageKey: 'errors.generation.sourceOrBrief.practiceProblems' },
        );
      }
    }

    if (input.kind === 'case_study') {
      const questionCount =
        input.caseStudyOptions?.questionCount ?? input.questionCount;
      if (questionCount != null && (questionCount < 1 || questionCount > 10)) {
        throw new BadRequestError(
          'Question count must be between {{min}} and {{max}}.',
          {
            messageKey: 'errors.generation.questionCount',
            params: { min: 1, max: 10 },
          },
        );
      }
      if (!sourceTexts.length && !input.brief.trim()) {
        throw new BadRequestError(
          'Select a source or enter a brief for your case study.',
          { messageKey: 'errors.generation.sourceOrBrief.caseStudy' },
        );
      }
    }

    const requestId = await this.requestManager.create(notebookId, {
      ...input,
      model: modelId,
    });

    const controller = new AbortController();
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else
        externalSignal.addEventListener('abort', () => controller.abort(), {
          once: true,
        });
    }
    this.activeRequests.set(requestId, controller);

    const { stream } = this.streamHandler.createStream(
      notebookId,
      {
        ...input,
        model: modelId,
      },
      sourceTexts,
      requestId,
      () => {
        this.activeRequests.delete(requestId);
        void this.requestManager.markCompleted(requestId);
      },
      () => {
        this.activeRequests.delete(requestId);
        void this.requestManager.markFailed(requestId);
      },
      controller.signal,
    );

    return { stream, requestId };
  }

  async cancel(requestId: string) {
    const request = await this.requestManager.get(requestId);
    if (!request) {
      throw new NotFoundError('Generation request', {
        messageKey: 'errors.generation.requestNotFound',
      });
    }
    await this.notebooksService.assertNotebookOwner(request.notebookId);
    await this.requestManager.cancel(requestId);
    this.activeRequests.get(requestId)?.abort();
    return request;
  }

  private async fetchSourceTexts(notebookId: string, sourceIds: string[]) {
    const rows = await this.db
      .select({
        id: sources.id,
        title: sources.title,
        rawText: sources.rawText,
        notebookId: sources.notebookId,
      })
      .from(sources)
      .where(eq(sources.notebookId, notebookId));

    if (sourceIds.length === 0) {
      return [];
    }

    const sourceIdsSet = new Set(sourceIds);
    const owned = rows.filter(
      (r) => sourceIdsSet.has(r.id) && r.notebookId === notebookId,
    );

    return owned;
  }
}
