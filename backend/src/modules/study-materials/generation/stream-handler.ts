import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Output, parsePartialJson, streamText, type LanguageModel } from 'ai';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { KokoroSpeechService } from '../audio/kokoro-speech.service';
import { z } from 'zod';
import * as appSchema from '../../../database/schema';
import { AiService } from '../../ai/ai.service';
import type { GatewayRequestOptions } from '../../ai/providers/gateway.provider';
import { toClientStreamError } from '../../ai/stream-error';
import { classifyGatewayError } from '../../ai/providers/gateway-errors';
import { DRIZZLE } from '../../database/database.module';
import { GenerationMaterialWriter } from './streaming/material-writer';
import { parseFallbackContent } from './streaming/fallback-parser';
import {
  fallbackSchemaHint,
  normalizeAudioContent,
  buildGenerationPrompt,
  assertAudioLength,
} from './streaming/generation-policy';
import {
  AudioGenerationError,
  AudioScriptLengthError,
  isAbortError,
} from './streaming/stream-errors';
import { type GenerationGrounding } from './generation-grounding';
import type { StartGenerationInput } from './generation-request-manager';
import {
  AUDIO_OVERVIEW_WORD_LIMITS,
  QuizContent,
  shuffleQuizOptions,
  validateContent,
} from '../content/shapes';
import { extractJson, normalizeContent } from '../content/content-normalizer';

export interface StreamResult {
  materialId: string;
}

export type StreamInput = StartGenerationInput;

const NO_OUTPUT_GUARD_MS = 90_000;

@Injectable()
export class StreamHandler {
  private readonly logger = new Logger(StreamHandler.name);
  private readonly writer: GenerationMaterialWriter;

  constructor(
    @Inject(DRIZZLE)
    db: NodePgDatabase<typeof appSchema>,
    private readonly aiService: AiService,
    @Optional() speechService?: KokoroSpeechService,
  ) {
    this.writer = new GenerationMaterialWriter(db, speechService);
  }

  private async finalizeMaterial(
    notebookId: string,
    input: StreamInput,
    normalized: unknown,
    validate: (content: unknown) => Promise<unknown>,
    grounding: Pick<GenerationGrounding, 'sources' | 'evidence'>,
    options: Record<string, unknown> | null,
    requestId: string,
    signal: AbortSignal | undefined,
    onSynthesisStart: () => void,
  ) {
    const validated = await validate(normalized);
    const contentToStore =
      input.kind === 'quiz'
        ? shuffleQuizOptions(validated as z.infer<typeof QuizContent>)
        : validated;
    const storable = this.writer.prepareStorable(
      input,
      contentToStore,
      grounding,
    );
    if (signal?.aborted) return null;
    return this.writer.saveMaterial(
      notebookId,
      input,
      normalized,
      storable,
      options,
      requestId,
      signal,
      input.kind === 'audio_overview' ? onSynthesisStart : undefined,
    );
  }

  createStream(
    notebookId: string,
    input: StreamInput,
    grounding: Pick<GenerationGrounding, 'sources' | 'evidence'>,
    requestId: string,
    onDone: (result: StreamResult) => void,
    onError: (error: string) => void,
    abortSignal?: AbortSignal,
  ) {
    const prompt = buildGenerationPrompt(input, grounding);
    if (
      prompt.formatted.droppedBlocks > 0 ||
      prompt.formatted.truncatedSourceIds.length > 0
    ) {
      this.logger.warn(
        `Generation ${requestId} prompt budget: dropped ${prompt.formatted.droppedBlocks} evidence block(s) and truncated ${prompt.formatted.truncatedSourceIds.length} source excerpt(s) (${prompt.formatted.truncatedSourceIds.join(', ') || 'none'})`,
      );
    }
    const { systemPrompt, userPrompt, schema, options, formatted } = prompt;

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
        const validateWithAudioRetry = async (content: unknown) => {
          const validated = validateContent(input.kind, content);
          try {
            assertAudioLength(input, validated);
            return validated;
          } catch (error) {
            if (!(error instanceof AudioScriptLengthError)) throw error;
            this.logger.warn(
              `Generation ${requestId}: ${error.message}; retrying once.`,
            );
            const target = {
              short: '250–320',
              standard: '550–700',
              extended: '1250–1400',
            }[input.audioOverviewOptions?.length ?? 'standard'];
            const receivedWords = Number(
              error.message.match(/Received (\d+) words/)?.[1],
            );
            const minimum =
              AUDIO_OVERVIEW_WORD_LIMITS[
                input.audioOverviewOptions?.length ?? 'standard'
              ].min;
            const revision =
              receivedWords < minimum
                ? 'Expand the explanations using the supplied evidence without adding unsupported claims.'
                : 'Condense substantially: remove repetition and unnecessary examples; do not add new sections or ideas.';
            let retryError: Error | undefined;
            const retry = streamText({
              model,
              output: Output.object({ schema }),
              instructions: systemPrompt,
              prompt: `${userPrompt}\n\nThe previous script failed validation: ${error.message}. Rewrite it as a dialogue of ${target} spoken words total across all sections and speakers, not per section. Count carefully. ${revision} Preserve source references and the dialogue structure. Previous script:\n${JSON.stringify(validated)}\n\nFinal requirement: ${target} spoken words total across the entire script, with at most 15,000 characters.`,
              ...requestOptions,
              abortSignal: modelAbort.signal,
              onError: ({ error: cause }) => {
                retryError =
                  cause instanceof Error ? cause : new Error(String(cause));
              },
            });
            for await (const partial of retry.partialOutputStream)
              emitFrame(partial);
            const result: unknown = await retry.output;
            if (retryError) throw retryError;
            const normalized = normalizeAudioContent(
              input.kind,
              normalizeContent(input.kind, schema.parse(result)),
            );
            const repaired = validateContent(input.kind, normalized);
            assertAudioLength(input, repaired);
            return repaired;
          }
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
          const inserted = await this.finalizeMaterial(
            notebookId,
            input,
            normalized,
            validateWithAudioRetry,
            grounding,
            options,
            requestId,
            abortSignal,
            () => emitStage('synthesizing_audio'),
          );
          if (!inserted) {
            cleanup();
            controller.close();
            return;
          }

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

            const parsedContent = await parseFallbackContent(
              cleanText,
              requestId,
            );

            const normalizedContent = normalizeAudioContent(
              input.kind,
              normalizeContent(
                input.kind,
                input.kind === 'audio_overview'
                  ? schema.parse(parsedContent)
                  : parsedContent,
              ),
            );

            const inserted = await this.finalizeMaterial(
              notebookId,
              input,
              normalizedContent,
              validateWithAudioRetry,
              grounding,
              options,
              requestId,
              abortSignal,
              () => emitStage('synthesizing_audio'),
            );
            if (!inserted) {
              cleanup();
              controller.close();
              return;
            }

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
}
