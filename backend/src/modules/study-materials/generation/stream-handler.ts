import { Inject, Injectable, Logger } from '@nestjs/common';
import { Output, parsePartialJson, streamText, type LanguageModel } from 'ai';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { z } from 'zod';
import * as appSchema from '../../../database/schema';
import { studyMaterials } from '../../../database/schema';
import { AiService } from '../../ai/ai.service';
import type { GatewayRequestOptions } from '../../ai/providers/gateway.provider';
import { toClientStreamError } from '../../ai/stream-error';
import { languageDirective } from '../../../common/i18n/language';
import { DRIZZLE } from '../../database/database.module';
import {
  attachGenerationCitations,
  extractGenerationCitations,
} from './generation-citations';
import {
  formatGroundedSourceText,
  type GenerationGrounding,
} from './generation-grounding';
import type { StartGenerationInput } from './generation-request-manager';
import { getPromptTemplate } from './prompts';
import type {
  QuizGenerationOptions,
  FlashcardGenerationOptions,
} from './prompts';
import {
  MindMapContent,
  QuizContent,
  RoadmapContent,
  SimpleFlashcardContent,
  SlidesContent,
  StudyMaterialKind,
  shuffleQuizOptions,
  validateContent,
} from '../content/shapes';
import {
  extractJson,
  generateTitle,
  normalizeContent,
  repairJsonText,
} from '../content/content-normalizer';
import { withSlidePreviews } from '../slides/slides-preview';
import {
  GENERAL_KNOWLEDGE_SUPPLEMENT_FIELD,
  GENERAL_KNOWLEDGE_SUPPLEMENT_LABEL,
  freeUngroundedDirective,
  moderateSupplementDirective,
  stripGeneralKnowledgeSupplement,
} from './generation-supplement';

export interface StreamResult {
  materialId: string;
}

export type StreamInput = Omit<StartGenerationInput, 'sourceIds'>;

const NO_OUTPUT_GUARD_MS = 90_000;

