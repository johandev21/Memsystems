import { BadRequestError } from '../../../common/errors/domain-error';

export type SupportedVideoMimeType =
  'video/mp4' | 'video/webm' | 'video/quicktime' | 'video/x-matroska';

export interface VideoMetadata {
  width?: number;
  height?: number;
  durationMs?: number;
  hasAudio?: boolean;
}

export const FTYP_MAGIC = Buffer.from([0x66, 0x74, 0x79, 0x70]);
export const EBML_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);

export const COMPATIBLE_MP4_BRANDS = new Set([
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

export function detectVideoMimeType(
  buffer: Buffer,
): SupportedVideoMimeType | null {
  if (buffer.length < 8) {
    return null;
  }

  if (buffer.subarray(4, 8).equals(FTYP_MAGIC)) {
    const boxSize = buffer.readUInt32BE(0);
    const majorBrand =
      buffer.length >= 12 ? buffer.toString('ascii', 8, 12) : '';

    const brands: string[] = [majorBrand];
    const ftypEnd = Math.min(
      buffer.length,
      boxSize > 0 ? boxSize : buffer.length,
    );
    for (let i = 16; i + 4 <= ftypEnd; i += 4) {
      brands.push(buffer.toString('ascii', i, i + 4));
    }

    if (majorBrand === 'qt  ' || brands.includes('qt  ')) {
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

    return 'video/mp4';
  }

  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(EBML_MAGIC)) {
    const headerLimit = Math.min(buffer.length, 4096);
    const headerSlice = buffer.subarray(0, headerLimit);

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

    return 'video/webm';
  }

  return null;
}

export function extractIsoBmffMetadata(buffer: Buffer): VideoMetadata {
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

export function extractEbmlMetadata(buffer: Buffer): VideoMetadata {
  let durationMs: number | undefined;
  let width: number | undefined;
  let height: number | undefined;
  let hasAudio = false;

  let timecodeScaleNs = 1_000_000;

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

  const audioTrackIdx = buffer.indexOf(Buffer.from([0xe1]));
  if (audioTrackIdx !== -1) {
    hasAudio = true;
  } else {
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

  const videoTrackIdx = buffer.indexOf(Buffer.from([0xe0]));
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

export function extractVideoMetadata(
  buffer: Buffer,
  mimeType: SupportedVideoMimeType,
): VideoMetadata {
  try {
    switch (mimeType) {
      case 'video/mp4':
      case 'video/quicktime':
        return extractIsoBmffMetadata(buffer);
      case 'video/webm':
      case 'video/x-matroska':
        return extractEbmlMetadata(buffer);
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

export function extractIsoBmffKeyframeTimestamps(buffer: Buffer): number[] {
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

          const subSlice = buffer.subarray(moovOffset, moovOffset + subSize);
          const stssIdx = subSlice.indexOf(Buffer.from('stss'));
          if (stssIdx >= 4 && stssIdx + 12 <= subSlice.length) {
            const entryCount = subSlice.readUInt32BE(stssIdx + 8);
            const sampleEntries = Math.min(entryCount, 100);

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
    void 0;
  }

  return timestamps;
}
