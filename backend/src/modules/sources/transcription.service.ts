import { Injectable, Logger, Optional } from '@nestjs/common';
import { generateText } from 'ai';
import { AiService } from '../ai/ai.service';
import { ConnectionService } from '../ai/connection.service';
import {
  TranscriptionInput,
  TranscriptionPort,
  TranscriptionResult,
  TranscriptionSegment,
} from './transcription.port';

export const TRANSCRIPTION_SYSTEM_PROMPT = `You are a precision audio transcription assistant.
Transcribe the provided audio recording accurately with speaker diarization and sequential timestamps.

CRITICAL TRANSCRIPTION RULES:
1. Faithfully transcribe all spoken words without hallucinating, making up inaudible phrases, or altering content.
2. Structure the transcription into sequential chronological segments.
3. Every segment MUST include:
   - "startOffsetMs": start timestamp in milliseconds (integer >= 0)
   - "endOffsetMs": end timestamp in milliseconds (integer > startOffsetMs)
   - "speaker": anonymous speaker identifier ("Speaker A", "Speaker B", "Speaker C", etc.)
   - "content": the transcribed speech text for this segment
   - "confidence": confidence score between 0.0 and 1.0 (optional)
4. Ensure timestamps are strictly monotonic: startOffsetMs < endOffsetMs and each segment follows the previous.
5. If multiple speakers are detected, consistently label them as "Speaker A", "Speaker B", etc.

Return ONLY a valid JSON object matching this shape:
{
  "title": "Optional inferred topic or recording title",
  "language": "en",
  "durationMs": 60000,
  "segments": [
    {
      "speaker": "Speaker A",
      "startOffsetMs": 0,
      "endOffsetMs": 4500,
      "content": "transcribed speech here",
      "confidence": 0.98
    }
  ]
}`;

export function normalizeSpeakerLabel(
  rawSpeaker: string | undefined,
  speakerMap: Map<string, string>,
): string {
  if (!rawSpeaker || typeof rawSpeaker !== 'string') {
    return 'Speaker A';
  }

  const trimmed = rawSpeaker.trim();
  if (!trimmed) {
    return 'Speaker A';
  }

  // If already in standard format "Speaker X", preserve it
  if (/^Speaker\s+[A-Z]$/i.test(trimmed)) {
    const letter = trimmed.split(/\s+/)[1].toUpperCase();
    const formatted = `Speaker ${letter}`;
    if (!speakerMap.has(formatted)) {
      speakerMap.set(formatted, formatted);
    }
    return formatted;
  }

  const existing = speakerMap.get(trimmed);
  if (existing) {
    return existing;
  }

  const nextIndex = speakerMap.size;
  const nextLetter = String.fromCharCode(65 + (nextIndex % 26));
  const assigned = `Speaker ${nextLetter}`;
  speakerMap.set(trimmed, assigned);
  return assigned;
}

export function parseTranscriptionJson(text: string): {
  title?: string;
  language?: string;
  durationMs?: number;
  segments: TranscriptionSegment[];
} | null {
  try {
    let clean = text.trim();
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    const jsonStr = clean.slice(start, end + 1);
    const parsed: unknown = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const parsedObj = parsed as Record<string, unknown>;
    const rawSegments = Array.isArray(parsedObj.segments)
      ? (parsedObj.segments as unknown[])
      : [];

    const segments: TranscriptionSegment[] = [];
    const speakerMap = new Map<string, string>();
    let lastEndMs = 0;

    for (const rawItem of rawSegments) {
      if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
        continue;
      }
      const item = rawItem as Record<string, unknown>;
      const content =
        typeof item.content === 'string' ? item.content.trim() : '';
      if (!content) continue;

      let startOffsetMs =
        typeof item.startOffsetMs === 'number' &&
        Number.isFinite(item.startOffsetMs)
          ? Math.max(0, Math.round(item.startOffsetMs))
          : lastEndMs;

      // Enforce monotonic non-decreasing start timestamp
      if (startOffsetMs < lastEndMs) {
        startOffsetMs = lastEndMs;
      }

      let endOffsetMs =
        typeof item.endOffsetMs === 'number' &&
        Number.isFinite(item.endOffsetMs)
          ? Math.round(item.endOffsetMs)
          : startOffsetMs + 1000;

      // Enforce endOffsetMs > startOffsetMs
      if (endOffsetMs <= startOffsetMs) {
        endOffsetMs = startOffsetMs + 1000;
      }

      lastEndMs = endOffsetMs;

      const speaker = normalizeSpeakerLabel(
        typeof item.speaker === 'string' ? item.speaker : undefined,
        speakerMap,
      );

      let confidence: number | undefined;
      if (
        typeof item.confidence === 'number' &&
        Number.isFinite(item.confidence)
      ) {
        confidence = Math.max(0, Math.min(1, item.confidence));
      }

      segments.push({
        content,
        startOffsetMs,
        endOffsetMs,
        speaker,
        confidence,
      });
    }

    const title =
      typeof parsedObj.title === 'string' ? parsedObj.title.trim() : undefined;
    const language =
      typeof parsedObj.language === 'string'
        ? parsedObj.language.trim()
        : undefined;
    const durationMs =
      typeof parsedObj.durationMs === 'number' &&
      Number.isFinite(parsedObj.durationMs) &&
      parsedObj.durationMs > 0
        ? Math.round(parsedObj.durationMs)
        : segments.length > 0
          ? segments[segments.length - 1].endOffsetMs
          : undefined;

    return {
      title,
      language,
      durationMs,
      segments,
    };
  } catch {
    return null;
  }
}