@Injectable()
export class StreamHandler {
  private readonly logger = new Logger(StreamHandler.name);

  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly aiService: AiService,
  ) {}

  createStream(
    notebookId: string,
    input: StreamInput,
    grounding: Pick<GenerationGrounding, 'sources' | 'evidence'>,
    requestId: string,
    onDone: (result: StreamResult) => void,
    onError: (error: string) => void,
    abortSignal?: AbortSignal,
  ) {
    const promptTemplate = getPromptTemplate(input.kind);
    const hasEvidence = grounding.evidence.length > 0;
    const systemPrompt =
      promptTemplate.instructions +
      languageDirective(input.language) +
      citationDirective(hasEvidence) +
      groundingDirective(input.groundingMode, hasEvidence);
    const formatted = formatGroundedSourceText(grounding, {
      includeSourceId: false,
    });
    if (
      formatted.droppedBlocks > 0 ||
      formatted.truncatedSourceIds.length > 0
    ) {
      this.logger.warn(
        `Generation ${requestId} prompt budget: dropped ${formatted.droppedBlocks} evidence block(s) and truncated ${formatted.truncatedSourceIds.length} source excerpt(s) (${formatted.truncatedSourceIds.join(', ') || 'none'})`,
      );
    }
    const userPrompt = promptTemplate.user(input.brief, formatted.text, {
      questionCount: input.questionCount,
      difficulty: input.difficulty,
      roadmapOptions: input.roadmapOptions,
      mindMapOptions: input.mindMapOptions,
      slidesOptions: input.slidesOptions,
    });
    const schema = this.getContentSchema(input.kind);
    const options = buildOptions(input);

    const stream = new ReadableStream<Uint8Array>({
      start: async (controller) => {
        if (abortSignal?.aborted) {
          controller.close();
          return;
        }
        let model!: LanguageModel;
        let requestOptions: GatewayRequestOptions = {
          providerOptions: { gateway: {} },
        };
        const modelAbort = new AbortController();
        const abortModel = () => modelAbort.abort();
        if (abortSignal) {
          if (abortSignal.aborted) modelAbort.abort();
          else
            abortSignal.addEventListener('abort', abortModel, {
              once: true,
            });
        }
        let guardTimer: ReturnType<typeof setTimeout> | undefined;
        let guardFired = false;
        let firstFrameEmitted = false;
        const cleanup = () => {
          if (guardTimer !== undefined) {
            clearTimeout(guardTimer);
            guardTimer = undefined;
          }
          abortSignal?.removeEventListener('abort', abortModel);
        };
        const emitFrame = (payload: unknown) => {
          firstFrameEmitted = true;
          if (guardTimer !== undefined) {
            clearTimeout(guardTimer);
            guardTimer = undefined;
          }
          controller.enqueue(
            new TextEncoder().encode(`${JSON.stringify(payload)}\n`),
          );
        };
        const startNoOutputGuard = () => {
          if (firstFrameEmitted || guardTimer !== undefined) return;
          guardTimer = setTimeout(() => {
            guardTimer = undefined;
            guardFired = true;
            abortModel();
            this.logger.warn(
              `Generation ${requestId} produced no structured output frame within ${NO_OUTPUT_GUARD_MS} ms; aborting the model call.`,
            );
            const guardError = new Error(
              `No structured output frame was produced within ${NO_OUTPUT_GUARD_MS} ms.`,
            );
            guardError.name = 'NoStructuredOutputError';
            const standardError = new Error(
              toClientStreamError(guardError, {
                id: input.model ?? 'unknown model',
              }),
            );
            controller.error(standardError);
            onError(standardError.message);
          }, NO_OUTPUT_GUARD_MS);
        };
        try {
          const modelId = input.model!;
          const provider = await this.aiService.getProviderForModel(modelId);
          model = provider.createModel(modelId);
          requestOptions = this.aiService.getGatewayRequestOptions();

          startNoOutputGuard();
          const result = streamText({
            model,
            output: Output.object({ schema }),
            instructions: systemPrompt,
            prompt: userPrompt,
            ...requestOptions,
            abortSignal: modelAbort.signal,
          });

          for await (const partial of result.partialOutputStream) {
            emitFrame(partial);
          }

          const finalContent: unknown = await result.output;
          const normalized = normalizeContent(input.kind, finalContent);
          const validated = validateContent(input.kind, normalized);
          const contentToStore =
            input.kind === 'quiz'
              ? shuffleQuizOptions(validated as z.infer<typeof QuizContent>)
              : validated;
          const storable = this.prepareStorable(
            input,
            contentToStore,
            grounding,
          );

          if (abortSignal?.aborted) {
            cleanup();
            controller.close();
            return;
          }

          const [inserted] = await this.db
            .insert(studyMaterials)
            .values({
              notebookId,
              kind: input.kind,
              title: generateTitle(input.kind, normalized),
              content: storable,
              options,
              folderId: input.folderId ?? null,
            })
            .returning();

          cleanup();
          controller.enqueue(
            new TextEncoder().encode(
              `${JSON.stringify({
                done: true,
                requestId,
                materialId: inserted.id,
                grounding: {
                  droppedBlocks: formatted.droppedBlocks,
                  truncatedSourceIds: formatted.truncatedSourceIds,
                },
              })}\n`,
            ),
          );
          controller.close();
          onDone({ materialId: inserted.id });
        } catch (nativeError) {
          if (guardFired) {
            cleanup();
            return;
          }
          if (abortSignal?.aborted || isAbortError(nativeError)) {
            cleanup();
            controller.close();
            return;
          }
          this.logger.warn(
            `Native structured output failed, falling back to strict JSON prompting for ${requestId}`,
            nativeError,
          );

          try {
            const fallbackSystemPrompt =
              `${systemPrompt}\n\nIMPORTANT: You must respond ONLY with a valid JSON object matching the requested structure. ` +
              `Use strict JSON: double quotes around all keys and strings (never single quotes), no trailing commas, no comments, ` +
              `no explanations, no markdown formatting, no backticks.\nSchema hint for "${input.kind}": ${fallbackSchemaHint(input.kind, input.groundingMode)}`;

            const fallbackResult = streamText({
              model,
              instructions: fallbackSystemPrompt,
              prompt: userPrompt,
              ...requestOptions,
              temperature: 0,
              maxOutputTokens: 16000,
              abortSignal: modelAbort.signal,
            });

            let accumulatedText = '';
            for await (const chunk of fallbackResult.textStream) {
              accumulatedText += chunk;

              const cleanText = extractJson(accumulatedText);

              try {
                const parsed = await parsePartialJson(cleanText);
                if (
                  parsed.state === 'successful-parse' ||
                  parsed.state === 'repaired-parse'
                ) {
                  emitFrame(parsed.value);
                }
              } catch {
                void 0;
              }
            }

            const cleanText = extractJson(accumulatedText);

            let parsedContent: unknown;
            try {
              parsedContent = JSON.parse(cleanText);
            } catch (strictError) {
              const partialParsed = await parsePartialJson(cleanText).catch(
                () => null,
              );
              if (
                partialParsed &&
                (partialParsed.state === 'successful-parse' ||
                  partialParsed.state === 'repaired-parse')
              ) {
                parsedContent = partialParsed.value;
              } else {
                const repaired = repairJsonText(cleanText);
                try {
                  parsedContent = JSON.parse(repaired);
                } catch {
                  const repairedPartial = await parsePartialJson(
                    repaired,
                  ).catch(() => null);
                  if (
                    repairedPartial &&
                    (repairedPartial.state === 'successful-parse' ||
                      repairedPartial.state === 'repaired-parse')
                  ) {
                    parsedContent = repairedPartial.value;
                  } else {
                    const reason =
                      strictError instanceof Error
                        ? strictError.message
                        : String(strictError);
                    const preview = cleanText.slice(0, 500);
                    throw new SyntaxError(
                      `Fallback JSON parse failed for ${requestId} (${reason}). Preview: ${preview}`,
                    );
                  }
                }
              }
            }

            const normalizedContent = normalizeContent(
              input.kind,
              parsedContent,
            );

            const validated = validateContent(input.kind, normalizedContent);
            const contentToStore =
              input.kind === 'quiz'
                ? shuffleQuizOptions(validated as z.infer<typeof QuizContent>)
                : validated;
            const storable = this.prepareStorable(
              input,
              contentToStore,
              grounding,
            );

            if (abortSignal?.aborted) {
              cleanup();
              controller.close();
              return;
            }

            const [inserted] = await this.db
              .insert(studyMaterials)
              .values({
                notebookId,
                kind: input.kind,
                title: generateTitle(input.kind, normalizedContent),
                content: storable,
                options,
                folderId: input.folderId ?? null,
              })
              .returning();

            cleanup();
            controller.enqueue(
              new TextEncoder().encode(
                `${JSON.stringify({
                  done: true,
                  requestId,
                  materialId: inserted.id,
                  grounding: {
                    droppedBlocks: formatted.droppedBlocks,
                    truncatedSourceIds: formatted.truncatedSourceIds,
                  },
                })}\n`,
              ),
            );
            controller.close();
            onDone({ materialId: inserted.id });
          } catch (fallbackError) {
            if (guardFired) {
              cleanup();
              return;
            }
            if (abortSignal?.aborted || isAbortError(fallbackError)) {
              cleanup();
              controller.close();
              return;
            }
            this.logger.error(
              'Generation stream failed on fallback',
              fallbackError,
            );

            cleanup();
            const standardError = new Error(
              toClientStreamError(fallbackError, {
                id: input.model ?? 'unknown model',
              }),
            );
            controller.error(standardError);
            onError(standardError.message);
          }
        }
      },
    });

    return { stream };
  }

  private prepareStorable(
    input: StreamInput,
    validated: unknown,
    grounding: Pick<GenerationGrounding, 'sources' | 'evidence'>,
  ): Record<string, unknown> {
    const storable: Record<string, unknown> =
      input.kind === 'slides'
        ? withSlidePreviews(validated as Record<string, unknown>)
        : (validated as Record<string, unknown>);
    const withCitations = attachGenerationCitations(
      storable,
      extractGenerationCitations(storable, grounding.evidence),
    );
    if (input.groundingMode === 'moderate') return withCitations;
    return stripGeneralKnowledgeSupplement(withCitations);
  }

  private getContentSchema(kind: StudyMaterialKind): z.ZodTypeAny {
    const schemas: Record<StudyMaterialKind, z.ZodTypeAny> = {
      quiz: QuizContent,
      simple_flashcard: SimpleFlashcardContent,
      roadmap: RoadmapContent,
      mind_map: MindMapContent,
      slides: SlidesContent,
    };
    return schemas[kind];
  }
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'ResponseAborted')
  );
}

