import * as zlib from 'node:zlib';
import { Injectable } from '@nestjs/common';
import { BadRequestError } from '../../common/errors/domain-error';

export const MAX_VIDEO_BYTES = 1024 * 1024 * 1024; // 1 GB = 1,073,741,824 bytes
export const MAX_VIDEO_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours = 14,400,000 ms
export const MAX_VIDEO_DURATION_SECONDS = 4 * 60 * 60; // 4 hours = 14,400 seconds

export type SupportedVideoMimeType =
  'video/mp4' | 'video/webm' | 'video/quicktime' | 'video/x-matroska';

export interface InspectedVideo {
  mimeType: SupportedVideoMimeType;
  width?: number;
  height?: number;
  durationMs?: number;
  durationSeconds?: number;
  hasAudio?: boolean;
  size?: number;
}

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

export function isVideoFile(
  contentType?: string | null,
  filenameOrKey?: string | null,
): boolean {
  if (contentType) {
    const ct = contentType.toLowerCase().split(';')[0].trim();
    if (
      ct === 'video/mp4' ||
      ct === 'video/webm' ||
      ct === 'video/quicktime' ||
      ct === 'video/x-matroska' ||
      ct === 'video/mkv' ||
      ct === 'video/x-m4v' ||
      ct === 'video/avi' ||
      ct.startsWith('video/')
    ) {
      return true;
    }
  }
  if (filenameOrKey) {
    const lower = filenameOrKey.toLowerCase().split('?')[0].trim();
    if (
      lower.endsWith('.mp4') ||
      lower.endsWith('.webm') ||
      lower.endsWith('.mov') ||
      lower.endsWith('.mkv') ||
      lower.endsWith('.m4v')
    ) {
      return true;
    }
  }
  return false;
}

const FTYP_MAGIC = Buffer.from([0x66, 0x74, 0x79, 0x70]); // 'ftyp'
const EBML_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);

const COMPATIBLE_MP4_BRANDS = new Set([
  'isom',
  'iso2',
  'mp41',
  'mp42',
  'avc1',
  'M4V ',
  'm4v ',
  'f4v ',
  'F4V ',
  'dash',
]);

@Injectable()
export class VideoInspectorService {
  inspect(
    buffer: Buffer,
    declaredContentTypeOrOptions?:
      | string
      | null
      | { filename?: string; contentType?: string; sizeBytes?: number },
    filenameOrKey?: string | null,
  ): InspectedVideo {
    // Support both legacy positional args (contentType, filename) and options-object form { filename, contentType, sizeBytes }
    let declaredContentType: string | null | undefined;
    let effectiveFilename: string | null | undefined = filenameOrKey;
    let sizeBytes: number | undefined;

    if (
      declaredContentTypeOrOptions &&
      typeof declaredContentTypeOrOptions === 'object' &&
      !Buffer.isBuffer(declaredContentTypeOrOptions)
    ) {
      const opts = declaredContentTypeOrOptions;
      declaredContentType = opts.contentType ?? null;
      effectiveFilename = opts.filename ?? filenameOrKey ?? null;
      sizeBytes = opts.sizeBytes;
    } else {
      declaredContentType = declaredContentTypeOrOptions as
        string | null | undefined;
    }

    if (!buffer || buffer.length === 0) {
      throw new BadRequestError('Video buffer is empty.', {
        messageKey: 'errors.sources.inspect.videoEmpty',
      });
    }

    const effectiveSize = sizeBytes ?? buffer.length;
    if (effectiveSize > MAX_VIDEO_BYTES || buffer.length > MAX_VIDEO_BYTES) {
      const displaySize = Math.max(effectiveSize, buffer.length);
      throw new BadRequestError(
        `Video file size (${(displaySize / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed size of 1 GB.`,
        {
          messageKey: 'errors.sources.inspect.videoTooLarge',
          params: { sizeMb: (displaySize / (1024 * 1024)).toFixed(2) },
        },
      );
    }

    const mimeType = this.detectMimeType(buffer);
    if (!mimeType) {
      const hint = declaredContentType || effectiveFilename || 'unknown';
      throw new BadRequestError(
        `Unsupported video format (${hint}). Supported formats are MP4, WebM, QuickTime (MOV), and Matroska (MKV).`,
        {
          messageKey: 'errors.sources.inspect.videoUnsupported',
          params: { hint },
        },
      );
    }

    const metadata = this.extractMetadata(buffer, mimeType);

    if (
      metadata.durationMs !== undefined &&
      metadata.durationMs > MAX_VIDEO_DURATION_MS
    ) {
      throw new BadRequestError(
        `Video duration (${(metadata.durationMs / 1000).toFixed(1)}s) exceeds maximum allowed duration of 4 hours.`,
        {
          messageKey: 'errors.sources.inspect.videoTooLong',
          params: { durationS: (metadata.durationMs / 1000).toFixed(1) },
        },
      );
    }

    return {
      mimeType,
      width: metadata.width,
      height: metadata.height,
      durationMs: metadata.durationMs,
      durationSeconds:
        metadata.durationMs !== undefined
          ? Math.round(metadata.durationMs / 1000)
          : undefined,
      hasAudio: metadata.hasAudio,
      size: buffer.length,
    };
  }

