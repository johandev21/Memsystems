import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { Output, parsePartialJson, streamText, type LanguageModel } from 'ai';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { z } from 'zod';
import * as appSchema from '../../../database/schema';
import {
  generationRequests,
  studyMaterialAudio,
  studyMaterials,
} from '../../../database/schema';
import { AiService } from '../../ai/ai.service';
import type { GatewayRequestOptions } from '../../ai/providers/gateway.provider';
import { toClientStreamError } from '../../ai/stream-error';
import { classifyGatewayError } from '../../ai/providers/gateway-errors';
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
  AudioOverviewContent,
  assertAudioOverviewScriptLength,
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
import { SpeechService } from '../audio/speech.service';
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

export type StreamInput = StartGenerationInput;

const NO_OUTPUT_GUARD_MS = 90_000;
const MAX_GENERATED_AUDIO_BYTES = 64 * 1024 * 1024;
const MAX_GENERATED_AUDIO_SECONDS = 13 * 60;

@Injectable()
export class StreamHandler {
  private readonly logger = new Logger(StreamHandler.name);

  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly aiService: AiService,
    @Optional() private readonly speechService?: SpeechService,
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
      groundingDirective(
        input.kind === 'audio_overview' ? 'strict' : input.groundingMode,
        hasEvidence,
      );
    const formatted = formatGroundedSourceText(grounding, {
      includeSourceId: false,
      kind: input.kind,
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
      audioOverviewOptions: input.audioOverviewOptions,
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
        let nativeStreamError: Error | undefined;
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
        const emitStage = (stage: 'writing_script' | 'synthesizing_audio') => {
          controller.enqueue(
            new TextEncoder().encode(`${JSON.stringify({ stage })}\n`),
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

          if (input.kind === 'audio_overview') emitStage('writing_script');
          startNoOutputGuard();
          const result = streamText({
            model,
            output: Output.object({ schema }),
            instructions: systemPrompt,
            prompt: userPrompt,
            ...requestOptions,
            abortSignal: modelAbort.signal,
            onError: ({ error }) => {
              nativeStreamError =
                error instanceof Error ? error : new Error(String(error));
            },
          });

          for await (const partial of result.partialOutputStream) {
            emitFrame(partial);
          }

          const finalContent: unknown = await result.output;
          if (nativeStreamError) throw nativeStreamError;
          if (guardTimer !== undefined) {
            clearTimeout(guardTimer);
            guardTimer = undefined;
          }
          const normalized = normalizeAudioContent(
            input.kind,
            normalizeContent(
              input.kind,
              input.kind === 'audio_overview'
                ? schema.parse(finalContent)
                : finalContent,
            ),
          );
          const validated = validateContent(input.kind, normalized);
          assertAudioLength(input, validated);
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

          const inserted = await this.saveMaterial(
            notebookId,
            input,
            normalized,
            storable,
            options,
            requestId,
            abortSignal,
            input.kind === 'audio_overview'
              ? () => emitStage('synthesizing_audio')
              : undefined,
          );

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
        } catch (caughtError: unknown) {
          const nativeError = nativeStreamError ?? caughtError;
          if (guardFired) {
            cleanup();
            return;
          }
          if (abortSignal?.aborted || isAbortError(nativeError)) {
            cleanup();
            controller.close();
            return;
          }
          if (nativeError instanceof AudioGenerationError) {
            cleanup();
            controller.error(nativeError);
            onError(nativeError.message);
            return;
          }
          if (nativeError instanceof AudioScriptLengthError) {
            cleanup();
            controller.error(nativeError);
            onError(nativeError.message);
            return;
          }
          const failure = classifyGatewayError(nativeError);
          if (failure.kind !== 'unknown' && failure.kind !== 'capability') {
            cleanup();
            const error = new Error(
              toClientStreamError(nativeError, {
                id: input.model ?? 'unknown model',
              }),
            );
            controller.error(error);
            onError(error.message);
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

            let fallbackStreamError: Error | undefined;
            const fallbackResult = streamText({
              model,
              instructions: fallbackSystemPrompt,
              prompt: userPrompt,
              ...requestOptions,
              temperature: 0,
              maxOutputTokens: 16000,
              abortSignal: modelAbort.signal,
              onError: ({ error }) => {
                fallbackStreamError =
                  error instanceof Error ? error : new Error(String(error));
              },
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

            if (fallbackStreamError) throw fallbackStreamError;
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

            const normalizedContent = normalizeAudioContent(
              input.kind,
              normalizeContent(
                input.kind,
                input.kind === 'audio_overview'
                  ? schema.parse(parsedContent)
                  : parsedContent,
              ),
            );

            const validated = validateContent(input.kind, normalizedContent);
            assertAudioLength(input, validated);
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

            const inserted = await this.saveMaterial(
              notebookId,
              input,
              normalizedContent,
              storable,
              options,
              requestId,
              abortSignal,
              input.kind === 'audio_overview'
                ? () => emitStage('synthesizing_audio')
                : undefined,
            );

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
            if (fallbackError instanceof AudioScriptLengthError) {
              cleanup();
              controller.error(fallbackError);
              onError(fallbackError.message);
              return;
            }
            this.logger.error(
              'Generation stream failed on fallback',
              fallbackError,
            );

            cleanup();
            const standardError =
              fallbackError instanceof AudioGenerationError
                ? fallbackError
                : new Error(
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

  private async saveMaterial(
    notebookId: string,
    input: StreamInput,
    normalized: unknown,
    storable: Record<string, unknown>,
    options: Record<string, unknown> | null,
    requestId: string,
    signal?: AbortSignal,
    onAudioSynthesisStart?: () => void,
  ) {
    const values = {
      notebookId,
      kind: input.kind,
      title: generateTitle(input.kind, normalized),
      content: storable,
      options,
      folderId: input.folderId ?? null,
    };
    if (input.kind !== 'audio_overview') {
      const [inserted] = await this.db
        .insert(studyMaterials)
        .values(values)
        .returning();
      return inserted;
    }
    try {
      if (!this.speechService)
        throw new Error('Speech synthesis is not configured.');
      onAudioSynthesisStart?.();
      const audioContent = storable as {
        transcript: string;
        sections?: Array<{
          heading: string;
          text: string;
          turns?: Array<{ speaker: 'host' | 'guest'; text: string }>;
        }>;
      };
      const speechSections = audioContent.sections?.length
        ? audioContent.sections.map(({ heading, text, turns }) => ({
            text: `${heading}. ${stripCitationMarkers(text)}`,
            ...(turns
              ? {
                  turns: turns.map((turn) => ({
                    speaker: turn.speaker,
                    text: stripCitationMarkers(turn.text),
                  })),
                }
              : {}),
          }))
        : [{ text: stripCitationMarkers(audioContent.transcript) }];
      const audio = await this.speechService.synthesizeSections(
        speechSections,
        input.language ?? 'en',
        signal,
      );
      if (signal?.aborted)
        throw new DOMException('Generation cancelled', 'AbortError');
      assertGeneratedWav(audio);
      return await this.db.transaction(async (tx) => {
        const [request] = await tx
          .select({ status: generationRequests.status })
          .from(generationRequests)
          .where(eq(generationRequests.id, requestId))
          .for('update');
        if (signal?.aborted || request?.status !== 'streaming')
          throw new DOMException('Generation cancelled', 'AbortError');
        let inserted: typeof studyMaterials.$inferSelect;
        if (input.replaceMaterialId) {
          const [existing] = await tx
            .select()
            .from(studyMaterials)
            .where(eq(studyMaterials.id, input.replaceMaterialId))
            .for('update');
          if (
            !existing ||
            existing.notebookId !== notebookId ||
            existing.kind !== 'audio_overview' ||
            existing.deletedAt
          )
            throw new Error(
              'The Audio Overview selected for replacement is unavailable.',
            );
          [inserted] = await tx
            .update(studyMaterials)
            .set({
              title: values.title,
              content: storable,
              options,
            })
            .where(eq(studyMaterials.id, existing.id))
            .returning();
          const [audioRow] = await tx
            .select({ id: studyMaterialAudio.studyMaterialId })
            .from(studyMaterialAudio)
            .where(eq(studyMaterialAudio.studyMaterialId, existing.id));
          if (audioRow)
            await tx
              .update(studyMaterialAudio)
              .set({ audio, contentType: 'audio/wav' })
              .where(eq(studyMaterialAudio.studyMaterialId, existing.id));
          else
            await tx.insert(studyMaterialAudio).values({
              studyMaterialId: existing.id,
              audio,
              contentType: 'audio/wav',
            });
        } else {
          [inserted] = await tx
            .insert(studyMaterials)
            .values(values)
            .returning();
          await tx.insert(studyMaterialAudio).values({
            studyMaterialId: inserted.id,
            audio,
            contentType: 'audio/wav',
          });
        }
        if (signal?.aborted)
          throw new DOMException('Generation cancelled', 'AbortError');
        return inserted;
      });
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) throw error;
      throw new AudioGenerationError(
        error instanceof Error ? error.message : 'Audio synthesis failed.',
      );
    }
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
    if (input.kind === 'audio_overview') {
      const audio = storable as {
        sections: Array<{
          heading: string;
          text: string;
          turns?: Array<{ speaker: 'host' | 'guest'; text: string }>;
        }>;
      };
      audio.sections = audio.sections.map((section) => {
        const turns = section.turns?.map((turn) => ({
          ...turn,
          text: stripCitationMarkers(turn.text),
        }));
        const text = turns
          ? turns.map((turn) => turn.text).join(' ')
          : stripCitationMarkers(section.text);
        return {
          ...section,
          ...(turns ? { turns } : {}),
          text,
          citations: extractGenerationCitations(section, grounding.evidence),
        };
      });
      (audio as { transcript?: string }).transcript = audio.sections
        .map((section) => section.text)
        .join('\n\n');
    }
    const audioCitations =
      input.kind === 'audio_overview'
        ? (
            (
              storable as {
                sections: Array<{
                  citations: ReturnType<typeof extractGenerationCitations>;
                }>;
              }
            ).sections ?? []
          ).flatMap((section) => section.citations)
        : null;
    const allCitations =
      audioCitations ??
      extractGenerationCitations(storable, grounding.evidence);
    const withCitations = attachGenerationCitations(storable, allCitations);
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
      // Citation metadata is attached after generation, not generated by the model.
      audio_overview: z
        .object({
          title: z.string().min(1).max(200),
          sections: z
            .array(
              z.object({
                heading: z.string().min(1).max(200),
                turns: z
                  .array(
                    z.object({
                      speaker: z.enum(['host', 'guest']),
                      text: z.string().min(1).max(30_000),
                    }),
                  )
                  .min(2),
              }),
            )
            .min(3)
            .max(30),
        })
        .refine(
          (content) => {
            const speakers = new Set(
              content.sections.flatMap((section) =>
                section.turns.map((turn) => turn.speaker),
              ),
            );
            return speakers.has('host') && speakers.has('guest');
          },
          { message: 'Audio Overview dialogue must include both speakers' },
        ),
    };
    return schemas[kind];
  }
}

class AudioGenerationError extends Error {
  constructor(message: string) {
    super(JSON.stringify({ error: message, code: 'audio_synthesis_failed' }));
  }
}

class AudioScriptLengthError extends Error {
  constructor(message: string) {
    super(
      JSON.stringify({ error: message, code: 'audio_script_length_invalid' }),
    );
  }
}

function assertAudioLength(input: StreamInput, content: unknown): void {
  if (input.kind !== 'audio_overview') return;
  try {
    assertAudioOverviewScriptLength(
      content as z.infer<typeof AudioOverviewContent>,
      input.audioOverviewOptions?.length ?? 'standard',
    );
  } catch (error) {
    throw new AudioScriptLengthError(
      error instanceof Error
        ? error.message
        : 'Audio Overview length is invalid.',
    );
  }
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'ResponseAborted')
  );
}

function stripCitationMarkers(text: string): string {
  return text
    .replace(/\[ref:[^\]]+\]/gi, '')
    .replace(/#reference-\d+/gi, '')
    .replace(/\s+([,.;!?])/g, '$1')
    .trim();
}

function assertGeneratedWav(audio: Buffer): void {
  if (
    audio.length < 12 ||
    audio.length > MAX_GENERATED_AUDIO_BYTES ||
    audio.toString('ascii', 0, 4) !== 'RIFF' ||
    audio.toString('ascii', 8, 12) !== 'WAVE'
  ) {
    throw new Error(
      'Speech synthesis returned an invalid or oversized WAV file.',
    );
  }
  let byteRate = 0;
  let dataLength = 0;
  for (let offset = 12; offset + 8 <= audio.length;) {
    const chunkId = audio.toString('ascii', offset, offset + 4);
    const chunkLength = audio.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    if (chunkLength > audio.length - chunkStart) break;
    if (chunkId === 'fmt ' && chunkLength >= 16) {
      byteRate = audio.readUInt32LE(chunkStart + 8);
    } else if (chunkId === 'data') {
      dataLength = chunkLength;
    }
    offset = chunkStart + chunkLength + (chunkLength % 2);
  }
  if (
    byteRate === 0 ||
    dataLength === 0 ||
    dataLength / byteRate > MAX_GENERATED_AUDIO_SECONDS
  ) {
    throw new Error(
      'Speech synthesis returned a WAV with invalid duration metadata.',
    );
  }
}

function normalizeAudioContent(
  kind: StudyMaterialKind,
  content: unknown,
): unknown {
  if (kind !== 'audio_overview' || !content || typeof content !== 'object')
    return content;
  const record = content as Record<string, unknown>;
  const sections = Array.isArray(record.sections)
    ? (record.sections as Array<Record<string, unknown>>)
    : [];
  return {
    ...record,
    sections: sections.map((section) => {
      const turns = Array.isArray(section.turns)
        ? (section.turns as Array<{ speaker: string; text: string }>)
        : undefined;
      return {
        ...section,
        ...(turns ? { text: turns.map((turn) => turn.text).join(' ') } : {}),
      };
    }),
    transcript: sections
      .map((section) =>
        Array.isArray(section.turns)
          ? (section.turns as Array<{ text: string }>)
              .map((turn) => turn.text)
              .join(' ')
          : typeof section.text === 'string'
            ? section.text
            : '',
      )
      .join('\n\n'),
    citations: [],
  };
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
    case 'audio_overview':
      return `{"title": "A concise title", "sections": [{"heading": "Opening", "turns": [{"speaker": "host", "text": "Ask a useful opening question."}, {"speaker": "guest", "text": "Orient the listener and introduce the topic."}]}, {"heading": "Main idea", "turns": [{"speaker": "host", "text": "Ask how the ideas connect."}, {"speaker": "guest", "text": "Explain and connect the ideas."}]}, {"heading": "Wrap-up", "turns": [{"speaker": "host", "text": "Ask for the central takeaway."}, {"speaker": "guest", "text": "Synthesize the learning."}]}]}`;
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
    case 'audio_overview':
      return {
        kind: 'audio_overview',
        ...(input.audioOverviewOptions ?? {
          format: 'briefing',
          length: 'standard',
          audience: 'some_background',
        }),
        brief: input.brief,
        language: input.language ?? 'en',
        sourceIds: input.sourceIds ?? [],
      };
    default:
      return null;
  }
}
