import { Inject, Injectable, Logger } from '@nestjs/common';
import { Output, parsePartialJson, streamText, type LanguageModel } from 'ai';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { z } from 'zod';
import * as appSchema from '../../database/schema';
import { studyMaterials } from '../../database/schema';
import { AiService } from '../ai/ai.service';
import type { GatewayRequestOptions } from '../ai/providers/gateway.provider';
import { toClientStreamError } from '../ai/stream-error';
import { languageDirective } from '../../common/i18n/language';
import { DRIZZLE } from '../database/database.module';
import {
  attachGenerationCitations,
  extractGenerationCitations,
} from './generation-citations';
import {
  formatGroundedSourceText,
  type GenerationGrounding,
} from './generation-grounding';
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
import { PracticeProblemsContent } from './practice-problems-content';
import { CaseStudyContent } from './case-study-content';
import {
  extractJson,
  generateTitle,
  normalizeContent,
  repairJsonText,
} from './content-normalizer';
import { withSlidePreviews } from './slides-preview';
import {
  StudyGuideContent,
  prepareGeneratedStudyGuide,
  type StudyGuideGenerationOptions,
} from './study-guide-content';
import {
  prepareGeneratedPracticeProblems,
  type PracticeProblemsGenerationOptions,
} from './practice-problems-content';
import {
  prepareGeneratedCaseStudy,
  type CaseStudyGenerationOptions,
} from './case-study-content';

export interface StreamResult {
  materialId: string;
}

