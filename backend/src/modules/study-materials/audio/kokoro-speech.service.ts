import { Injectable } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

const MAX_TEXT_CHARS = 30_000;
const MAX_SECTION_CHARS = 4_000;
const MAX_SECTIONS = 40;
const MAX_WAV_BYTES = 40 * 1024 * 1024;
const MAX_AUDIO_SECONDS = 780;
const TIMEOUT_MS = 900_000;

export class KokoroSpeechError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KokoroSpeechError';
  }
}

@Injectable()
export class KokoroSpeechService {
  private active = false;
  private readonly queue: Array<{
    resolve: (release: () => void) => void;
    reject: (error: Error) => void;
    signal?: AbortSignal;
    abort?: () => void;
  }> = [];

  async synthesize(
    text: string,
    language: string,
    signal?: AbortSignal,
  ): Promise<Buffer> {
    return this.synthesizeSections([{ text }], language, signal);
  }

  async synthesizeSections(
    sections: Array<{ text: string }>,
    language: string,
    signal?: AbortSignal,
  ): Promise<Buffer> {
    if (
      !Array.isArray(sections) ||
      sections.length === 0 ||
      sections.length > MAX_SECTIONS ||
      sections.some(
        (section) =>
          !section ||
          typeof section.text !== 'string' ||
          section.text.trim().length === 0 ||
          section.text.length > MAX_SECTION_CHARS,
      ) ||
      sections.reduce((total, { text }) => total + text.length, 0) >
        MAX_TEXT_CHARS
    ) {
      throw new KokoroSpeechError(
        `Speech must contain 1–${MAX_SECTIONS} non-empty sections, each at most ${MAX_SECTION_CHARS} characters and ${MAX_TEXT_CHARS} characters total.`,
      );
    }
    const lang = language.toLowerCase().split(/[-_]/)[0];
    if (lang !== 'en' && lang !== 'es') {
      throw new KokoroSpeechError(
        'Kokoro speech supports only English (en) and Spanish (es).',
      );
    }
    const release = await this.acquire(signal);
    try {
      if (signal?.aborted) throw abortedError();
      return await this.run(sections, lang, signal);
    } finally {
      release();
    }
  }