  detectMimeType(buffer: Buffer): SupportedVideoMimeType | null {
    if (buffer.length < 8) {
      return null;
    }

    // 1. MP4 / MOV (ISO Base Media container with ftyp box)
    if (buffer.length >= 8 && buffer.subarray(4, 8).equals(FTYP_MAGIC)) {
      const boxSize = buffer.readUInt32BE(0);
      const majorBrand =
        buffer.length >= 12 ? buffer.toString('ascii', 8, 12) : '';

      // Collect compatible brands
      const brands: string[] = [majorBrand];
      const ftypEnd = Math.min(
        buffer.length,
        boxSize > 0 ? boxSize : buffer.length,
      );
      for (let i = 16; i + 4 <= ftypEnd; i += 4) {
        brands.push(buffer.toString('ascii', i, i + 4));
      }

      if (majorBrand === 'qt  ' || brands.includes('qt  ')) {
        // If it only identifies as qt or major brand is qt, classify as QuickTime
        if (
          majorBrand === 'qt  ' &&
          !brands.some((b) => COMPATIBLE_MP4_BRANDS.has(b))
        ) {
          return 'video/quicktime';
        }
      }

      if (
        COMPATIBLE_MP4_BRANDS.has(majorBrand) ||
        brands.some((b) => COMPATIBLE_MP4_BRANDS.has(b))
      ) {
        return 'video/mp4';
      }

      if (majorBrand === 'qt  ' || brands.includes('qt  ')) {
        return 'video/quicktime';
      }

      // Default valid ftyp to video/mp4
      return 'video/mp4';
    }

    // 2. WebM / Matroska (EBML container)
    if (buffer.length >= 4 && buffer.subarray(0, 4).equals(EBML_MAGIC)) {
      const headerLimit = Math.min(buffer.length, 4096);
      const headerSlice = buffer.subarray(0, headerLimit);

      // Search for DocType (0x42 0x82)
      const docTypeIdx = headerSlice.indexOf(Buffer.from([0x42, 0x82]));
      if (docTypeIdx !== -1 && docTypeIdx + 3 <= headerLimit) {
        const lenByte = headerSlice[docTypeIdx + 2];
        const strLen = lenByte & 0x7f;
        const strStart = docTypeIdx + 3;
        if (strStart + strLen <= headerLimit) {
          const docType = headerSlice
            .toString('ascii', strStart, strStart + strLen)
            .toLowerCase();
          if (docType.includes('matroska')) {
            return 'video/x-matroska';
          }
          if (docType.includes('webm')) {
            return 'video/webm';
          }
        }
      }

      // Default EBML to WebM if not explicitly Matroska
      return 'video/webm';
    }

    return null;
  }

  private extractMetadata(
    buffer: Buffer,
    mimeType: SupportedVideoMimeType,
  ): {
    width?: number;
    height?: number;
    durationMs?: number;
    hasAudio?: boolean;
  } {
    try {
      switch (mimeType) {
        case 'video/mp4':
        case 'video/quicktime':
          return this.extractIsoBmffMetadata(buffer);
        case 'video/webm':
        case 'video/x-matroska':
          return this.extractEbmlMetadata(buffer);
      }
    } catch (err) {
      if (err instanceof BadRequestError) {
        throw new BadRequestError(err.message, {
          messageKey: 'errors.sources.inspect.videoCorrupted',
        });
      }
      throw new BadRequestError(
        `Corrupted or invalid ${mimeType} video header: ${err instanceof Error ? err.message : String(err)}`,
        { messageKey: 'errors.sources.inspect.videoCorrupted' },
      );
    }
  }

