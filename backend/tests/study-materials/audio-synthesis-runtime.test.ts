import { describe, expect, it } from 'vitest';
import {
  KokoroSpeechError,
  KokoroSpeechService,
} from '../../src/modules/study-materials/audio/kokoro-speech.service';

describe('KokoroSpeechService', () => {
  const service = new KokoroSpeechService();

  it('accepts a long script split into bounded sections before runtime lookup', async () => {
    const sections = Array.from({ length: 10 }, () => ({
      text: 'x'.repeat(1_200),
    }));
    const paths = [
      'KOKORO_WORKER_PATH',
      'KOKORO_MODEL_PATH',
      'KOKORO_VOICES_PATH',
    ] as const;
    const previous = paths.map((path) => process.env[path]);
    paths.forEach((path) => {
      process.env[path] = '/nonexistent/kokoro-runtime-file';
    });
    try {
      await expect(service.synthesizeSections(sections, 'en')).rejects.toThrow(
        'Kokoro runtime or model files are missing',
      );
    } finally {
      paths.forEach((path, index) => {
        if (previous[index] === undefined) delete process.env[path];
        else process.env[path] = previous[index];
      });
    }
  });

  it('rejects sections outside the configured text and section bounds', async () => {
    await expect(
      service.synthesizeSections([{ text: 'x'.repeat(4_001) }], 'en'),
    ).rejects.toBeInstanceOf(KokoroSpeechError);
    await expect(
      service.synthesizeSections(
        Array.from({ length: 11 }, () => ({ text: 'x'.repeat(3_000) })),
        'en',
      ),
    ).rejects.toThrow('30000 characters total');
  });

  it('keeps the existing single-text API and rejects cancellation before startup', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      service.synthesize('short script', 'en', controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
