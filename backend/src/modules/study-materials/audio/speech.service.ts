import { Injectable, Logger } from '@nestjs/common';
import { createGateway } from '@ai-sdk/gateway';
import { experimental_generateSpeech as generateSpeech } from 'ai';
import { KokoroSpeechService } from './kokoro-speech.service';
import { assemblePcm16Wav } from './audio-wav';

const MODEL = 'mistral/voxtral-mini-tts-3';
const MAX_SECTIONS = 40;
const MAX_TURNS = 120;
const MAX_SECTION_CHARS = 4_000;
const MAX_TEXT_CHARS = 30_000;
const MAX_AUDIO_BYTES = 40 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 120_000;

type SpeechTurn = { speaker: 'host' | 'guest'; text: string };
type SpeechSection = { text: string; turns?: SpeechTurn[] };

@Injectable()
export class SpeechService {
  private readonly logger = new Logger(SpeechService.name);
  constructor(private readonly kokoro: KokoroSpeechService) {}

  async synthesizeSections(
    sections: SpeechSection[],
    language: string,
    signal?: AbortSignal,
  ): Promise<Buffer> {
    const lang = language.toLowerCase().split(/[-_]/)[0];
    const normalized = validateSections(sections, lang);
    if (signal?.aborted) throw abortedError();
    if (process.env.AUDIO_SPEECH_PROVIDER?.trim().toLowerCase() === 'kokoro')
      return this.kokoro.synthesizeSections(normalized, lang, signal);
    try {
      return await this.synthesizeGateway(normalized, lang, signal);
    } catch {
      if (signal?.aborted) throw abortedError();
      this.logger.warn(
        'Gateway speech failed; retrying the full script with local Kokoro.',
      );
      // Restart the full script locally so cloud and local audio are never mixed.
      return this.kokoro.synthesizeSections(normalized, lang, signal);
    }
  }

  private async synthesizeGateway(
    sections: Array<{ text: string; turns: SpeechTurn[] }>,
    language: string,
    signal?: AbortSignal,
  ): Promise<Buffer> {
    const apiKey = process.env.AI_GATEWAY_API_KEY?.trim();
    if (!apiKey) throw new Error('AI Gateway is not configured.');
    const gateway = createGateway({ apiKey });
    const audioSections: Buffer[][] = [];
    let calls = 0;
    let receivedBytes = 0;
    for (const section of sections) {
      const clips: Buffer[] = [];
      for (const turn of section.turns) {
        if (signal?.aborted) throw abortedError();
        if (++calls > MAX_TURNS) throw new Error('Too many speech turns.');
        const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
        const abortSignal = signal
          ? AbortSignal.any([signal, timeout])
          : timeout;
        const { audio } = await generateSpeech({
          model: gateway.speechModel(MODEL),
          text: turn.text,
          voice: voiceFor(turn.speaker, language),
          outputFormat: 'wav',
          maxRetries: 0,
          abortSignal,
        });
        if (signal?.aborted) throw abortedError();
        receivedBytes += audio.uint8Array.byteLength;
        if (receivedBytes > MAX_AUDIO_BYTES)
          throw new Error('Speech provider exceeded the 40 MiB audio limit.');
        clips.push(Buffer.from(audio.uint8Array));
      }
      audioSections.push(clips);
    }
    return assemblePcm16Wav(audioSections);
  }
}

function validateSections(sections: SpeechSection[], language: string) {
  if (
    !Array.isArray(sections) ||
    sections.length === 0 ||
    sections.length > MAX_SECTIONS
  )
    throw new Error(`Speech must contain 1–${MAX_SECTIONS} sections.`);
  if (language !== 'en' && language !== 'es')
    throw new Error('Speech supports English (en) and Spanish (es).');
  let total = 0;
  let turnsTotal = 0;
  return sections
    .map((section) => {
      if (!section || typeof section !== 'object')
        throw new Error('Invalid speech section.');
      if (section.turns !== undefined && !Array.isArray(section.turns))
        throw new Error('Speech turns must be an array.');
      const turns = section.turns?.length
        ? section.turns.map(({ speaker, text }) => {
            if (
              (speaker !== 'host' && speaker !== 'guest') ||
              typeof text !== 'string' ||
              !text.trim()
            )
              throw new Error(
                'Each speech turn needs a host or guest speaker and non-empty text.',
              );
            if (text.length > MAX_SECTION_CHARS)
              throw new Error('A speech turn exceeds 4,000 characters.');
            turnsTotal++;
            return { speaker, text };
          })
        : (() => {
            if (typeof section.text !== 'string' || !section.text.trim())
              throw new Error('Speech sections must contain non-empty text.');
            if (section.text.length > MAX_SECTION_CHARS)
              throw new Error('A speech section exceeds 4,000 characters.');
            turnsTotal++;
            return [{ speaker: 'host' as const, text: section.text }];
          })();
      const text = turns.map(({ text }) => text).join('\n\n');
      if (text.length > MAX_SECTION_CHARS)
        throw new Error('A speech section exceeds 4,000 characters total.');
      if (turns.length > MAX_TURNS)
        throw new Error('A speech section contains too many turns.');
      total += text.length;
      return { text, turns };
    })
    .map((section) => {
      if (total > MAX_TEXT_CHARS)
        throw new Error('Speech exceeds 30,000 characters total.');
      if (turnsTotal > MAX_TURNS)
        throw new Error(`Speech exceeds ${MAX_TURNS} turns.`);
      return section;
    });
}

function voiceFor(speaker: SpeechTurn['speaker'], language: string): string {
  const configured =
    process.env[
      speaker === 'host' ? 'VOXTRAL_HOST_VOICE' : 'VOXTRAL_GUEST_VOICE'
    ]?.trim();
  if (configured) return configured;
  if (language === 'es') return 'voice_483';
  return speaker === 'host' ? 'voice_478' : 'voice_485';
}

function abortedError(): Error {
  const error = new Error('Speech synthesis was cancelled.');
  error.name = 'AbortError';
  return error;
}