  private acquire(signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) return Promise.reject(abortedError());
    return new Promise((resolveGrant, reject) => {
      const ticket = {
        resolve: resolveGrant,
        reject,
        signal,
      } as (typeof this.queue)[number];
      ticket.abort = () => {
        const index = this.queue.indexOf(ticket);
        if (index >= 0) this.queue.splice(index, 1);
        signal?.removeEventListener('abort', ticket.abort!);
        reject(abortedError());
      };
      signal?.addEventListener('abort', ticket.abort, { once: true });
      this.queue.push(ticket);
      this.grantNext();
    });
  }

  private grantNext(): void {
    if (this.active) return;
    const ticket = this.queue.shift();
    if (!ticket) return;
    ticket.signal?.removeEventListener('abort', ticket.abort!);
    if (ticket.signal?.aborted) {
      ticket.reject(abortedError());
      this.grantNext();
      return;
    }
    this.active = true;
    let released = false;
    ticket.resolve(() => {
      if (released) return;
      released = true;
      this.active = false;
      this.grantNext();
    });
  }

  private run(
    sections: Array<{ text: string }>,
    language: 'en' | 'es',
    signal?: AbortSignal,
  ): Promise<Buffer> {
    const installDir = resolve(
      process.env.XDG_DATA_HOME || resolve(homedir(), '.local/share'),
      'memsystems/kokoro',
    );
    const python =
      process.env.KOKORO_PYTHON || resolve(installDir, 'venv/bin/python');
    const model =
      process.env.KOKORO_MODEL_PATH ||
      resolve(installDir, 'models/kokoro-v1.0.onnx');
    const voices =
      process.env.KOKORO_VOICES_PATH ||
      resolve(installDir, 'models/voices-v1.0.bin');
    const workerCandidates = [
      process.env.KOKORO_WORKER_PATH,
      resolve(process.cwd(), 'scripts/kokoro_synthesize.py'),
      resolve(process.cwd(), '../scripts/kokoro_synthesize.py'),
    ].filter((path): path is string => Boolean(path));
    const worker = workerCandidates.find(existsSync) ?? workerCandidates[0];
    if (!python || !model || !voices) {
      return Promise.reject(
        new KokoroSpeechError(
          'Kokoro is not configured. Set KOKORO_PYTHON, KOKORO_MODEL_PATH, and KOKORO_VOICES_PATH; see docs/kokoro-setup.md.',
        ),
      );
    }
    if (
      !worker ||
      !existsSync(worker) ||
      !existsSync(model) ||
      !existsSync(voices)
    ) {
      return Promise.reject(
        new KokoroSpeechError(
          'Kokoro runtime or model files are missing. Run scripts/setup-kokoro.sh and set the paths in backend/.env.local; see docs/kokoro-setup.md.',
        ),
      );
    }
    try {
      if (!statSync(model).isFile() || !statSync(voices).isFile())
        throw new Error();
    } catch {
      return Promise.reject(
        new KokoroSpeechError(
          'KOKORO_MODEL_PATH and KOKORO_VOICES_PATH must point to readable files.',
        ),
      );
    }

    return new Promise((resolveAudio, reject) => {
      const child = spawn(
        python,
        [worker, '--model', model, '--voices', voices],
        {
          shell: false,
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        },
      );
      const chunks: Buffer[] = [];
      let byteCount = 0;
      let diagnostics = '';
      let settled = false;
      let timedOut = false;
      let processError: Error | undefined;
      let forceKill: NodeJS.Timeout | undefined;
      const stopChild = (error: Error) => {
        processError ??= error;
        child.kill('SIGTERM');
        forceKill ??= setTimeout(() => child.kill('SIGKILL'), 1_000);
        forceKill.unref();
      };
      const finishError = (error: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        reject(error);
      };
      const abort = () => {
        stopChild(abortedError());
      };
      const timer = setTimeout(() => {
        timedOut = true;
        stopChild(
          new KokoroSpeechError(
            'Kokoro synthesis timed out after 15 minutes. Try a shorter script or check the local runtime.',
          ),
        );
      }, TIMEOUT_MS);
      timer.unref();
      signal?.addEventListener('abort', abort, { once: true });
      child.stdout.on('data', (chunk: Buffer) => {
        byteCount += chunk.length;
        if (byteCount > MAX_WAV_BYTES) {
          stopChild(
            new KokoroSpeechError(
              'Kokoro produced an oversized WAV file (maximum 40 MiB).',
            ),
          );
        } else chunks.push(chunk);
      });
      // Child diagnostics can contain local paths; keep them out of application errors and logs.
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk: string) => {
        if (diagnostics.length < 256) diagnostics += chunk.slice(0, 256);
      });
      child.on('error', () => {
        finishError(
          new KokoroSpeechError(
            'Could not start the configured Kokoro Python runtime. Check KOKORO_PYTHON and docs/kokoro-setup.md.',
          ),
        );
      });
      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (forceKill) clearTimeout(forceKill);
        signal?.removeEventListener('abort', abort);
        if (processError) return reject(processError);
        if (timedOut || signal?.aborted) return reject(abortedError());
        if (code !== 0) return reject(workerError(diagnostics));
        const wav = Buffer.concat(chunks, byteCount);
        const duration = wavDurationSeconds(wav);
        if (duration === null || duration <= 0)
          return reject(
            new KokoroSpeechError(
              'Kokoro returned an invalid or empty WAV file.',
            ),
          );
        if (duration > MAX_AUDIO_SECONDS)
          return reject(
            new KokoroSpeechError('Kokoro audio exceeds the 13-minute limit.'),
          );
        resolveAudio(wav);
      });
      child.stdin.on('error', () => undefined);
      child.stdin.end(JSON.stringify({ sections, language }));
    });
  }
}

function workerError(diagnostics: string): KokoroSpeechError {
  const category = diagnostics.trim().split(/\s/, 1)[0];
  const messages: Record<string, string> = {
    MISSING_ARTIFACT:
      'Kokoro model or voice file is missing. Check KOKORO_MODEL_PATH and KOKORO_VOICES_PATH.',
    INVALID_TEXT:
      'Kokoro rejected the section text. Check that each section is non-empty and within the configured text limit.',
    UNSUPPORTED_LANGUAGE:
      'Kokoro speech supports only English (en) and Spanish (es).',
    INVALID_DURATION:
      'Kokoro audio must be longer than zero and no longer than 13 minutes.',
    AUDIO_TOO_LARGE: 'Kokoro produced an oversized WAV file (maximum 40 MiB).',
    SYNTHESIS_FAILED:
      'Kokoro synthesis failed. Check that kokoro-onnx 0.6.1 and both configured model files are valid.',
  };
  return new KokoroSpeechError(
    messages[category] ??
      'Kokoro synthesis failed. Check that kokoro-onnx 0.6.1 and both configured model files are valid.',
  );
}

function abortedError(): Error {
  const error = new Error('Kokoro synthesis was cancelled.');
  error.name = 'AbortError';
  return error;
}

function wavDurationSeconds(wav: Buffer): number | null {
  if (
    wav.length < 44 ||
    wav.readUInt32LE(4) + 8 !== wav.length ||
    wav.toString('ascii', 0, 4) !== 'RIFF' ||
    wav.toString('ascii', 8, 12) !== 'WAVE'
  )
    return null;
  let offset = 12;
  let byteRate = 0;
  let dataSize = 0;
  while (offset + 8 <= wav.length) {
    const id = wav.toString('ascii', offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    if (size > wav.length - offset - 8) return null;
    if (id === 'fmt ' && size >= 16)
      byteRate = wav.readUInt32LE(offset + 8 + 8);
    if (id === 'data') dataSize = size;
    offset += 8 + size + (size & 1);
  }
  return byteRate > 0 && dataSize > 0 ? dataSize / byteRate : null;
}
