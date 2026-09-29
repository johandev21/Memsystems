import { Injectable, Logger } from '@nestjs/common';
import {
  BadRequestError,
  NotFoundError,
} from '../../common/errors/domain-error';
import { ConnectionService } from '../ai/connection.service';
import { RetrievalTraceService } from '../ai/retrieval-trace.service';
import { NotebooksService } from '../notebooks/notebooks.service';
import {
  DEFAULT_GROUNDING_MODE,
  resolveGroundingMode,
} from '../notebooks/grounding-mode';
import {
  GenerationRequestManager,
  StartGenerationInput,
} from './generation-request-manager';
import { GenerationGroundingService } from './generation-grounding';
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
  private readonly logger = new Logger(GenerationService.name);
  private readonly activeRequests = new Map<string, AbortController>();

  constructor(
    private readonly notebooksService: NotebooksService,
    private readonly connectionService: ConnectionService,
    private readonly requestManager: GenerationRequestManager,
    private readonly streamHandler: StreamHandler,
    private readonly groundingService: GenerationGroundingService,
    private readonly retrievalTraceService: RetrievalTraceService,
  ) {}

  async generate(
    notebookId: string,
    input: StartGenerationInput,
    externalSignal?: AbortSignal,
  ) {
    await this.notebooksService.assertNotebookOwner(notebookId);
    const notebookGroundingMode =
      typeof this.notebooksService.getGroundingMode === 'function'
        ? await this.notebooksService.getGroundingMode(notebookId)
        : DEFAULT_GROUNDING_MODE;
    const groundingMode = resolveGroundingMode(
      input.groundingMode,
      notebookGroundingMode,
    );

    const modelId = input.model ?? MODELS_BY_KIND[input.kind];
    await this.connectionService.requireConnected(modelId);

    // Grounding retrieves the material per section of every selected source,
    // so a long source is represented beyond a single bounded set and a
    // multi-source Generation keeps its selection order.
    const grounding = await this.groundingService.ground({
      notebookId,
      kind: input.kind,
      brief: input.brief,
      sourceIds: input.sourceIds,
    });

    // Every retrieval pass the Generation ran persists its own trace, all
    // correlated by the generation request when one exists. Traces are
    // recorded before any rejection, so the passes that ran are diagnosable
    // even when the Generation never starts streaming.
    const recordTraces = async (generationRequestId?: string) => {
      for (const trace of grounding.traces) {
        await this.retrievalTraceService.record({
          notebookId,
          kind: 'generation',
          generationRequestId,
          groundingMode,
          trace,
        });
      }
    };

    // A selected source with no Evidence is unavailable, whatever the reason
    // (deleted, failed, degraded, or not indexed yet). Every kind reports it
    // with the same error the study guide flow has always used, instead of
    // silently generating from a smaller selection. This holds in every
    // grounding mode: free only skips the rejection vacuously, when no
    // sources were selected at all (there is then nothing unavailable).
    const hasSelectedSources = input.sourceIds.length > 0;
    if (
      grounding.unavailableSources.length > 0 &&
      (groundingMode !== 'free' || hasSelectedSources)
    ) {
      const degraded = new Set(
        grounding.degradedSources.map((source) => source.id),
      );
      const unavailable = grounding.unavailableSources
        .map(
          (source) =>
            `${source.title}${degraded.has(source.id) ? ' (degraded)' : ''}`,
        )
        .join(', ');
      this.logger.warn(
        `Generation for notebook ${notebookId} rejected: selected sources unavailable (${unavailable})`,
      );
      await recordTraces();
      throw new BadRequestError(
        'Selected sources are unavailable or have no readable content. Update your selection and retry.',
        { messageKey: 'errors.generation.sourcesUnavailable' },
      );
    }

    const sourceCount = grounding.sources.length;

    // Free answers from the brief and general knowledge with no sources, so
    // the source-or-brief requirements below do not apply to it. Strict and
    // moderate share the same gates. The count bounds stay unconditional:
    // they gate the request shape, not the grounding.
    const requiresSourceOrBrief = groundingMode !== 'free';

    if (input.kind === 'study_guide') {
      if (sourceCount === 0 && !input.brief.trim() && requiresSourceOrBrief) {
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
      if (sourceCount === 0 && !input.brief.trim() && requiresSourceOrBrief) {
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
      if (sourceCount === 0 && !input.brief.trim() && requiresSourceOrBrief) {
        throw new BadRequestError(
          'Select a source or enter a brief for your case study.',
          { messageKey: 'errors.generation.sourceOrBrief.caseStudy' },
        );
      }
    }

    const requestId = await this.requestManager.create(notebookId, {
      ...input,
      model: modelId,
      groundingMode,
    });

    await recordTraces(requestId);

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
        groundingMode,
      },
      { sources: grounding.sources, evidence: grounding.evidence },
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
}
