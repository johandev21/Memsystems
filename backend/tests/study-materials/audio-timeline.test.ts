import { describe, expect, it } from 'vitest';
import { readAudioTimeline } from '../../src/modules/study-materials/audio/audio-timeline';

function fixture(starts?: number[]) {
  const frames = 16000;
  const wav = Buffer.alloc(44 + frames * 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(frames * 2, 40);
  for (let i = 0; i < frames; i++)
    wav.writeInt16LE(i < 8000 ? 16384 : -32768, 44 + i * 2);
  if (!starts) return wav;
  const cue = Buffer.alloc(12 + starts.length * 24);
  cue.write('cue ', 0);
  cue.writeUInt32LE(cue.length - 8, 4);
  cue.writeUInt32LE(starts.length, 8);
  starts.forEach((start, index) => {
    const offset = 12 + index * 24;
    cue.writeUInt32LE(index, offset);
    cue.write('data', offset + 8);
    cue.writeUInt32LE(start, offset + 20);
  });
  const result = Buffer.concat([wav, cue]);
  result.writeUInt32LE(result.length - 8, 4);
  return result;
}

describe('measured Audio Overview timeline', () => {
  it('extracts real PCM amplitudes and sample-accurate section boundaries', () => {
    const result = readAudioTimeline(fixture([0, 6001]));
    expect(result.duration).toBe(2);
    expect(result.waveform).toHaveLength(160);
    expect(result.waveform[0]).toBe(0.5);
    expect(result.waveform[159]).toBe(1);
    expect(result.sections).toEqual([
      { start: 0, end: 6001 / 8000 },
      { start: 6001 / 8000, end: 2 },
    ]);
  });
  it('provides waveform data for legacy audio without guessing section alignment', () => {
    expect(readAudioTimeline(fixture()).sections).toEqual([]);
    expect(readAudioTimeline(fixture()).waveform).toHaveLength(160);
  });
  it('rejects malformed chunks and discards invalid cue order', () => {
    const malformed = fixture();
    malformed.writeUInt32LE(0xffffffff, 40);
    expect(readAudioTimeline(malformed)).toEqual({
      duration: 0,
      waveform: [],
      sections: [],
    });
    expect(readAudioTimeline(fixture([100, 8000])).sections).toEqual([]);
    expect(readAudioTimeline(fixture([0, 8000, 4000])).sections).toEqual([]);
    expect(readAudioTimeline(Buffer.from('invalid')).waveform).toEqual([]);
  });
});
