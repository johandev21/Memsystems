import { BadRequestError } from '../../../common/errors/domain-error';

export type SupportedAudioMimeType =
  | 'audio/mpeg'
  | 'audio/mp4'
  | 'audio/wav'
  | 'audio/webm'
  | 'audio/ogg'
  | 'audio/aac';

export interface AudioMetadata {
  durationMs?: number;
  channels?: number;
  sampleRate?: number;
}

export const MP3_ID3_MAGIC = Buffer.from([0x49, 0x44, 0x33]);
export const OGG_MAGIC = Buffer.from([0x4f, 0x67, 0x67, 0x53]);
export const WEBM_EBML_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);

export const MP3_V1_L3_BITRATES = [
  0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0,
];
export const MP3_V2_L3_BITRATES = [
  0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0,
];
export const MP3_SAMPLE_RATES = {
  v1: [44100, 48000, 32000, 0],
  v2: [22050, 24000, 16000, 0],
  v25: [11025, 12000, 8000, 0],
};

export const AAC_SAMPLE_RATES = [
  96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025,
  8000, 7350,
];

function readSyncsafe32(buf: Buffer, offset: number): number {
  return (
    ((buf[offset] & 0x7f) << 21) |
    ((buf[offset + 1] & 0x7f) << 14) |
    ((buf[offset + 2] & 0x7f) << 7) |
    (buf[offset + 3] & 0x7f)
  );
}

export function detectAudioMimeType(
  buffer: Buffer,
): SupportedAudioMimeType | null {
  if (buffer.length < 3) return null;
  if (buffer.subarray(0, 3).equals(MP3_ID3_MAGIC)) return 'audio/mpeg';

  if (buffer.length >= 4 && buffer[0] === 0xff) {
    if (
      (buffer[1] & 0xe0) === 0xe0 &&
      ((buffer[1] >> 3) & 3) !== 1 &&
      ((buffer[1] >> 1) & 3) !== 0
    ) {
      return ((buffer[1] >> 1) & 3) === 0 ? 'audio/aac' : 'audio/mpeg';
    }
    if ((buffer[1] & 0xf6) === 0xf0) return 'audio/aac';
  }

  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WAVE'
  ) {
    return 'audio/wav';
  }
  if (buffer.length >= 8 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    return 'audio/mp4';
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(WEBM_EBML_MAGIC)) {
    return 'audio/webm';
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(OGG_MAGIC)) {
    return 'audio/ogg';
  }
  return null;
}

export function extractWavMetadata(buffer: Buffer): AudioMetadata {
  if (buffer.length < 12) {
    throw new BadRequestError('Corrupted WAV header: buffer too small.');
  }

  let offset = 12;
  let channels: number | undefined;
  let sampleRate: number | undefined;
  let byteRate: number | undefined;
  let bitsPerSample: number | undefined;
  let dataSize: number | undefined;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataOffset = offset + 8;

    if (chunkId === 'fmt ' && chunkSize >= 16) {
      if (chunkDataOffset + 16 > buffer.length) {
        throw new BadRequestError('Corrupted WAV header: truncated fmt chunk.');
      }
      channels = buffer.readUInt16LE(chunkDataOffset + 2);
      sampleRate = buffer.readUInt32LE(chunkDataOffset + 4);
      byteRate = buffer.readUInt32LE(chunkDataOffset + 8);
      bitsPerSample = buffer.readUInt16LE(chunkDataOffset + 14);

      if (channels <= 0 || sampleRate <= 0) {
        throw new BadRequestError(
          'Invalid WAV fmt chunk: zero or negative channels/sampleRate.',
        );
      }
    } else if (chunkId === 'data') {
      dataSize = chunkSize;
    }
    offset += 8 + chunkSize + (chunkSize % 2 !== 0 ? 1 : 0);
  }

  if (!channels || !sampleRate) {
    throw new BadRequestError('Corrupted WAV header: missing fmt chunk.');
  }

  let durationMs: number | undefined;
  const actualDataSize = dataSize ?? buffer.length - 44;
  if (byteRate && byteRate > 0 && actualDataSize > 0) {
    durationMs = Math.round((actualDataSize / byteRate) * 1000);
  } else if (
    bitsPerSample &&
    bitsPerSample > 0 &&
    channels > 0 &&
    sampleRate > 0 &&
    actualDataSize > 0
  ) {
    durationMs = Math.round(
      (actualDataSize / (sampleRate * channels * (bitsPerSample / 8))) * 1000,
    );
  }

  return { durationMs, channels, sampleRate };
}