/** The Generation request fields the stream handler needs. */
export interface StreamInput {
  kind: StudyMaterialKind;
  studyGuideOptions?: StudyGuideGenerationOptions;
  practiceProblemsOptions?: PracticeProblemsGenerationOptions;
  caseStudyOptions?: CaseStudyGenerationOptions;
  brief: string;
  folderId?: string | null;
  model?: string;
  language?: string;
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
      citationDirective(hasEvidence);
    const sourceText = formatGroundedSourceText(grounding);
    const userPrompt = promptTemplate.user(input.brief, sourceText, {
      questionCount: input.questionCount,
      difficulty: input.difficulty,
      cardStyle: input.cardStyle,
      roadmapOptions: input.roadmapOptions,
      mindMapOptions: input.mindMapOptions,
      slidesOptions: input.slidesOptions,
      studyGuideOptions: input.studyGuideOptions,
      practiceProblemsOptions: input.practiceProblemsOptions,
      caseStudyOptions: input.caseStudyOptions,
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
        try {
          const modelId = input.model!;
          const provider = await this.aiService.getProviderForModel(modelId);
          // Capability flag is a UI/logging hint only — never a gate. Every
          // model attempts native Output.object({ schema }) first
          // (optimistic-try); on native failure we fall back to strict JSON
          // prompting below. This keeps unlisted families (e.g. zai/glm-*)
          // working instead of pre-throwing before trying.
          const advertisedStructuredOutput =
            provider
              .listModels?.()
              .find((candidate) => candidate.id === modelId)?.capabilities
              ?.structuredOutput === true;
          model = provider.createModel(modelId);
          requestOptions = this.aiService.getGatewayRequestOptions();

          if (!advertisedStructuredOutput) {
            this.logger.log(
              `Model ${modelId} does not advertise native structured output; attempting native Output.object first with JSON fallback on failure.`,
            );
          }

          const result = streamText({
            model,
            output: Output.object({ schema }),
            instructions: systemPrompt,
            prompt: userPrompt,
            ...requestOptions,
            abortSignal,
          });

          for await (const partial of result.partialOutputStream) {
            controller.enqueue(
              new TextEncoder().encode(`${JSON.stringify(partial)}\n`),
            );
          }

          const finalContent: unknown = await result.output;
          const normalized = normalizeContent(input.kind, finalContent);
          const validated = validateContent(input.kind, normalized);
          const storable = this.prepareStorable(input, validated, grounding);

          if (abortSignal?.aborted) {
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
          if (abortSignal?.aborted || isAbortError(nativeError)) {
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
              `no explanations, no markdown formatting, no backticks.\nSchema hint for "${input.kind}": ${fallbackSchemaHint(input.kind)}`;

            const fallbackResult = streamText({
              model,
              instructions: fallbackSystemPrompt,
              prompt: userPrompt,
              ...requestOptions,
              temperature: 0,
              maxOutputTokens: 16000,
              abortSignal,
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

            // Staged tolerant parse: strict JSON -> AI SDK partial repair ->
            // single-quote/trailing-comma repair -> strict again -> partial of
            // the repaired text. Throws with a truncated preview for logs.
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
            const storable = this.prepareStorable(input, validated, grounding);

            if (abortSignal?.aborted) {
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
            if (abortSignal?.aborted || isAbortError(fallbackError)) {
              controller.close();
              return;
            }
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

  /**
   * Validates and shapes the model output for storage, then attaches the
   * citations the model actually emitted. Extraction runs against the final
   * content and only accepts evidence keys retrieved for this Generation, so
   * an invented or stale key is dropped rather than stored.
   */
  private prepareStorable(
    input: StreamInput,
    validated: unknown,
    grounding: Pick<GenerationGrounding, 'sources' | 'evidence'>,
  ): Record<string, unknown> {
    const allowedIds = grounding.sources.map((source) => source.id);
    const storable: Record<string, unknown> =
      input.kind === 'study_guide'
        ? prepareGeneratedStudyGuide(
            validated,
            allowedIds,
            input.studyGuideOptions,
          )
        : input.kind === 'practice_problems'
          ? prepareGeneratedPracticeProblems(validated, allowedIds, {
              ...input.practiceProblemsOptions,
              questionCount: input.questionCount,
              difficulty:
                input.difficulty ?? input.practiceProblemsOptions?.difficulty,
            })
          : input.kind === 'case_study'
            ? prepareGeneratedCaseStudy(validated, allowedIds, {
                ...input.caseStudyOptions,
                questionCount:
                  input.caseStudyOptions?.questionCount ?? input.questionCount,
              })
            : input.kind === 'slides'
              ? withSlidePreviews(validated as Record<string, unknown>)
              : (validated as Record<string, unknown>);
    return attachGenerationCitations(
      storable,
      extractGenerationCitations(storable, grounding.evidence),
    );
  }

  private getContentSchema(kind: StudyMaterialKind): z.ZodTypeAny {
    const schemas: Record<StudyMaterialKind, z.ZodTypeAny> = {
      quiz: QuizContent,
      simple_flashcard: SimpleFlashcardContent,
      roadmap: RoadmapContent,
      mind_map: MindMapContent,
      slides: SlidesContent,
      study_guide: StudyGuideContent,
      practice_problems: PracticeProblemsContent,
      case_study: CaseStudyContent,
    };
    return schemas[kind];
  }
}

/**
 * Detect an abort/response-aborted error so it is not surfaced to the client
 * as a generation failure.
 */
function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'ResponseAborted')
  );
}

/**
 * The citation contract for every kind. Evidence keys are printed in the
 * source block; the model echoes them in the text it generates and the stream
 * handler turns them into stored citations. Only added when the Generation is
 * actually grounded, so an ungrounded material is never asked to cite.
 */
function citationDirective(hasEvidence: boolean): string {
  if (!hasEvidence) return '';
  return `

CITATIONS:
- The source material labels each passage with an evidence key such as [Evidence R1].
- End every sentence that states something taken from the source material with that key in square brackets, exactly like [ref:R1].
- Use only keys that appear in the source material. Never invent a key, a display number, or a source, and never cite a passage you were not given.
- Questions, examples, and explanations you create are your own work; cite only the passages that support the facts they rest on.`;
}

/**
 * Concise per-kind schema hint for the JSON fallback prompt: required shape
 * plus one tiny valid example. Hand-written (no zod-to-json-schema dep) and
 * deliberately minimal to keep the prompt short.
 */
function fallbackSchemaHint(kind: StudyMaterialKind): string {
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
    case 'study_guide':
      return `{"title", "overview", "learningObjectives": [string], "sections": [{"id", "title", "explanation", "keyConcepts": [string]}]}. Example: {"title": "Sample Guide", "overview": "Basics.", "learningObjectives": ["Understand X"], "sections": [{"id": "s1", "title": "X", "explanation": "X means...", "keyConcepts": ["X"]}]}`;
    case 'practice_problems':
      return `{"title", "problems": [{"id", "prompt", "steps": [{"id", "title", "explanation"}], "answer"}]}. Example: {"title": "Sample Problems", "difficulty": "medium", "problems": [{"id": "p1", "prompt": "Solve 2x=4.", "steps": [{"id": "p1-s1", "title": "Divide", "explanation": "Divide both sides by 2."}], "answer": "x=2"}]}`;
    case 'case_study':
      return `{"title", "learningObjectives": [string], "scenario": {"title", "setting", "narrative"}, "questions": [{"id", "prompt"}]}. Example: {"title": "Sample Case", "learningObjectives": ["Analyze X"], "scenario": {"title": "Scenario", "setting": "A clinic.", "narrative": "A patient..."}, "questions": [{"id": "c1", "prompt": "What would you do?"}]}`;
    default:
      return `A JSON object with a "title" string field. Example: {"title": "Sample"}`;
  }
}

function buildOptions(input: StreamInput): Record<string, unknown> | null {
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
    case 'study_guide':
      return {
        format: input.studyGuideOptions?.format ?? 'detailed',
        sectionCount: input.studyGuideOptions?.sectionCount ?? 6,
      };
    case 'practice_problems': {
      const problemCount =
        input.practiceProblemsOptions?.problemCount ?? input.questionCount ?? 8;
      const difficulty =
        input.practiceProblemsOptions?.difficulty ??
        input.difficulty ??
        'medium';
      return { problemCount, difficulty };
    }
    case 'case_study': {
      return {
        questionCount:
          input.caseStudyOptions?.questionCount ?? input.questionCount ?? 4,
        focus: input.caseStudyOptions?.focus ?? '',
        comparePerspectives:
          input.caseStudyOptions?.comparePerspectives ?? false,
      };
    }
    case 'slides': {
      if (input.slidesOptions == null) return null;
      return input.slidesOptions;
    }
    default:
      return null;
  }
}
