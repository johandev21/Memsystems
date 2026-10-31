import { Injectable, Logger } from '@nestjs/common';
import {
  BadRequestError,
  NotFoundError,
} from '../../../common/errors/domain-error';
import { ConnectionService } from '../../ai/connection.service';
import { AiService } from '../../ai/ai.service';
import { RetrievalTraceService } from '../../ai/retrieval/retrieval-trace.service';
import { NotebooksService } from '../../notebooks/notebooks.service';
import {
  DEFAULT_GROUNDING_MODE,
  resolveGroundingMode,
} from '../../notebooks/grounding-mode';
import {
  GenerationRequestManager,
  StartGenerationInput,
} from './generation-request-manager';
import { GenerationGroundingService } from './generation-grounding';
import { StudyMaterialKind } from '../content/shapes';
import { StreamHandler } from './stream-handler';

const MODELS_BY_KIND: Record<StudyMaterialKind, string> = {
  quiz: 'openai/gpt-5.6-sol',
  simple_flashcard: 'openai/gpt-5.6-sol',
  roadmap: 'openai/gpt-5.6-sol',
  mind_map: 'openai/gpt-5.6-sol',
  slides: 'openai/gpt-5.6-sol',
  audio_overview: 'openai/gpt-5.6-sol',
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
    private readonly aiService: AiService,
  ) {}

  async generate(
    notebookId: string,
    input: StartGenerationInput,
    externalSignal?: AbortSignal,
  ) {
    const sourceIds = input.sourceIds ?? [];
    input = { ...input, sourceIds: input.sourceIds ?? [] };
    await this.notebooksService.assertNotebookOwner(notebookId);
    if (input.replaceMaterialId && input.kind !== 'audio_overview') {
      throw new BadRequestError('Only Audio Overviews can be replaced.');
    }
    if (input.kind === 'audio_overview') {
      input = {
        ...input,
        audioOverviewOptions: {
          format: 'briefing',
          length: 'standard',
          audience: 'some_background',
          ...input.audioOverviewOptions,
        },
      };
    }
    if (input.kind === 'audio_overview' && sourceIds.length === 0) {
      throw new BadRequestError(
        'Select at least one source for an audio overview.',
        {
          messageKey: 'errors.generation.sourcesUnavailable',
        },
      );
    }
    if (
      input.kind === 'audio_overview' &&
      input.language &&
      !/^(en|es)(-|$)/i.test(input.language)
    ) {
      throw new BadRequestError('Audio overviews support English and Spanish.');
    }
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

    const provider = await this.aiService.getProviderForModel(modelId);
    this.aiService.requireStructuredOutput(
      provider,
      modelId,
      'errors.ai.model.structuredOutputUnsupported',
    );

    const grounding = await this.groundingService.ground({
      notebookId,
      kind: input.kind,
      brief: input.brief,
      sourceIds,
    });
    if (input.kind === 'audio_overview' && grounding.evidence.length === 0) {
      throw new BadRequestError('Selected sources have no usable evidence.', {
        messageKey: 'errors.generation.sourcesUnavailable',
      });
    }

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

    const hasSelectedSources = sourceIds.length > 0;
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
    const markCancelled = () => {
      this.activeRequests.delete(requestId);
      void this.requestManager.cancel(requestId);
    };
    if (controller.signal.aborted) markCancelled();
    else
      controller.signal.addEventListener('abort', markCancelled, {
        once: true,
      });

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