export function extractMp3Metadata(buffer: Buffer): AudioMetadata {
  let offset = 0;
  let tlenDurationMs: number | undefined;

  if (buffer.length >= 10 && buffer.subarray(0, 3).equals(MP3_ID3_MAGIC)) {
    const flags = buffer[5];
    const tagSize = readSyncsafe32(buffer, 6);
    const hasFooter = (flags & 0x10) !== 0;
    const totalId3Length = 10 + tagSize + (hasFooter ? 10 : 0);

    let frameOffset = 10;
    const id3Limit = Math.min(buffer.length, 10 + tagSize);
    while (frameOffset + 10 <= id3Limit) {
      const frameId = buffer.toString('ascii', frameOffset, frameOffset + 4);
      if (frameId.charCodeAt(0) === 0) break;

      const frameSize =
        buffer[3] === 4
          ? readSyncsafe32(buffer, frameOffset + 4)
          : buffer.readUInt32BE(frameOffset + 4);

      if (frameId === 'TLEN' && frameSize > 1) {
        const textPayload = buffer
          .toString(
            'ascii',
            frameOffset + 11,
            Math.min(id3Limit, frameOffset + 10 + frameSize),
          )
          .trim();
        const parsed = parseInt(textPayload, 10);
        if (!isNaN(parsed) && parsed > 0) tlenDurationMs = parsed;
      }
      frameOffset += 10 + frameSize;
    }
    offset = Math.min(buffer.length, totalId3Length);
  }

  let frameOffset = -1;
  for (let i = offset; i + 4 <= buffer.length; i++) {
    if (
      buffer[i] === 0xff &&
      (buffer[i + 1] & 0xe0) === 0xe0 &&
      ((buffer[i + 1] >> 3) & 3) !== 1 &&
      ((buffer[i + 1] >> 1) & 3) !== 0
    ) {
      frameOffset = i;
      break;
    }
  }

  if (frameOffset === -1) {
    return tlenDurationMs !== undefined ? { durationMs: tlenDurationMs } : {};
  }

  const b1 = buffer[frameOffset + 1];
  const b2 = buffer[frameOffset + 2];
  const b3 = buffer[frameOffset + 3];

  const versionBits = (b1 >> 3) & 3;
  const layerBits = (b1 >> 1) & 3;
  const bitrateIdx = (b2 >> 4) & 15;
  const sampleRateIdx = (b2 >> 2) & 3;
  const channelMode = (b3 >> 6) & 3;
  const channels = channelMode === 3 ? 1 : 2;

  let sampleRate: number | undefined;
  if (versionBits === 3) sampleRate = MP3_SAMPLE_RATES.v1[sampleRateIdx];
  else if (versionBits === 2) sampleRate = MP3_SAMPLE_RATES.v2[sampleRateIdx];
  else if (versionBits === 0) sampleRate = MP3_SAMPLE_RATES.v25[sampleRateIdx];

  const bitrateKbps =
    layerBits === 1
      ? versionBits === 3
        ? MP3_V1_L3_BITRATES[bitrateIdx]
        : MP3_V2_L3_BITRATES[bitrateIdx]
      : 0;

  let durationMs = tlenDurationMs;

  if (!durationMs && sampleRate && sampleRate > 0) {
    const xingOffset =
      frameOffset +
      (versionBits === 3
        ? channels === 1
          ? 21
          : 36
        : channels === 1
          ? 13
          : 21);

    if (
      xingOffset + 12 <= buffer.length &&
      (buffer.toString('ascii', xingOffset, xingOffset + 4) === 'Xing' ||
        buffer.toString('ascii', xingOffset, xingOffset + 4) === 'Info')
    ) {
      const flags = buffer.readUInt32BE(xingOffset + 4);
      if ((flags & 0x01) !== 0) {
        const frames = buffer.readUInt32BE(xingOffset + 8);
        const samplesPerFrame = versionBits === 3 ? 1152 : 576;
        durationMs = Math.round((frames * samplesPerFrame * 1000) / sampleRate);
      }
    }
  }

  if (!durationMs && bitrateKbps > 0) {
    const audioBytes = buffer.length - offset;
    durationMs = Math.round((audioBytes * 8 * 1000) / (bitrateKbps * 1000));
  }

  return { durationMs, channels, sampleRate };
}

