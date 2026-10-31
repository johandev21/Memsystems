import { describe, expect, it } from 'vitest';
import { audioByteRange } from '../../src/modules/study-materials/audio/audio-byte-range';
describe('Audio Overview byte ranges', () => {
  it('supports closed, open-ended and suffix seeks', () => {
    expect(audioByteRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19 });
    expect(audioByteRange('bytes=10-', 100)).toEqual({ start: 10, end: 99 });
    expect(audioByteRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
    expect(audioByteRange('bytes=10-999', 100)).toEqual({ start: 10, end: 99 });
  });
  it('rejects impossible ranges while ignoring unsupported range syntax', () => {
    for (const value of ['bytes=100-', 'bytes=30-20', 'bytes=-0'])
      expect(audioByteRange(value, 100)).toBe('unsatisfiable');
    expect(audioByteRange(undefined, 100)).toBeNull();
    expect(audioByteRange('bytes=0-9,20-29', 100)).toBeNull();
    expect(audioByteRange('other=0-9', 100)).toBeNull();
  });
});
