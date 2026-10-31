const MAX_WAV_BYTES = 40 * 1024 * 1024;
const MAX_AUDIO_SECONDS = 780;
const OUTPUT_SAMPLE_RATE = 24_000;

interface PcmWav {
  samples: Int16Array;
  sampleRate: number;
  channels: number;
}

export function assemblePcm16Wav(sections: Array<Buffer | Buffer[]>): Buffer {
  if (sections.length === 0 || sections.length > 40)
    throw new Error('Speech must contain 1–40 sections.');
  const clips = sections.map((section) =>
    Array.isArray(section) ? section : [section],
  );
  if (
    clips.some(
      (section) =>
        section.length === 0 || section.some((clip) => !Buffer.isBuffer(clip)),
    ) ||
    clips.flat().reduce((sum, clip) => sum + clip.length, 0) > MAX_WAV_BYTES
  )
    throw new Error(
      'Speech provider returned oversized audio (maximum 40 MiB total).',
    );
  const sectionSamples = clips.map((section) => {
    const samples = section.map((clip) => resampleToMono(readPcm16Wav(clip)));
    const combined = new Int16Array(
      samples.reduce((sum, part) => sum + part.length, 0),
    );
    let offset = 0;
    for (const part of samples) {
      combined.set(part, offset);
      offset += part.length;
    }
    return combined;
  });
  const offsets: number[] = [];
  let frames = 0;
  for (const samples of sectionSamples) {
    offsets.push(frames);
    frames += samples.length;
  }
  if (frames === 0 || frames / OUTPUT_SAMPLE_RATE > MAX_AUDIO_SECONDS)
    throw new Error(
      'Speech must be longer than zero and no longer than 13 minutes.',
    );

  const cueSize = 4 + offsets.length * 24;
  const dataSize = frames * 2;
  const wavSize = 12 + 24 + 8 + cueSize + 8 + dataSize;
  if (wavSize > MAX_WAV_BYTES)
    throw new Error('Speech produced an oversized WAV file (maximum 40 MiB).');
  const wav = Buffer.alloc(wavSize);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(OUTPUT_SAMPLE_RATE, 24);
  wav.writeUInt32LE(OUTPUT_SAMPLE_RATE * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('cue ', 36);
  wav.writeUInt32LE(cueSize, 40);
  wav.writeUInt32LE(offsets.length, 44);
  offsets.forEach((frame, index) => {
    const cue = 48 + index * 24;
    wav.writeUInt32LE(index + 1, cue);
    wav.writeUInt32LE(frame, cue + 4);
    wav.write('data', cue + 8);
    wav.writeUInt32LE(0, cue + 12);
    wav.writeUInt32LE(0, cue + 16);
    wav.writeUInt32LE(frame, cue + 20);
  });
  const dataHeader = 44 + cueSize;
  wav.write('data', dataHeader);
  wav.writeUInt32LE(dataSize, dataHeader + 4);
  let offset = dataHeader + 8;
  for (const samples of sectionSamples) {
    for (const sample of samples) {
      wav.writeInt16LE(sample, offset);
      offset += 2;
    }
  }
  return wav;
}

function readPcm16Wav(wav: Buffer): PcmWav {
  if (
    wav.length < 44 ||
    wav.length > MAX_WAV_BYTES ||
    wav.toString('ascii', 0, 4) !== 'RIFF' ||
    wav.toString('ascii', 8, 12) !== 'WAVE' ||
    wav.readUInt32LE(4) + 8 !== wav.length
  )
    throw new Error('Speech provider returned an invalid WAV file.');
  let format = 0,
    channels = 0,
    sampleRate = 0,
    bits = 0;
  let data: Buffer | undefined;
  let offset = 12;
  while (offset + 8 <= wav.length) {
    const id = wav.toString('ascii', offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (size > wav.length - start)
      throw new Error('Speech provider returned a truncated WAV file.');
    if (id === 'fmt ' && size >= 16) {
      format = wav.readUInt16LE(start);
      channels = wav.readUInt16LE(start + 2);
      sampleRate = wav.readUInt32LE(start + 4);
      bits = wav.readUInt16LE(start + 14);
    }
    if (id === 'data') data = wav.subarray(start, start + size);
    offset = start + size + (size & 1);
  }
  if (offset !== wav.length)
    throw new Error('Speech provider returned a malformed WAV file.');
  if (
    format !== 1 ||
    bits !== 16 ||
    channels < 1 ||
    channels > 8 ||
    sampleRate < 8_000 ||
    sampleRate > 192_000 ||
    !data ||
    data.length === 0 ||
    data.length % (channels * 2) !== 0
  )
    throw new Error('Speech provider must return non-empty PCM16 WAV audio.');
  return {
    samples: Int16Array.from({ length: data.length / 2 }, (_, i) =>
      data.readInt16LE(i * 2),
    ),
    sampleRate,
    channels,
  };
}

function resampleToMono({ samples, sampleRate, channels }: PcmWav): Int16Array {
  const inputFrames = samples.length / channels;
  const outputFrames = Math.max(
    1,
    Math.round((inputFrames * OUTPUT_SAMPLE_RATE) / sampleRate),
  );
  const mono = new Float64Array(inputFrames);
  for (let frame = 0; frame < inputFrames; frame++) {
    let total = 0;
    for (let channel = 0; channel < channels; channel++)
      total += samples[frame * channels + channel];
    mono[frame] = total / channels;
  }
  const output = new Int16Array(outputFrames);
  for (let frame = 0; frame < outputFrames; frame++) {
    const position = (frame * sampleRate) / OUTPUT_SAMPLE_RATE;
    const left = Math.min(inputFrames - 1, Math.floor(position));
    const right = Math.min(inputFrames - 1, left + 1);
    const fraction = position - left;
    output[frame] = Math.max(
      -32768,
      Math.min(
        32767,
        Math.round(mono[left] * (1 - fraction) + mono[right] * fraction),
      ),
    );
  }
  return output;
}
