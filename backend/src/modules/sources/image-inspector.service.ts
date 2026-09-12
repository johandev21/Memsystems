import { Injectable } from '@nestjs/common';
import { BadRequestError } from '../../common/errors/domain-error';

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MB
export const MAX_IMAGE_PIXELS = 40_000_000; // 40 MP

export type SupportedImageMimeType = 'image/png' | 'image/jpeg' | 'image/webp';

export function isImageFile(
  contentType?: string | null,
  filenameOrKey?: string | null,
): boolean {
  if (contentType) {
    const ct = contentType.toLowerCase().split(';')[0].trim();
    if (
      ct === 'image/png' ||
      ct === 'image/jpeg' ||
      ct === 'image/jpg' ||
      ct === 'image/webp'
    ) {
      return true;
    }
  }
  if (filenameOrKey) {
    const lower = filenameOrKey.toLowerCase().split('?')[0].trim();
    if (
      lower.endsWith('.png') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.webp')
    ) {
      return true;
    }
  }
  return false;
}

export interface InspectedImage {
  mimeType: SupportedImageMimeType;
  width: number;
  height: number;
  totalPixels: number;
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC_PREFIX = Buffer.from([0xff, 0xd8, 0xff]);

@Injectable()
export class ImageInspectorService {
  inspect(
    buffer: Buffer,
    declaredContentType?: string | null,
    filenameOrKey?: string | null,
  ): InspectedImage {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestError('Image buffer is empty.', {
        messageKey: 'errors.sources.inspect.imageEmpty',
      });
    }

    if (buffer.length > MAX_IMAGE_BYTES) {
      throw new BadRequestError(
        `Image size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed size of 20 MB.`,
        {
          messageKey: 'errors.sources.inspect.imageTooLarge',
          params: { sizeMb: (buffer.length / (1024 * 1024)).toFixed(2) },
        },
      );
    }

    const mimeType = this.detectMimeType(buffer);
    if (!mimeType) {
      const hint = declaredContentType || filenameOrKey || 'unknown';
      throw new BadRequestError(
        `Unsupported image format (${hint}). Supported formats are PNG, JPEG, and WebP.`,
        {
          messageKey: 'errors.sources.inspect.imageUnsupported',
          params: { hint },
        },
      );
    }

    let dimensions: { width: number; height: number };
    try {
      dimensions = this.extractDimensions(buffer, mimeType);
    } catch (error) {
      if (error instanceof BadRequestError) {
        throw new BadRequestError(error.message, {
          messageKey: 'errors.sources.inspect.imageCorrupted',
        });
      }
      throw error;
    }
    const { width, height } = dimensions;
    const totalPixels = width * height;

    if (totalPixels > MAX_IMAGE_PIXELS) {
      throw new BadRequestError(
        `Image dimensions (${width}x${height} = ${totalPixels.toLocaleString()} pixels) exceed maximum allowed limit of ${MAX_IMAGE_PIXELS.toLocaleString()} pixels (40 MP).`,
        {
          messageKey: 'errors.sources.inspect.imageTooManyPixels',
          params: { width, height },
        },
      );
    }

    return {
      mimeType,
      width,
      height,
      totalPixels,
    };
  }

