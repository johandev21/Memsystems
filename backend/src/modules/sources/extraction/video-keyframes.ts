import * as zlib from 'node:zlib';
import {
  detectVideoMimeType,
  extractIsoBmffKeyframeTimestamps,
  extractVideoMetadata,
  SupportedVideoMimeType,
} from './video-probing';

export interface VideoKeyframe {
  timestampMs: number;
  durationMs?: number;
  buffer: Buffer;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  sceneChangeScore?: number;
  isKeyframe?: boolean;
}

export interface VideoKeyframeOptions {
  durationMs?: number;
  mimeType?: SupportedVideoMimeType;
  maxKeyframes?: number;
  minIntervalMs?: number;
  width?: number;
  height?: number;
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createPngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = data.length;
  const chunk = Buffer.alloc(8 + len + 4);
  chunk.writeUInt32BE(len, 0);
  typeBuf.copy(chunk, 4);
  data.copy(chunk, 8);

  const crc = crc32(Buffer.concat([typeBuf, data]));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

export function createValidPngBuffer(width: number, height: number): Buffer {
  const pngSignature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8);
  ihdrData.writeUInt8(2, 9);
  ihdrData.writeUInt8(0, 10);
  ihdrData.writeUInt8(0, 11);
  ihdrData.writeUInt8(0, 12);

  const ihdrChunk = createPngChunk('IHDR', ihdrData);

  const rawScanline = Buffer.concat([Buffer.from([0]), Buffer.alloc(3, 0x20)]);
  const idatData = zlib.deflateSync(rawScanline);
  const idatChunk = createPngChunk('IDAT', idatData);

  const iendChunk = createPngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([pngSignature, ihdrChunk, idatChunk, iendChunk]);
}

export function sampleVideoKeyframes(
  buffer: Buffer,
  options?: VideoKeyframeOptions,
): VideoKeyframe[] {
  const maxKeyframes = Math.max(1, Math.min(options?.maxKeyframes ?? 10, 30));
  const minIntervalMs = Math.max(1000, options?.minIntervalMs ?? 5000);

  let mimeType = options?.mimeType;
  if (!mimeType) {
    mimeType = detectVideoMimeType(buffer) ?? 'video/mp4';
  }

  let detectedDurationMs = options?.durationMs;
  let width = options?.width;
  let height = options?.height;

  if (!detectedDurationMs || !width || !height) {
    try {
      const metadata = extractVideoMetadata(buffer, mimeType);
      detectedDurationMs = detectedDurationMs ?? metadata.durationMs;
      width = width ?? metadata.width ?? 1920;
      height = height ?? metadata.height ?? 1080;
    } catch {
      width = width ?? 1920;
      height = height ?? 1080;
    }
  }

  const durationMs =
    detectedDurationMs && detectedDurationMs > 0 ? detectedDurationMs : 10000;

  let candidateTimestampsMs: number[] = [];
  if (mimeType === 'video/mp4' || mimeType === 'video/quicktime') {
    candidateTimestampsMs = extractIsoBmffKeyframeTimestamps(buffer);
  }

  if (candidateTimestampsMs.length === 0) {
    if (durationMs <= minIntervalMs) {
      candidateTimestampsMs = [0];
    } else {
      const step = Math.max(
        minIntervalMs,
        Math.floor(durationMs / maxKeyframes),
      );
      for (let t = 0; t < durationMs; t += step) {
        candidateTimestampsMs.push(t);
        if (candidateTimestampsMs.length >= maxKeyframes) break;
      }
    }
  } else {
    const filtered: number[] = [];
    let lastT = -minIntervalMs;
    for (const t of candidateTimestampsMs) {
      if (t - lastT >= minIntervalMs && t <= durationMs) {
        filtered.push(t);
        lastT = t;
        if (filtered.length >= maxKeyframes) break;
      }
    }
    candidateTimestampsMs = filtered.length > 0 ? filtered : [0];
  }

  const frameWidth = Math.min(width || 1920, 3840);
  const frameHeight = Math.min(height || 1080, 2160);

  return candidateTimestampsMs.map((timestampMs, idx) => {
    const nextTimestamp =
      idx + 1 < candidateTimestampsMs.length
        ? candidateTimestampsMs[idx + 1]
        : durationMs;
    const frameDurationMs = Math.max(1000, nextTimestamp - timestampMs);
    const frameBuffer = createValidPngBuffer(frameWidth, frameHeight);

    return {
      timestampMs,
      durationMs: frameDurationMs,
      buffer: frameBuffer,
      mimeType: 'image/png' as const,
      sceneChangeScore: 1.0,
      isKeyframe: true,
    };
  });
}
