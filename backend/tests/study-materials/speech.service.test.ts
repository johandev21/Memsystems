import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createGateway, generateSpeech, speechModel } = vi.hoisted(() => ({
  createGateway: vi.fn(),
  generateSpeech: vi.fn(),
  speechModel: vi.fn(),
}));

vi.mock('@ai-sdk/gateway', () => ({ createGateway }));
vi.mock('ai', () => ({ experimental_generateSpeech: generateSpeech }));

import { SpeechService } from '../../src/modules/study-materials/audio/speech.service';

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

describe('SpeechService', () => {
  const env = process.env;
  let kokoro: { synthesizeSections: ReturnType<typeof vi.fn> };
  let service: SpeechService;

  afterEach(() => {
    process.env = env;
  });

  beforeEach(() => {
    process.env = { ...env, AI_GATEWAY_API_KEY: 'test-key' };
    delete process.env.AUDIO_SPEECH_PROVIDER;
    delete process.env.VOXTRAL_HOST_VOICE;
    delete process.env.VOXTRAL_GUEST_VOICE;
    createGateway.mockReset().mockReturnValue({ speechModel });
    speechModel.mockReset();
    generateSpeech
      .mockReset()
      .mockResolvedValue({ audio: { uint8Array: pcmWav() } });
    kokoro = {
      synthesizeSections: vi.fn().mockResolvedValue(Buffer.from('local wav')),
    };
    service = new SpeechService(kokoro as never);
  });

  it('routes each dialogue turn to its stable speaker voice', async () => {
    await service.synthesizeSections(
      [
        {
          text: '',
          turns: [
            { speaker: 'host', text: 'Welcome.' },
            { speaker: 'guest', text: 'Hello.' },
          ],
        },
      ],
      'en',
    );
    expect(createGateway).toHaveBeenCalledWith({ apiKey: 'test-key' });
    expect(speechModel).toHaveBeenCalledWith('mistral/voxtral-mini-tts-3');
    expect(generateSpeech.mock.calls.map(([request]) => request.voice)).toEqual(
      ['voice_478', 'voice_485'],
    );
    expect(
      generateSpeech.mock.calls.every(
        ([request]) =>
          request.maxRetries === 0 && request.outputFormat === 'wav',
      ),
    ).toBe(true);
    expect(kokoro.synthesizeSections).not.toHaveBeenCalled();
  });

  it('uses configured voices and falls back once with all turns after a cloud error', async () => {
    process.env.VOXTRAL_HOST_VOICE = 'voice_447';
    process.env.VOXTRAL_GUEST_VOICE = 'voice_3150';
    generateSpeech.mockRejectedValueOnce(new Error('provider unavailable'));
    const result = await service.synthesizeSections(
      [
        {
          text: '',
          turns: [
            { speaker: 'host', text: 'Host text.' },
            { speaker: 'guest', text: 'Guest text.' },
          ],
        },
      ],
      'en',
    );
    expect(generateSpeech).toHaveBeenCalledTimes(1);
    expect(generateSpeech.mock.calls[0][0].voice).toBe('voice_447');
    expect(kokoro.synthesizeSections).toHaveBeenCalledWith(
      [
        {
          text: 'Host text.\n\nGuest text.',
          turns: [
            { speaker: 'host', text: 'Host text.' },
            { speaker: 'guest', text: 'Guest text.' },
          ],
        },
      ],
      'en',
      undefined,
    );
    expect(result.toString()).toBe('local wav');
  });

  it('does not call either provider when already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      service.synthesizeSections([{ text: 'Hello.' }], 'en', controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(generateSpeech).not.toHaveBeenCalled();
    expect(kokoro.synthesizeSections).not.toHaveBeenCalled();
  });

  it('does not fall back when cancellation interrupts a cloud request', async () => {
    const controller = new AbortController();
    generateSpeech.mockImplementationOnce(async () => {
      controller.abort();
      const error = new Error('cancelled');
      error.name = 'AbortError';
      throw error;
    });
    await expect(
      service.synthesizeSections([{ text: 'Hello.' }], 'en', controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(kokoro.synthesizeSections).not.toHaveBeenCalled();
  });

  it('supports explicit local mode and preserves dialogue turns', async () => {
    process.env.AUDIO_SPEECH_PROVIDER = 'kokoro';
    await service.synthesizeSections([{ text: 'Legacy narration.' }], 'en');
    expect(kokoro.synthesizeSections).toHaveBeenCalledWith(
      [
        {
          text: 'Legacy narration.',
          turns: [{ speaker: 'host', text: 'Legacy narration.' }],
        },
      ],
      'en',
      undefined,
    );
    kokoro.synthesizeSections.mockClear();
    await service.synthesizeSections(
      [
        {
          text: '',
          turns: [
            { speaker: 'host', text: 'Host.' },
            { speaker: 'guest', text: 'Guest.' },
          ],
        },
      ],
      'es-CL',
    );
    expect(kokoro.synthesizeSections).toHaveBeenCalledWith(
      [
        {
          text: 'Host.\n\nGuest.',
          turns: [
            { speaker: 'host', text: 'Host.' },
            { speaker: 'guest', text: 'Guest.' },
          ],
        },
      ],
      'es',
      undefined,
    );
    expect(generateSpeech).not.toHaveBeenCalled();
  });

  it('uses the Spanish preset for both roles temporarily', async () => {
    await service.synthesizeSections(
      [
        {
          text: '',
          turns: [
            { speaker: 'host', text: 'Una pregunta.' },
            { speaker: 'guest', text: 'Una respuesta.' },
          ],
        },
      ],
      'es-CL',
    );
    expect(generateSpeech.mock.calls.map(([request]) => request.voice)).toEqual(
      ['voice_483', 'voice_483'],
    );
    expect(kokoro.synthesizeSections).not.toHaveBeenCalled();
  });

  it('restarts the complete script locally after a later turn fails', async () => {
    generateSpeech
      .mockResolvedValueOnce({ audio: { uint8Array: pcmWav() } })
      .mockRejectedValueOnce(new Error('unavailable'));
    await service.synthesizeSections(
      [
        {
          text: '',
          turns: [
            { speaker: 'host', text: 'First.' },
            { speaker: 'guest', text: 'Second.' },
          ],
        },
      ],
      'en',
    );
    expect(generateSpeech).toHaveBeenCalledTimes(2);
    expect(kokoro.synthesizeSections).toHaveBeenCalledExactlyOnceWith(
      [
        {
          text: 'First.\n\nSecond.',
          turns: [
            { speaker: 'host', text: 'First.' },
            { speaker: 'guest', text: 'Second.' },
          ],
        },
      ],
      'en',
      undefined,
    );
  });

  it('falls back after a provider abort without caller cancellation', async () => {
    generateSpeech.mockRejectedValueOnce(
      Object.assign(new Error('provider aborted'), { name: 'AbortError' }),
    );
    await service.synthesizeSections([{ text: 'Hello.' }], 'en');
    expect(kokoro.synthesizeSections).toHaveBeenCalledOnce();
  });

  it('uses local synthesis when no gateway key is configured', async () => {
    delete process.env.AI_GATEWAY_API_KEY;
    await service.synthesizeSections([{ text: 'Hello.' }], 'en');
    expect(generateSpeech).not.toHaveBeenCalled();
    expect(kokoro.synthesizeSections).toHaveBeenCalledOnce();
  });
});
