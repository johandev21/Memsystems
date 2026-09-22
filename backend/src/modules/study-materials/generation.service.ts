import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../common/errors/domain-error';
import { BadRequestError } from '../../common/errors/domain-error';
import { ConnectionService } from '../ai/connection.service';
import { stripChunkContentHeader } from '../ai/chunking.service';
import { RetrievalService, type RetrievedChunk } from '../ai/retrieval.service';
import { RetrievalTraceService } from '../ai/retrieval-trace.service';
import { NotebooksService } from '../notebooks/notebooks.service';
import {
  GenerationRequestManager,
  StartGenerationInput,
} from './generation-request-manager';
import { StudyMaterialKind } from './shapes';
import { StreamHandler } from './stream-handler';

/**
 * Chunks retrieved per selected source for a Generation. A Generation is
 * grounded on every selected source, so the pipeline bounds each source
 * independently; this keeps the prompt within budget until the
 * retrieval-grounded generation ticket reworks coverage.
 */
export const GENERATION_EVIDENCE_CHUNKS_PER_SOURCE = 16;

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
    private readonly notebooksService: NotebooksService,
    private readonly connectionService: ConnectionService,
    private readonly requestManager: GenerationRequestManager,
    private readonly streamHandler: StreamHandler,
    private readonly retrievalService: RetrievalService,
    private readonly retrievalTraceService: RetrievalTraceService,
  ) {}

  async generate(
    notebookId: string,
    input: StartGenerationInput,
    externalSignal?: AbortSignal,
  ) {
    await this.notebooksService.assertNotebookOwner(notebookId);

    const modelId = input.model ?? MODELS_BY_KIND[input.kind];
    await this.connectionService.requireConnected(modelId);

    const retrievalOutcome =
      input.sourceIds.length > 0
        ? await this.retrievalService.retrieve({
            notebookId,
            query: generationRetrievalQuery(input),
            sourceIds: input.sourceIds,
            topK: GENERATION_EVIDENCE_CHUNKS_PER_SOURCE,
            // Selected sources are in scope by definition; the relevance
            // floor and rerank threshold only gate Notebook-wide Evidence
            // for Chat.
            relevanceFloor: 0,
            rerankThreshold: 0,
          })
        : null;

    const sourceTexts = retrievalOutcome
      ? groupChunksBySource(retrievalOutcome.chunks, input.sourceIds)
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

    if (retrievalOutcome) {
      await this.retrievalTraceService.record({
        notebookId,
        kind: 'generation',
        generationRequestId: requestId,
        trace: retrievalOutcome.trace,
      });
    }

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
}

/**
 * A Generation without a brief still needs a retrieval query; the material
 * kind is the only topical signal available.
 */
function generationRetrievalQuery(input: StartGenerationInput): string {
  const brief = input.brief.trim();
  return brief || input.kind.replaceAll('_', ' ');
}

/**
 * Builds the source texts for the prompt from the retrieved chunks, in the
 * caller's selection order so multi-source Generations keep every source.
 */
function groupChunksBySource(
  chunks: RetrievedChunk[],
  sourceIds: string[],
): { id: string; title: string; rawText: string }[] {
  const bySource = new Map<string, RetrievedChunk[]>();
  for (const chunk of chunks) {
    const list = bySource.get(chunk.sourceId) ?? [];
    list.push(chunk);
    bySource.set(chunk.sourceId, list);
  }

  return sourceIds.flatMap((sourceId) => {
    const list = bySource.get(sourceId);
    // A selected source without indexed chunks contributes nothing, matching
    // the previous behavior for unknown ids. Reporting unavailable or
    // degraded selected sources consistently is the retrieval-grounded
    // generation ticket's job.
    if (!list || list.length === 0) return [];
    const ordered = [...list].sort((a, b) => a.chunkIndex - b.chunkIndex);
    return [
      {
        id: sourceId,
        title: ordered[0].title,
        rawText: ordered
          .map((chunk) => stripChunkContentHeader(chunk.content))
          .join('\n\n'),
      },
    ];
  });
}