@Injectable()
export class TranscriptionService implements TranscriptionPort {
  private readonly logger = new Logger(TranscriptionService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly connectionService: ConnectionService,
    @Optional()
    private readonly generateTextFn: typeof generateText = generateText,
  ) {}

  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const buffer = input.audioBuffer || input.buffer;
    const filename = input.fileName || input.filename;

    const modelId = await this.resolveAudioModel(input);
    if (!modelId || !input.userId || !buffer) {
      return this.deterministicFallback(
        input,
        'Audio model unavailable or not configured. Used deterministic fallback transcript.',
      );
    }

    try {
      const provider = await this.aiService.getProviderForModel(
        modelId,
        input.userId,
      );
      const model = provider.createModel(modelId);

      const promptText = input.prompt
        ? `Transcribe this audio recording. Additional instructions: ${input.prompt}`
        : 'Transcribe this audio recording with timestamps and speaker diarization. Follow all system instructions faithfully.';

      const result = await this.generateTextFn({
        model,
        system: TRANSCRIPTION_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: promptText,
              },
              {
                type: 'file',
                data: buffer,
                mimeType: input.mimeType || 'audio/mpeg',
              } as any,
            ],
          },
        ],
      });

      const parsed = parseTranscriptionJson(result.text);
      if (parsed && parsed.segments.length > 0) {
        const rawText = parsed.segments.map((s) => s.content).join('\n\n');
        return {
          title: parsed.title ?? this.inferTitleFromFileName(filename),
          language: parsed.language ?? input.language,
          durationMs: parsed.durationMs,
          durationSeconds:
            parsed.durationMs !== undefined
              ? Math.round(parsed.durationMs / 1000)
              : undefined,
          segments: parsed.segments,
          rawText,
        };
      }

      const rawText = result.text.trim();
      if (rawText.length > 0) {
        return {
          title: this.inferTitleFromFileName(filename),
          language: input.language,
          segments: [
            {
              content: rawText,
              startOffsetMs: 0,
              endOffsetMs: 1000,
              speaker: 'Speaker A',
            },
          ],
          rawText,
          warnings: ['Model output could not be parsed as structured JSON.'],
        };
      }

      return this.deterministicFallback(
        input,
        'Model returned empty response. Used fallback transcript.',
      );
    } catch (err) {
      this.logger.warn(
        `Audio transcription failed with AI model, falling back to deterministic transcription: ${err instanceof Error ? err.message : String(err)}`,
      );
      return this.deterministicFallback(
        input,
        `Transcription model error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async transcribeAudio(
    input: TranscriptionInput,
  ): Promise<TranscriptionResult> {
    return this.transcribe(input);
  }

  private async resolveAudioModel(
    input: TranscriptionInput,
  ): Promise<string | null> {
    if (!input.userId) {
      return null;
    }

    try {
      const snapshot = await this.connectionService.snapshot(input.userId);
      const audioModels = snapshot.models.filter(
        (m) => m.capabilities?.audioInput === true,
      );

      if (input.modelId) {
        const found = audioModels.find((m) => m.id === input.modelId);
        if (found) return found.id;
      }

      if (audioModels.length > 0) {
        return audioModels[0].id;
      }

      // If no explicit audioInput capability model, check general multimodal models
      const multimodalModels = snapshot.models.filter(
        (m) => m.capabilities?.imageInput === true,
      );
      if (multimodalModels.length > 0) {
        return multimodalModels[0].id;
      }
    } catch (err) {
      this.logger.debug(
        `Could not resolve audio model: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return null;
  }

  private inferTitleFromFileName(fileName?: string): string {
    if (!fileName) return 'Audio Document';
    return fileName.replace(/\.[^/.]+$/, '').trim() || 'Audio Document';
  }

  deterministicFallback(
    input: TranscriptionInput,
    reason?: string,
  ): TranscriptionResult {
    const filename = input.fileName || input.filename;
    const title = this.inferTitleFromFileName(filename);

    return {
      title,
      language: input.language ?? 'en',
      durationMs: 0,
      durationSeconds: 0,
      rawText: '',
      segments: [],
      warnings: [
        reason ??
          'Audio model unavailable or not configured. No automatic transcript generated.',
      ],
    };
  }
}