export function extractMp4Metadata(buffer: Buffer): AudioMetadata {
  let offset = 0;
  let durationMs: number | undefined;
  let channels: number | undefined;
  let sampleRate: number | undefined;

  while (offset + 8 <= buffer.length) {
    let boxSize = buffer.readUInt32BE(offset);
    const boxType = buffer.toString('ascii', offset + 4, offset + 8);

    if (boxSize === 0) {
      boxSize = buffer.length - offset;
    } else if (boxSize === 1 && offset + 16 <= buffer.length) {
      boxSize = Number(buffer.readBigUInt64BE(offset + 8));
    }
    if (boxSize < 8) break;

    if (boxType === 'moov') {
      const moovEnd = Math.min(buffer.length, offset + boxSize);
      let moovOffset = offset + 8;

      while (moovOffset + 8 <= moovEnd) {
        const subSize = buffer.readUInt32BE(moovOffset);
        const subType = buffer.toString(
          'ascii',
          moovOffset + 4,
          moovOffset + 8,
        );
        if (subSize < 8 || moovOffset + subSize > moovEnd) break;

        if (subType === 'mvhd') {
          const version = buffer.readUInt8(moovOffset + 8);
          if (version === 0 && moovOffset + 24 <= moovEnd) {
            const timeScale = buffer.readUInt32BE(moovOffset + 20);
            const duration = buffer.readUInt32BE(moovOffset + 24);
            if (timeScale > 0) {
              durationMs = Math.round((duration / timeScale) * 1000);
            }
          } else if (version === 1 && moovOffset + 36 <= moovEnd) {
            const timeScale = buffer.readUInt32BE(moovOffset + 28);
            const duration = Number(buffer.readBigUInt64BE(moovOffset + 32));
            if (timeScale > 0) {
              durationMs = Math.round((duration / timeScale) * 1000);
            }
          }
        }

        if (subType === 'trak') {
          const trakData = buffer.subarray(moovOffset, moovOffset + subSize);
          const mp4aIdx = trakData.indexOf(Buffer.from('mp4a'));
          if (mp4aIdx !== -1 && mp4aIdx + 26 <= trakData.length) {
            channels = trakData.readUInt16BE(mp4aIdx + 20);
            sampleRate = trakData.readUInt16BE(mp4aIdx + 24);
          }
        }
        moovOffset += subSize;
      }
    }
    offset += boxSize;
  }

  return { durationMs, channels, sampleRate };
}

export function extractAacMetadata(buffer: Buffer): AudioMetadata {
  if (buffer.length < 7) return {};

  const b2 = buffer[2];
  const b3 = buffer[3];
  const b4 = buffer[4];
  const b5 = buffer[5];

  const sampleRateIdx = (b2 >> 2) & 0x0f;
  const sampleRate = AAC_SAMPLE_RATES[sampleRateIdx] || 44100;
  const channelConfig = ((b2 & 1) << 2) | ((b3 >> 6) & 3);
  const channels =
    channelConfig === 7 ? 8 : channelConfig === 0 ? 2 : channelConfig;
  const frameLength = ((b3 & 3) << 11) | (b4 << 3) | ((b5 >> 5) & 7);

  let durationMs: number | undefined;
  if (frameLength > 0 && sampleRate > 0) {
    const estimatedFrames = Math.floor(buffer.length / frameLength);
    durationMs = Math.round((estimatedFrames * 1024 * 1000) / sampleRate);
  }

  return { durationMs, channels, sampleRate };
}

