import { describe, expect, it } from 'vitest';
import { assemblePcm16Wav } from '../../src/modules/study-materials/audio/audio-wav';
import { readAudioTimeline } from '../../src/modules/study-materials/audio/audio-timeline';

function pcmWav(samples: number[], sampleRate = 24_000): Buffer {
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, index) => wav.writeInt16LE(sample, 44 + index * 2));
  return wav;
}

describe('assemblePcm16Wav', () => {
  it('joins turns per section and writes one cue marker per section', () => {
    const wav = assemblePcm16Wav([
      [pcmWav([100, 200]), pcmWav([300])],
      pcmWav([-100, -200]),
    ]);
    const timeline = readAudioTimeline(wav);
    expect(timeline.sections).toHaveLength(2);
    expect(timeline.sections[0].start).toBe(0);
    expect(timeline.sections[0].end).toBeCloseTo(3 / 24_000);
    expect(timeline.sections[1].start).toBeCloseTo(3 / 24_000);
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
    expect(wav.readUInt16LE(20)).toBe(1);
    expect(wav.readUInt16LE(34)).toBe(16);
  });

  it('resamples input audio into normalized mono 24 kHz PCM16', () => {
    const wav = assemblePcm16Wav([pcmWav([1, 2, 3, 4], 48_000)]);
    expect(wav.readUInt32LE(24)).toBe(24_000);
    expect(wav.readUInt16LE(22)).toBe(1);
    expect(wav.readUInt16LE(34)).toBe(16);
    expect(readAudioTimeline(wav).duration).toBeCloseTo(2 / 24_000);
  });

  it('rejects non-PCM16 WAV input', () => {
    const wav = pcmWav([1]);
    wav.writeUInt16LE(3, 20);
    expect(() => assemblePcm16Wav([wav])).toThrow(/PCM16/);
  });
});
