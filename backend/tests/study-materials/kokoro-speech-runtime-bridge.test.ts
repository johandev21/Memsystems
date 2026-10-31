import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { spawn } = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn }));
vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => true),
  statSync: vi.fn(() => ({ isFile: () => true })),
}));

import { KokoroSpeechService } from '../../src/modules/study-materials/audio/kokoro-speech.service';

function pcmWav(): Buffer {
  const wav = Buffer.alloc(46);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(38, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(24_000, 24);
  wav.writeUInt32LE(48_000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(2, 40);
  wav.writeInt16LE(100, 44);
  return wav;
}

describe('Kokoro speech runtime bridge', () => {
  const env = process.env;
  let service: KokoroSpeechService;
  let payload: string | undefined;

  beforeEach(() => {
    process.env = {
      ...env,
      KOKORO_PYTHON: '/runtime/python',
      KOKORO_WORKER_PATH: '/runtime/worker.py',
      KOKORO_MODEL_PATH: '/runtime/model.onnx',
      KOKORO_VOICES_PATH: '/runtime/voices.bin',
    };
    service = new KokoroSpeechService();
    payload = undefined;
    spawn.mockReset().mockImplementation(() => {
      const child = new EventEmitter() as EventEmitter & {
        stdin: EventEmitter & { end: (value: string) => void };
        stdout: EventEmitter;
        stderr: EventEmitter & { setEncoding: (encoding: string) => void };
        kill: () => void;
      };
      child.stdin = Object.assign(new EventEmitter(), {
        end: (value: string) => {
          payload = value;
          queueMicrotask(() => {
            child.stdout.emit('data', pcmWav());
            child.emit('close', 0);
          });
        },
      });
      child.stdout = new EventEmitter();
      child.stderr = Object.assign(new EventEmitter(), {
        setEncoding: () => undefined,
      });
      child.kill = () => undefined;
      return child;
    });
  });

  afterEach(() => {
    process.env = env;
  });

  it('sends canonical text and speaker turns to the worker', async () => {
    const synthesis = service.synthesizeSections(
      [
        {
          text: 'This stale field is ignored.',
          turns: [
            { speaker: 'host', text: 'Hola.' },
            { speaker: 'guest', text: 'Buenos días.' },
          ],
        },
      ],
      'es-CL',
    );
    // The worker receives JSON over stdin; capture it from the fake child.
    await synthesis;
    expect(spawn).toHaveBeenCalledOnce();
    expect(JSON.parse(payload!)).toEqual({
      sections: [
        {
          text: 'Hola.\n\nBuenos días.',
          turns: [
            { speaker: 'host', text: 'Hola.' },
            { speaker: 'guest', text: 'Buenos días.' },
          ],
        },
      ],
      language: 'es',
    });
  });

  it('rejects invalid speakers and oversized dialogue before spawning', async () => {
    await expect(
      service.synthesizeSections(
        [{ text: '', turns: [{ speaker: 'narrator' as never, text: 'Hi.' }] }],
        'en',
      ),
    ).rejects.toThrow('host or guest speaker');
    await expect(
      service.synthesizeSections(
        [
          {
            text: '',
            turns: [
              { speaker: 'host', text: 'x'.repeat(2_000) },
              { speaker: 'guest', text: 'y'.repeat(2_000) },
            ],
          },
        ],
        'en',
      ),
    ).rejects.toThrow('4000 characters');
    expect(spawn).not.toHaveBeenCalled();
  });
});