export function extractWebmMetadata(buffer: Buffer): AudioMetadata {
  let durationMs: number | undefined;
  let channels: number | undefined;
  let sampleRate: number | undefined;
  let timecodeScaleNs = 1_000_000;

  const timecodeScaleIdx = buffer.indexOf(Buffer.from([0x2a, 0xd7, 0xb1]));
  if (timecodeScaleIdx !== -1 && timecodeScaleIdx + 7 <= buffer.length) {
    const valLen = buffer[timecodeScaleIdx + 3] & 0x7f;
    if (valLen === 4 && timecodeScaleIdx + 8 <= buffer.length) {
      timecodeScaleNs = buffer.readUInt32BE(timecodeScaleIdx + 4);
    }
  }

  const durationIdx = buffer.indexOf(Buffer.from([0x44, 0x89]));
  if (durationIdx !== -1 && durationIdx + 6 <= buffer.length) {
    const valLen = buffer[durationIdx + 2] & 0x7f;
    if (valLen === 4 && durationIdx + 7 <= buffer.length) {
      durationMs = Math.round(
        (buffer.readFloatBE(durationIdx + 3) * timecodeScaleNs) / 1_000_000,
      );
    } else if (valLen === 8 && durationIdx + 11 <= buffer.length) {
      durationMs = Math.round(
        (buffer.readDoubleBE(durationIdx + 3) * timecodeScaleNs) / 1_000_000,
      );
    }
  }

  const audioTrackIdx = buffer.indexOf(Buffer.from([0xe1]));
  if (audioTrackIdx !== -1) {
    const trackSlice = buffer.subarray(
      audioTrackIdx,
      Math.min(buffer.length, audioTrackIdx + 128),
    );
    const channelsIdx = trackSlice.indexOf(Buffer.from([0x9f]));
    if (channelsIdx !== -1 && channelsIdx + 2 <= trackSlice.length) {
      channels = trackSlice[channelsIdx + 2];
    }
    const freqIdx = trackSlice.indexOf(Buffer.from([0xb5]));
    if (freqIdx !== -1 && freqIdx + 6 <= trackSlice.length) {
      sampleRate = Math.round(trackSlice.readFloatBE(freqIdx + 2));
    }
  }

  return { durationMs, channels, sampleRate };
}

export function extractOggMetadata(buffer: Buffer): AudioMetadata {
  if (buffer.length < 27) return {};

  const segments = buffer[26];
  const packetOffset = 27 + segments;
  let channels: number | undefined;
  let sampleRate: number | undefined;
  let isOpus = false;

  if (
    packetOffset + 30 <= buffer.length &&
    buffer.subarray(packetOffset, packetOffset + 7).toString('ascii') ===
      '\x01vorbis'
  ) {
    channels = buffer.readUInt8(packetOffset + 11);
    sampleRate = buffer.readUInt32LE(packetOffset + 12);
  }

  if (
    packetOffset + 19 <= buffer.length &&
    buffer.subarray(packetOffset, packetOffset + 8).toString('ascii') ===
      'OpusHead'
  ) {
    isOpus = true;
    channels = buffer.readUInt8(packetOffset + 9);
    sampleRate = buffer.readUInt32LE(packetOffset + 12);
  }

  let durationMs: number | undefined;
  for (let i = buffer.length - 27; i >= 0; i--) {
    if (
      buffer[i] === 0x4f &&
      buffer[i + 1] === 0x67 &&
      buffer[i + 2] === 0x67 &&
      buffer[i + 3] === 0x53
    ) {
      const granulePos = buffer.readBigInt64LE(i + 6);
      if (granulePos > 0n) {
        const rate = isOpus ? 48000 : sampleRate || 44100;
        durationMs = Math.round((Number(granulePos) * 1000) / rate);
      }
      break;
    }
  }

  return { durationMs, channels, sampleRate };
}

const METADATA_PARSERS: Record<
  SupportedAudioMimeType,
  (buf: Buffer) => AudioMetadata
> = {
  'audio/wav': extractWavMetadata,
  'audio/mpeg': extractMp3Metadata,
  'audio/mp4': extractMp4Metadata,
  'audio/aac': extractAacMetadata,
  'audio/webm': extractWebmMetadata,
  'audio/ogg': extractOggMetadata,
};

export function extractAudioMetadata(
  buffer: Buffer,
  mimeType: SupportedAudioMimeType,
): AudioMetadata {
  try {
    const parser = METADATA_PARSERS[mimeType];
    return parser ? parser(buffer) : {};
  } catch (err) {
    if (err instanceof BadRequestError) {
      throw new BadRequestError(err.message, {
        messageKey: 'errors.sources.inspect.audioCorrupted',
      });
    }
    throw new BadRequestError(
      `Corrupted or invalid ${mimeType} audio header: ${err instanceof Error ? err.message : String(err)}`,
      { messageKey: 'errors.sources.inspect.audioCorrupted' },
    );
  }
}
