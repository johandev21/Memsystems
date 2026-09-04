import { Inject, Injectable, Logger } from '@nestjs/common';
import { Output, parsePartialJson, streamText, type LanguageModel } from 'ai';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { z } from 'zod';
import * as appSchema from '../../database/schema';
import { studyMaterials } from '../../database/schema';
import { AiService } from '../ai/ai.service';
import type { GatewayRequestOptions } from '../ai/providers/gateway.provider';
import { toClientStreamError } from '../ai/stream-error';
import { DRIZZLE } from '../database/database.module';
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
  validateContent,
} from './shapes';
import {
  extractJson,
  generateTitle,
  normalizeContent,
} from './content-normalizer';
import { withSlidePreviews } from './slides-preview';

export interface StreamResult {
  materialId: string;
}

@Injectable()
export class StreamHandler {
  private readonly logger = new Logger(StreamHandler.name);

  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly aiService: AiService,
  ) {}

  createStream(
    userId: string,
    notebookId: string,
    input: {
      kind: StudyMaterialKind;
      brief: string;
      folderId?: string | null;
      model?: string;
      questionCount?: number;
      difficulty?: 'easy' | 'medium' | 'hard';
      cardStyle?: 'qa' | 'definition' | 'cloze' | 'mixed';
      roadmapOptions?: {
        phaseCount: number;
        detailLevel: 'basic' | 'detailed';
      };
      mindMapOptions?: {
        nodeCount: number;
        structure: 'radial' | 'hierarchical' | 'organic';
        colorGroups: boolean;
        crossLinks: boolean;
        detailLevel: 'basic' | 'detailed';
      };
      slidesOptions?: {
        slideCount: number;
        theme:
          | 'dark'
          | 'light'
          | 'accent'
          | 'editorial'
          | 'academic'
          | 'technical'
          | 'warm';
        detailLevel: 'basic' | 'detailed';
      };
    },
    sourceTexts: { title: string; rawText: string }[],
    requestId: string,
    onDone: (result: StreamResult) => void,
    onError: (error: string) => void,
  ) {
    const promptTemplate = getPromptTemplate(input.kind);
    const systemPrompt = promptTemplate.instructions;
    const concatenatedSources = sourceTexts
      .map((s) => `[${s.title}]\n${s.rawText}`)
      .join('\n\n---\n\n');
    const userPrompt = promptTemplate.user(
      input.brief,
      concatenatedSources.slice(0, 100000),
      {
        questionCount: input.questionCount,
        difficulty: input.difficulty,
        cardStyle: input.cardStyle,
        roadmapOptions: input.roadmapOptions,
        mindMapOptions: input.mindMapOptions,
        slidesOptions: input.slidesOptions,
      },
    );
    const schema = this.getContentSchema(input.kind);
    const options = buildOptions(input);

    const stream = new ReadableStream<Uint8Array>({
      start: async (controller) => {
        let model!: LanguageModel;
        let requestOptions: GatewayRequestOptions = {
          providerOptions: { gateway: {} },
        };
        try {
          const modelId = input.model!;
          const provider = await this.aiService.getProviderForModel(
            modelId,
            userId,
          );
          const supportsStructuredOutput =
            provider
              .listModels?.()
              .find((candidate) => candidate.id === modelId)?.capabilities
              ?.structuredOutput === true;
          model = provider.createModel(modelId);
          requestOptions = this.aiService.getGatewayRequestOptions(userId);

          if (!supportsStructuredOutput) {
            throw new Error(
              `${modelId} doesn't support native structured output; using JSON fallback.`,
            );
          }

          const result = streamText({
            model,
            output: Output.object({ schema }),
            instructions: systemPrompt,
            prompt: userPrompt,
            ...requestOptions,
          });

          for await (const partial of result.partialOutputStream) {
            controller.enqueue(
              new TextEncoder().encode(`${JSON.stringify(partial)}\n`),
            );
          }

          const finalContent: unknown = await result.output;
          const normalized = normalizeContent(input.kind, finalContent);
          const validated = validateContent(input.kind, normalized);
          const storable =
            input.kind === 'slides'
              ? withSlidePreviews(validated as Record<string, unknown>)
              : validated;

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

          controller.enqueue(
            new TextEncoder().encode(
              `${JSON.stringify({
                done: true,
                requestId,
                materialId: inserted.id,
              })}\n`,
            ),
          );
          controller.close();
          onDone({ materialId: inserted.id });
        } catch (nativeError) {
          this.logger.warn(
            `Native structured output failed, falling back to strict JSON prompting for ${requestId}`,
            nativeError,
          );

          try {
            const fallbackSystemPrompt = `${systemPrompt}\n\nIMPORTANT: You must respond ONLY with a valid JSON object matching the requested structure. Do not include any explanations, introduction, markdown formatting, or backticks.`;

            const fallbackResult = streamText({
              model,
              instructions: fallbackSystemPrompt,
              prompt: userPrompt,
              ...requestOptions,
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
                  controller.enqueue(
                    new TextEncoder().encode(
                      `${JSON.stringify(parsed.value)}\n`,
                    ),
                  );
                }
              } catch {
                // Ignore partial parse errors
              }
            }

            const cleanText = extractJson(accumulatedText);

            let parsedContent: unknown;
            try {
              parsedContent = JSON.parse(cleanText);
            } catch (parseError) {
              try {
                const partialParsed = await parsePartialJson(cleanText);
                if (
                  partialParsed.state === 'successful-parse' ||
                  partialParsed.state === 'repaired-parse'
                ) {
                  parsedContent = partialParsed.value;
                } else {
                  throw parseError;
                }
              } catch {
                throw parseError;
              }
            }

            const normalizedContent = normalizeContent(
              input.kind,
              parsedContent,
            );

            const validated = validateContent(input.kind, normalizedContent);
            const storable =
              input.kind === 'slides'
                ? withSlidePreviews(validated as Record<string, unknown>)
                : validated;

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

            controller.enqueue(
              new TextEncoder().encode(
                `${JSON.stringify({
                  done: true,
                  requestId,
                  materialId: inserted.id,
                })}\n`,
              ),
            );
            controller.close();
            onDone({ materialId: inserted.id });
          } catch (fallbackError) {
            this.logger.error(
              'Generation stream failed on fallback',
              fallbackError,
            );

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

function buildOptions(input: {
  kind: StudyMaterialKind;
  questionCount?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  cardStyle?: 'qa' | 'definition' | 'cloze' | 'mixed';
  roadmapOptions?: {
    phaseCount: number;
    detailLevel: 'basic' | 'detailed';
  };
  mindMapOptions?: {
    nodeCount: number;
    structure: 'radial' | 'hierarchical' | 'organic';
    colorGroups: boolean;
    crossLinks: boolean;
    detailLevel: 'basic' | 'detailed';
  };
  slidesOptions?: {
    slideCount: number;
    theme:
      | 'dark'
      | 'light'
      | 'accent'
      | 'editorial'
      | 'academic'
      | 'technical'
      | 'warm';
    detailLevel: 'basic' | 'detailed';
  };
}): Record<string, unknown> | null {
  switch (input.kind) {
    case 'quiz': {
      if (input.questionCount == null && input.difficulty == null) return null;
      const opts: QuizGenerationOptions = {
        questionCount: input.questionCount ?? 10,
        difficulty: input.difficulty ?? 'medium',
      };
      return opts as unknown as Record<string, unknown>;
    }
    case 'simple_flashcard': {
      if (
        input.questionCount == null &&
        input.difficulty == null &&
        input.cardStyle == null
      )
        return null;
      const opts: FlashcardGenerationOptions = {
        questionCount: input.questionCount ?? 10,
        difficulty: input.difficulty ?? 'medium',
        cardStyle: input.cardStyle ?? 'qa',
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