function citationDirective(hasEvidence: boolean): string {
  if (!hasEvidence) return '';
  return `

CITATIONS:
- The source material labels each passage with an evidence key such as [Evidence R1].
- End every sentence that states something taken from the source material with that key in square brackets, exactly like [ref:R1].
- Use only keys that appear in the source material. Never invent a key, a display number, or a source, and never cite a passage you were not given.
- Questions, examples, and explanations you create are your own work; cite only the passages that support the facts they rest on.`;
}

function groundingDirective(
  groundingMode: StreamInput['groundingMode'],
  hasEvidence: boolean,
): string {
  if (groundingMode === 'moderate') return moderateSupplementDirective();
  if (groundingMode === 'free' && !hasEvidence)
    return freeUngroundedDirective();
  return '';
}

function fallbackSchemaHint(
  kind: StudyMaterialKind,
  groundingMode?: StreamInput['groundingMode'],
): string {
  const base = baseFallbackSchemaHint(kind);
  if (groundingMode !== 'moderate') return base;
  return (
    `${base} You may also include an optional ` +
    `"${GENERAL_KNOWLEDGE_SUPPLEMENT_FIELD}" string with general-knowledge context that goes beyond the sources, ` +
    `starting with the label "${GENERAL_KNOWLEDGE_SUPPLEMENT_LABEL}: ".`
  );
}