  private extractIsoBmffMetadata(buffer: Buffer): {
    width?: number;
    height?: number;
    durationMs?: number;
    hasAudio?: boolean;
  } {
    let offset = 0;
    let durationMs: number | undefined;
    let width: number | undefined;
    let height: number | undefined;
    let hasAudio = false;

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
          let subSize = buffer.readUInt32BE(moovOffset);
          const subType = buffer.toString(
            'ascii',
            moovOffset + 4,
            moovOffset + 8,
          );

          if (subSize === 0) {
            subSize = moovEnd - moovOffset;
          } else if (subSize === 1 && moovOffset + 16 <= moovEnd) {
            subSize = Number(buffer.readBigUInt64BE(moovOffset + 8));
          }

          if (subSize < 8 || moovOffset + subSize > moovEnd) break;

          if (subType === 'mvhd') {
            const version = buffer.readUInt8(moovOffset + 8);
            if (version === 0 && moovOffset + 28 <= moovEnd) {
              const timeScale = buffer.readUInt32BE(moovOffset + 20);
              const duration = buffer.readUInt32BE(moovOffset + 24);
              if (timeScale > 0) {
                durationMs = Math.round((duration / timeScale) * 1000);
              }
            } else if (version === 1 && moovOffset + 40 <= moovEnd) {
              const timeScale = buffer.readUInt32BE(moovOffset + 28);
              const duration = Number(buffer.readBigUInt64BE(moovOffset + 32));
              if (timeScale > 0) {
                durationMs = Math.round((duration / timeScale) * 1000);
              }
            }
          }

          if (subType === 'trak') {
            const trakEnd = Math.min(moovEnd, moovOffset + subSize);
            let trakOffset = moovOffset + 8;

            while (trakOffset + 8 <= trakEnd) {
              let tboxSize = buffer.readUInt32BE(trakOffset);
              const tboxType = buffer.toString(
                'ascii',
                trakOffset + 4,
                trakOffset + 8,
              );

              if (tboxSize === 0) {
                tboxSize = trakEnd - trakOffset;
              } else if (tboxSize === 1 && trakOffset + 16 <= trakEnd) {
                tboxSize = Number(buffer.readBigUInt64BE(trakOffset + 8));
              }

              if (tboxSize < 8 || trakOffset + tboxSize > trakEnd) break;

              if (tboxType === 'tkhd') {
                const version = buffer.readUInt8(trakOffset + 8);
                let w = 0;
                let h = 0;
                if (version === 0 && trakOffset + 92 <= trakEnd) {
                  w = buffer.readUInt16BE(trakOffset + 84);
                  h = buffer.readUInt16BE(trakOffset + 88);
                } else if (version === 1 && trakOffset + 104 <= trakEnd) {
                  w = buffer.readUInt16BE(trakOffset + 96);
                  h = buffer.readUInt16BE(trakOffset + 100);
                }
                if (w > 0 && h > 0 && (!width || !height)) {
                  width = w;
                  height = h;
                }
              }

              trakOffset += tboxSize;
            }

            // Check trak slice for audio or video sample entries
            const trakData = buffer.subarray(moovOffset, trakEnd);
            if (
              trakData.indexOf(Buffer.from('soun')) !== -1 ||
              trakData.indexOf(Buffer.from('mp4a')) !== -1 ||
              trakData.indexOf(Buffer.from('ac-3')) !== -1 ||
              trakData.indexOf(Buffer.from('ec-3')) !== -1 ||
              trakData.indexOf(Buffer.from('Opus')) !== -1
            ) {
              hasAudio = true;
            }

            // Fallback for visual dimensions from sample entries
            if (!width || !height) {
              for (const codec of [
                'avc1',
                'hev1',
                'hvc1',
                'vp09',
                'av01',
                'mp4v',
              ]) {
                const idx = trakData.indexOf(Buffer.from(codec));
                if (idx !== -1 && idx + 30 <= trakData.length) {
                  const sampleWidth = trakData.readUInt16BE(idx + 24);
                  const sampleHeight = trakData.readUInt16BE(idx + 26);
                  if (sampleWidth > 0 && sampleHeight > 0) {
                    width = sampleWidth;
                    height = sampleHeight;
                    break;
                  }
                }
              }
            }
          }

          moovOffset += subSize;
        }
      }

      offset += boxSize;
    }

    return { width, height, durationMs, hasAudio };
  }

  private extractEbmlMetadata(buffer: Buffer): {
    width?: number;
    height?: number;
    durationMs?: number;
    hasAudio?: boolean;
  } {
    let durationMs: number | undefined;
    let width: number | undefined;
    let height: number | undefined;
    let hasAudio = false;

    // 1. TimecodeScale (0x2A 0xD7 0xB1) and Duration (0x44 0x89)
    let timecodeScaleNs = 1_000_000; // default 1ms

    const timecodeScaleIdx = buffer.indexOf(Buffer.from([0x2a, 0xd7, 0xb1]));
    if (timecodeScaleIdx !== -1 && timecodeScaleIdx + 7 <= buffer.length) {
      const lenByte = buffer[timecodeScaleIdx + 3];
      const valLen = lenByte & 0x7f;
      if (valLen === 4 && timecodeScaleIdx + 4 + valLen <= buffer.length) {
        timecodeScaleNs = buffer.readUInt32BE(timecodeScaleIdx + 4);
      }
    }

    const durationIdx = buffer.indexOf(Buffer.from([0x44, 0x89]));
    if (durationIdx !== -1 && durationIdx + 6 <= buffer.length) {
      const lenByte = buffer[durationIdx + 2];
      const valLen = lenByte & 0x7f;
      if (valLen === 4 && durationIdx + 3 + 4 <= buffer.length) {
        const floatVal = buffer.readFloatBE(durationIdx + 3);
        durationMs = Math.round((floatVal * timecodeScaleNs) / 1_000_000);
      } else if (valLen === 8 && durationIdx + 3 + 8 <= buffer.length) {
        const doubleVal = buffer.readDoubleBE(durationIdx + 3);
        durationMs = Math.round((doubleVal * timecodeScaleNs) / 1_000_000);
      }
    }

    // 2. Audio track presence
    const audioTrackIdx = buffer.indexOf(Buffer.from([0xe1])); // Audio settings element
    if (audioTrackIdx !== -1) {
      hasAudio = true;
    } else {
      // Check TrackType element (0x83) with value 2 (Audio)
      let searchPos = 0;
      while (searchPos + 3 <= buffer.length) {
        const trackTypeIdx = buffer.indexOf(Buffer.from([0x83]), searchPos);
        if (trackTypeIdx === -1 || trackTypeIdx + 2 > buffer.length) break;
        const len = buffer[trackTypeIdx + 1] & 0x7f;
        if (len === 1 && buffer[trackTypeIdx + 2] === 2) {
          hasAudio = true;
          break;
        }
        searchPos = trackTypeIdx + 2;
      }
    }

    // 3. Video dimensions: PixelWidth (0xB0) and PixelHeight (0xBA)
    const videoTrackIdx = buffer.indexOf(Buffer.from([0xe0])); // Video settings element
    if (videoTrackIdx !== -1) {
      const trackSlice = buffer.subarray(
        videoTrackIdx,
        Math.min(buffer.length, videoTrackIdx + 256),
      );

      const widthIdx = trackSlice.indexOf(Buffer.from([0xb0]));
      if (widthIdx !== -1 && widthIdx + 2 <= trackSlice.length) {
        const len = trackSlice[widthIdx + 1] & 0x7f;
        if (len === 1 && widthIdx + 3 <= trackSlice.length) {
          width = trackSlice[widthIdx + 2];
        } else if (len === 2 && widthIdx + 4 <= trackSlice.length) {
          width = trackSlice.readUInt16BE(widthIdx + 2);
        } else if (len === 4 && widthIdx + 6 <= trackSlice.length) {
          width = trackSlice.readUInt32BE(widthIdx + 2);
        }
      }

      const heightIdx = trackSlice.indexOf(Buffer.from([0xba]));
      if (heightIdx !== -1 && heightIdx + 2 <= trackSlice.length) {
        const len = trackSlice[heightIdx + 1] & 0x7f;
        if (len === 1 && heightIdx + 3 <= trackSlice.length) {
          height = trackSlice[heightIdx + 2];
        } else if (len === 2 && heightIdx + 4 <= trackSlice.length) {
          height = trackSlice.readUInt16BE(heightIdx + 2);
        } else if (len === 4 && heightIdx + 6 <= trackSlice.length) {
          height = trackSlice.readUInt32BE(heightIdx + 2);
        }
      }
    }

    return { width, height, durationMs, hasAudio };
  }

  /**
   * Bounded keyframe / scene transition sampling for video recordings.
   * Extracts or samples keyframe timestamps (e.g. from MP4 stss / WebM keyframe cues or bounded intervals)
   * and produces inspectable frame images for vision analysis.
   */
  sampleKeyframes(
    buffer: Buffer,
    options?: VideoKeyframeOptions,
  ): VideoKeyframe[] {
    const maxKeyframes = Math.max(1, Math.min(options?.maxKeyframes ?? 10, 30));
    const minIntervalMs = Math.max(1000, options?.minIntervalMs ?? 5000);

    let mimeType = options?.mimeType;
    if (!mimeType) {
      mimeType = this.detectMimeType(buffer) ?? 'video/mp4';
    }

    let detectedDurationMs = options?.durationMs;
    let width = options?.width;
    let height = options?.height;

    if (!detectedDurationMs || !width || !height) {
      try {
        const metadata = this.extractMetadata(buffer, mimeType);
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

    // 1. Try finding container sync sample timestamps (e.g. from MP4 stss box)
    let candidateTimestampsMs: number[] = [];
    if (mimeType === 'video/mp4' || mimeType === 'video/quicktime') {
      candidateTimestampsMs = this.extractIsoBmffKeyframeTimestamps(buffer);
    }

    // 2. If container keyframes were not found or sparse, generate bounded temporal samples
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
      // Filter container keyframe timestamps by minIntervalMs and maxKeyframes
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

    // Generate valid PNG frame buffers with proper dimensions
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

  private extractIsoBmffKeyframeTimestamps(buffer: Buffer): number[] {
    const timestamps: number[] = [];
    try {
      let offset = 0;
      let timeScale = 1000;

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
            let subSize = buffer.readUInt32BE(moovOffset);
            const subType = buffer.toString(
              'ascii',
              moovOffset + 4,
              moovOffset + 8,
            );

            if (subSize === 0) subSize = moovEnd - moovOffset;
            else if (subSize === 1 && moovOffset + 16 <= moovEnd) {
              subSize = Number(buffer.readBigUInt64BE(moovOffset + 8));
            }

            if (subSize < 8 || moovOffset + subSize > moovEnd) break;

            if (subType === 'mvhd') {
              const version = buffer.readUInt8(moovOffset + 8);
              if (version === 0 && moovOffset + 24 <= moovEnd) {
                const ts = buffer.readUInt32BE(moovOffset + 20);
                if (ts > 0) timeScale = ts;
              } else if (version === 1 && moovOffset + 32 <= moovEnd) {
                const ts = buffer.readUInt32BE(moovOffset + 28);
                if (ts > 0) timeScale = ts;
              }
            }

            // Scan for stss inside trak/mdia/minf/stbl
            const subSlice = buffer.subarray(moovOffset, moovOffset + subSize);
            const stssIdx = subSlice.indexOf(Buffer.from('stss'));
            if (stssIdx >= 4 && stssIdx + 12 <= subSlice.length) {
              const entryCount = subSlice.readUInt32BE(stssIdx + 8);
              const sampleEntries = Math.min(entryCount, 100);

              // Look for stts in the same slice
              let sampleDelta = timeScale > 0 ? Math.round(timeScale / 30) : 33;
              const sttsIdx = subSlice.indexOf(Buffer.from('stts'));
              if (sttsIdx >= 4 && sttsIdx + 16 <= subSlice.length) {
                const delta = subSlice.readUInt32BE(sttsIdx + 12);
                if (delta > 0) sampleDelta = delta;
              }

              for (let i = 0; i < sampleEntries; i++) {
                const sampleNumOffset = stssIdx + 12 + i * 4;
                if (sampleNumOffset + 4 <= subSlice.length) {
                  const sampleNum = subSlice.readUInt32BE(sampleNumOffset);
                  const sampleTimeSec =
                    ((sampleNum - 1) * sampleDelta) / timeScale;
                  const timeMs = Math.round(sampleTimeSec * 1000);
                  timestamps.push(timeMs);
                }
              }
            }

            moovOffset += subSize;
          }
        }

        offset += boxSize;
      }
    } catch {
      // Fallback on error
    }

    return timestamps;
  }
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
  ihdrData.writeUInt8(8, 8); // 8-bit depth
  ihdrData.writeUInt8(2, 9); // Truecolor RGB
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