  detectMimeType(buffer: Buffer): SupportedImageMimeType | null {
    if (buffer.length < 12) {
      return null;
    }

    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_MAGIC)) {
      return 'image/png';
    }

    if (buffer.length >= 3 && buffer.subarray(0, 3).equals(JPEG_MAGIC_PREFIX)) {
      return 'image/jpeg';
    }

    if (
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
      return 'image/webp';
    }

    return null;
  }

  private extractDimensions(
    buffer: Buffer,
    mimeType: SupportedImageMimeType,
  ): { width: number; height: number } {
    switch (mimeType) {
      case 'image/png':
        return this.extractPngDimensions(buffer);
      case 'image/jpeg':
        return this.extractJpegDimensions(buffer);
      case 'image/webp':
        return this.extractWebpDimensions(buffer);
    }
  }

  private extractPngDimensions(buffer: Buffer): {
    width: number;
    height: number;
  } {
    if (buffer.length < 24) {
      throw new BadRequestError('Corrupted PNG header: buffer too small.');
    }

    const chunkType = buffer.toString('ascii', 12, 16);
    if (chunkType !== 'IHDR') {
      throw new BadRequestError('Corrupted PNG header: missing IHDR chunk.');
    }

    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);

    if (width <= 0 || height <= 0) {
      throw new BadRequestError('Invalid PNG dimensions in IHDR chunk.');
    }

    return { width, height };
  }

  private extractJpegDimensions(buffer: Buffer): {
    width: number;
    height: number;
  } {
    let offset = 2; // Skip SOI (FF D8)

    while (offset < buffer.length) {
      // Advance to next marker
      while (offset < buffer.length && buffer[offset] === 0xff) {
        offset++;
      }

      if (offset >= buffer.length) {
        break;
      }

      const marker = buffer[offset++];

      // Stop if SOS (Start of Scan) or EOI (End of Image) reached
      if (marker === 0xda || marker === 0xd9) {
        break;
      }

      // Skip standalone markers without length (RST0-RST7, TEM, byte stuffing)
      if (
        (marker >= 0xd0 && marker <= 0xd7) ||
        marker === 0x01 ||
        marker === 0x00
      ) {
        continue;
      }

      if (offset + 2 > buffer.length) {
        throw new BadRequestError(
          'Corrupted JPEG header: truncated marker length.',
        );
      }

      const length = buffer.readUInt16BE(offset);
      if (length < 2) {
        throw new BadRequestError(
          'Corrupted JPEG header: invalid marker length.',
        );
      }

      // SOF markers: SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
      const isSOF =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc;

      if (isSOF) {
        if (offset + 7 > buffer.length) {
          throw new BadRequestError(
            'Corrupted JPEG header: truncated SOF frame.',
          );
        }

        const height = buffer.readUInt16BE(offset + 3);
        const width = buffer.readUInt16BE(offset + 5);

        if (width <= 0 || height <= 0) {
          throw new BadRequestError('Invalid JPEG dimensions in SOF header.');
        }

        return { width, height };
      }

      offset += length;
    }

    throw new BadRequestError(
      'Invalid or corrupted JPEG image: missing frame header.',
    );
  }

  private extractWebpDimensions(buffer: Buffer): {
    width: number;
    height: number;
  } {
    if (buffer.length < 16) {
      throw new BadRequestError('Corrupted WebP header: buffer too small.');
    }

    const chunkType = buffer.toString('ascii', 12, 16);

    if (chunkType === 'VP8 ') {
      // Simple lossy WebP
      if (buffer.length < 30) {
        throw new BadRequestError(
          'Corrupted VP8 WebP header: buffer too small.',
        );
      }

      // Check keyframe bit (bit 0 of byte 20 must be 0)
      const isKeyframe = (buffer[20] & 0x01) === 0;
      if (!isKeyframe) {
        throw new BadRequestError('Invalid VP8 WebP: not a keyframe.');
      }

      // Start code 0x9D 0x01 0x2A
      if (buffer[23] !== 0x9d || buffer[24] !== 0x01 || buffer[25] !== 0x2a) {
        throw new BadRequestError('Corrupted VP8 WebP: invalid start code.');
      }

      const width = buffer.readUInt16LE(26) & 0x3fff;
      const height = buffer.readUInt16LE(28) & 0x3fff;

      if (width <= 0 || height <= 0) {
        throw new BadRequestError('Invalid VP8 WebP dimensions.');
      }

      return { width, height };
    }

    if (chunkType === 'VP8L') {
      // Lossless WebP
      if (buffer.length < 25) {
        throw new BadRequestError(
          'Corrupted VP8L WebP header: buffer too small.',
        );
      }

      // Byte 20 is 1-byte signature (0x2F)
      if (buffer[20] !== 0x2f) {
        throw new BadRequestError(
          'Corrupted VP8L WebP: invalid signature byte.',
        );
      }

      const b0 = buffer[21];
      const b1 = buffer[22];
      const b2 = buffer[23];
      const b3 = buffer[24];

      const width = 1 + (((b1 & 0x3f) << 8) | b0);
      const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));

      if (width <= 0 || height <= 0) {
        throw new BadRequestError('Invalid VP8L WebP dimensions.');
      }

      return { width, height };
    }

    if (chunkType === 'VP8X') {
      // Extended WebP
      if (buffer.length < 30) {
        throw new BadRequestError(
          'Corrupted VP8X WebP header: buffer too small.',
        );
      }

      const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
      const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));

      if (width <= 0 || height <= 0) {
        throw new BadRequestError('Invalid VP8X WebP dimensions.');
      }

      return { width, height };
    }

    throw new BadRequestError(
      `Unsupported or corrupted WebP chunk format: ${chunkType.trim()}.`,
    );
  }
}
