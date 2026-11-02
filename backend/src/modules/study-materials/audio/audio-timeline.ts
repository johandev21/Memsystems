export interface AudioTimeline {
  duration: number;
  waveform: number[];
  sections: Array<{ start: number; end: number }>;
}

export function readAudioTimeline(wav: Buffer): AudioTimeline {
  const empty: AudioTimeline = { duration: 0, waveform: [], sections: [] };
  if (
    wav.length < 44 ||
    wav.length > 40 * 1024 * 1024 ||
    wav.toString('ascii', 0, 4) !== 'RIFF' ||
    wav.toString('ascii', 8, 12) !== 'WAVE' ||
    wav.readUInt32LE(4) + 8 !== wav.length
  )
    return empty;
  let sampleRate = 0,
    channels = 0,
    bits = 0,
    format = 0;
  let data: Buffer | undefined;
  let offsets: number[] = [];
  for (let offset = 12; offset + 8 <= wav.length;) {
    const id = wav.toString('ascii', offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (size > wav.length - start) return empty;
    if (id === 'fmt ' && size >= 16) {
      format = wav.readUInt16LE(start);
      channels = wav.readUInt16LE(start + 2);
      sampleRate = wav.readUInt32LE(start + 4);
      bits = wav.readUInt16LE(start + 14);
    }
    if (id === 'data') data = wav.subarray(start, start + size);
    if (id === 'cue ' && size >= 4) {
      const count = wav.readUInt32LE(start);
      if (count > 0 && count <= 40 && size === 4 + count * 24) {
        const candidates: number[] = [];
        for (let i = 0; i < count; i++) {
          const cue = start + 4 + i * 24;
          if (
            wav.toString('ascii', cue + 8, cue + 12) !== 'data' ||
            wav.readUInt32LE(cue + 12) !== 0 ||
            wav.readUInt32LE(cue + 16) !== 0
          )
            break;
          candidates.push(wav.readUInt32LE(cue + 20));
        }
        if (candidates.length === count) offsets = candidates;
      }
    }
    offset = start + size + (size & 1);
  }
  if (
    format !== 1 ||
    bits !== 16 ||
    channels < 1 ||
    channels > 8 ||
    sampleRate < 8000 ||
    sampleRate > 192000 ||
    !data ||
    data.length % (channels * 2)
  )
    return empty;
  const frames = data.length / (channels * 2);
  const duration = frames / sampleRate;
  if (duration <= 0 || duration > 780) return empty;
  const waveform = Array<number>(160).fill(0);
  for (let frame = 0; frame < frames; frame++) {
    const bin = Math.min(159, Math.floor((frame * 160) / frames));
    for (let channel = 0; channel < channels; channel++) {
      waveform[bin] = Math.max(
        waveform[bin],
        Math.abs(data.readInt16LE((frame * channels + channel) * 2)) / 32768,
      );
    }
  }
  const validOffsets =
    offsets[0] === 0 &&
    offsets.every(
      (value, index) =>
        value < frames && (index === 0 || value > offsets[index - 1]),
    );
  const sections = validOffsets
    ? offsets.map((start, index) => ({
        start: start / sampleRate,
        end: (offsets[index + 1] ?? frames) / sampleRate,
      }))
    : [];
  return { duration, waveform, sections };
}