function baseFallbackSchemaHint(kind: StudyMaterialKind): string {
  switch (kind) {
    case 'quiz':
      return `{"title": string, "questions": [{"id", "prompt", "options": [{"id", "text", "explanation"}], "correctOptionId", "hint", "topic"}]}. Example: {"title": "Sample Quiz", "questions": [{"id": "q1", "prompt": "What is 2+2?", "options": [{"id": "q1-a", "text": "3", "explanation": "Too low."}, {"id": "q1-b", "text": "4", "explanation": "Correct."}], "correctOptionId": "q1-b", "hint": "", "topic": ""}]}`;
    case 'simple_flashcard':
      return `{"title": string, "cards": [{"front", "back"}]}. Example: {"title": "Sample Cards", "cards": [{"front": "Mitochondria", "back": "Powerhouse of the cell."}]}`;
    case 'roadmap':
      return `{"title", "description", "phases": [{"id", "title", "description", "color": "#rrggbb", "order": 0, "topics": [{"id", "title", "description", "estimatedMinutes": 0, "order": 0}]}]}. Example: {"title": "Sample Roadmap", "description": "", "phases": [{"id": "p1", "title": "Basics", "description": "", "color": "#64748b", "order": 0, "topics": [{"id": "p1-t1", "title": "Intro", "description": "", "estimatedMinutes": 30, "order": 0}]}]}`;
    case 'mind_map':
      return `{"title", "rootId", "nodes": [{"id", "label", "color": "#rrggbb", "position": {"x", "y"}}], "edges": [{"id", "sourceId", "targetId", "label", "directed"}]}. Example: {"title": "Sample Map", "rootId": "n1", "nodes": [{"id": "n1", "label": "Root", "color": "#64748b", "position": {"x": 0, "y": 0}}], "edges": []}`;
    case 'slides':
      return `{"schemaVersion": 2, "title", "design": {"background", "surface", "primary", "secondary", "text", "muted" hex colors}, "slides": [{"id", "role": "content", "title", "elements": []}]}. Example: {"schemaVersion": 2, "title": "Sample Deck", "design": {"background": "#0F172A", "surface": "#1E293B", "primary": "#38BDF8", "secondary": "#818CF8", "text": "#F8FAFC", "muted": "#94A3B8"}, "slides": [{"id": "s1", "role": "content", "title": "Intro", "elements": []}]}`;
    default:
      return `A JSON object with a "title" string field. Example: {"title": "Sample"}`;
  }
}

function buildOptions(input: StreamInput): Record<string, unknown> | null {
  switch (input.kind) {
    case 'quiz': {
      if (input.questionCount == null && input.difficulty == null) return null;
      const opts: QuizGenerationOptions = {
        questionCount: input.questionCount ?? 0,
        difficulty: input.difficulty ?? 'auto',
      };
      return opts as unknown as Record<string, unknown>;
    }
    case 'simple_flashcard': {
      if (input.questionCount == null && input.difficulty == null) return null;
      const opts: FlashcardGenerationOptions = {
        questionCount: input.questionCount ?? 0,
        difficulty: input.difficulty ?? 'auto',
      };
      return opts as unknown as Record<string, unknown>;
    }
    case 'roadmap': {
      if (input.roadmapOptions == null) return null;
      return input.roadmapOptions;
    }
    case 'mind_map': {
      if (input.mindMapOptions == null) return null;
      return input.mindMapOptions;
    }
    case 'slides': {
      if (input.slidesOptions == null) return null;
      return input.slidesOptions;
    }
    default:
      return null;
  }
}
