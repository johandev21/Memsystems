import { describe, expect, it } from 'vitest';
import { BadRequestError } from '../src/common/errors/domain-error';
import {
  ImageInspectorService,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_PIXELS,
} from '../src/modules/sources/image-inspector.service';

function createPngBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(33);
  // PNG signature
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  // IHDR chunk length (13 bytes)
  buf.writeUInt32BE(13, 8);
  // Chunk type 'IHDR'
  buf.write('IHDR', 12, 4, 'ascii');
  // Width and height
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  // Bit depth, color type, compression, filter, interlace
  buf.set([8, 6, 0, 0, 0], 24);
  // CRC
  buf.writeUInt32BE(0, 29);
  return buf;
}

function createJpegBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(30);
  let offset = 0;
  // SOI marker (FF D8)
  buf.writeUInt8(0xff, offset++);
  buf.writeUInt8(0xd8, offset++);
  // APP0 marker (FF E0)
  buf.writeUInt8(0xff, offset++);
  buf.writeUInt8(0xe0, offset++);
  buf.writeUInt16BE(4, offset); // length = 4 (including length itself)
  offset += 2;
  buf.writeUInt16BE(0, offset); // payload
  offset += 2;
  // SOF0 marker (FF C0)
  buf.writeUInt8(0xff, offset++);
  buf.writeUInt8(0xc0, offset++);
  buf.writeUInt16BE(11, offset); // length = 11 (2 + 1 + 2 + 2 + 1 + 3)
  offset += 2;
  buf.writeUInt8(8, offset++); // precision
  buf.writeUInt16BE(height, offset); // height
  offset += 2;
  buf.writeUInt16BE(width, offset); // width
  offset += 2;
  buf.writeUInt8(1, offset++); // components
  buf.writeUInt8(1, offset++); // component ID
  buf.writeUInt8(0x11, offset++); // sampling factor
  buf.writeUInt8(0, offset++); // quant table ID
  // EOI marker (FF D9)
  buf.writeUInt8(0xff, offset++);
  buf.writeUInt8(0xd9, offset++);
  return buf.subarray(0, offset);
}

function createWebpVp8Buffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(30);
  // 'RIFF'
  buf.write('RIFF', 0, 4, 'ascii');
  buf.writeUInt32LE(22, 4); // file size - 8
  // 'WEBP'
  buf.write('WEBP', 8, 4, 'ascii');
  // 'VP8 '
  buf.write('VP8 ', 12, 4, 'ascii');
  buf.writeUInt32LE(10, 16); // chunk size
  // Frame tag (keyframe bit 0 = 0)
  buf.set([0x00, 0x00, 0x00], 20);
  // Start code: 0x9D 0x01 0x2A
  buf.set([0x9d, 0x01, 0x2a], 23);
  // Width and height (14 bits)
  buf.writeUInt16LE(width & 0x3fff, 26);
  buf.writeUInt16LE(height & 0x3fff, 28);
  return buf;
}

function createWebpVp8lBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(25);
  // 'RIFF'
  buf.write('RIFF', 0, 4, 'ascii');
  buf.writeUInt32LE(17, 4);
  // 'WEBP'
  buf.write('WEBP', 8, 4, 'ascii');
  // 'VP8L'
  buf.write('VP8L', 12, 4, 'ascii');
  buf.writeUInt32LE(5, 16);
  // Signature byte 0x2F
  buf.writeUInt8(0x2f, 20);
  // 14 bits width-1, 14 bits height-1
  const w = (width - 1) & 0x3fff;
  const h = (height - 1) & 0x3fff;
  const val = (w & 0x3fff) | ((h & 0x3fff) << 14);
  buf.writeUInt32LE(val, 21);
  return buf;
}

function createWebpVp8xBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(30);
  // 'RIFF'
  buf.write('RIFF', 0, 4, 'ascii');
  buf.writeUInt32LE(22, 4);
  // 'WEBP'
  buf.write('WEBP', 8, 4, 'ascii');
  // 'VP8X'
  buf.write('VP8X', 12, 4, 'ascii');
  buf.writeUInt32LE(10, 16);
  // Flags (4 bytes)
  buf.set([0, 0, 0, 0], 20);
  // Canvas width - 1 (3 bytes LE)
  const wMinus1 = width - 1;
  buf.writeUInt8(wMinus1 & 0xff, 24);
  buf.writeUInt8((wMinus1 >> 8) & 0xff, 25);
  buf.writeUInt8((wMinus1 >> 16) & 0xff, 26);
  // Canvas height - 1 (3 bytes LE)
  const hMinus1 = height - 1;
  buf.writeUInt8(hMinus1 & 0xff, 27);
  buf.writeUInt8((hMinus1 >> 8) & 0xff, 28);
  buf.writeUInt8((hMinus1 >> 16) & 0xff, 29);
  return buf;
}

describe('ImageInspectorService', () => {
  const inspector = new ImageInspectorService();

  describe('PNG format inspection', () => {
    it('validates PNG magic bytes and extracts dimensions', () => {
      const buf = createPngBuffer(1920, 1080);
      const result = inspector.inspect(buf);

      expect(result).toEqual({
        mimeType: 'image/png',
        width: 1920,
        height: 1080,
        totalPixels: 2073600,
      });
    });

    it('rejects PNG with missing IHDR chunk', () => {
      const buf = Buffer.alloc(24);
      buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
      buf.write('PLTE', 12, 4, 'ascii');
      expect(() => inspector.inspect(buf)).toThrow(BadRequestError);
    });

    it('rejects PNG with invalid dimensions', () => {
      const buf = createPngBuffer(0, 500);
      expect(() => inspector.inspect(buf)).toThrow(BadRequestError);
    });
  });

  describe('JPEG format inspection', () => {
    it('validates JPEG SOI/SOF and extracts dimensions', () => {
      const buf = createJpegBuffer(800, 600);
      const result = inspector.inspect(buf);

      expect(result).toEqual({
        mimeType: 'image/jpeg',
        width: 800,
        height: 600,
        totalPixels: 480000,
      });
    });

    it('rejects JPEG missing SOF header', () => {
      const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x02, 0xff, 0xd9]);
      expect(() => inspector.inspect(buf)).toThrow(BadRequestError);
    });
  });

  describe('WebP format inspection', () => {
    it('inspects lossy WebP (VP8)', () => {
      const buf = createWebpVp8Buffer(640, 480);
      const result = inspector.inspect(buf);

      expect(result).toEqual({
        mimeType: 'image/webp',
        width: 640,
        height: 480,
        totalPixels: 307200,
      });
    });

    it('inspects lossless WebP (VP8L)', () => {
      const buf = createWebpVp8lBuffer(1024, 768);
      const result = inspector.inspect(buf);

      expect(result).toEqual({
        mimeType: 'image/webp',
        width: 1024,
        height: 768,
        totalPixels: 786432,
      });
    });

    it('inspects extended WebP (VP8X)', () => {
      const buf = createWebpVp8xBuffer(2560, 1440);
      const result = inspector.inspect(buf);

      expect(result).toEqual({
        mimeType: 'image/webp',
        width: 2560,
        height: 1440,
        totalPixels: 3686400,
      });
    });

    it('rejects unsupported WebP chunk type', () => {
      const buf = Buffer.alloc(20);
      buf.write('RIFF', 0, 4, 'ascii');
      buf.writeUInt32LE(12, 4);
      buf.write('WEBP', 8, 4, 'ascii');
      buf.write('ANIM', 12, 4, 'ascii');
      expect(() => inspector.inspect(buf)).toThrow(BadRequestError);
    });
  });

  describe('Security and bounds checks', () => {
    it('rejects empty buffer', () => {
      expect(() => inspector.inspect(Buffer.alloc(0))).toThrow(BadRequestError);
    });

    it('rejects images exceeding 20 MB limit', () => {
      const oversizedBuf = Buffer.alloc(MAX_IMAGE_BYTES + 1);
      oversizedBuf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
      expect(() => inspector.inspect(oversizedBuf)).toThrow(BadRequestError);
    });

    it('rejects decompression bomb exceeding 40 MP limit', () => {
      // 8000 x 6000 = 48,000,000 pixels > 40,000,000
      const bomb = createPngBuffer(8000, 6000);
      expect(() => inspector.inspect(bomb)).toThrow(BadRequestError);
    });

    it('allows image within 40 MP limit', () => {
      // 6000 x 6000 = 36,000,000 pixels <= 40 MP
      const validLarge = createPngBuffer(6000, 6000);
      const result = inspector.inspect(validLarge);
      expect(result.totalPixels).toBe(36000000);
      expect(result.totalPixels).toBeLessThanOrEqual(MAX_IMAGE_PIXELS);
    });

    it('rejects non-image buffers', () => {
      const textBuf = Buffer.from('Hello world! This is a plain text file.');
      expect(() => inspector.inspect(textBuf)).toThrow(BadRequestError);
    });
  });

  describe('detectMimeType', () => {
    it('detects PNG, JPEG, WebP and returns null for others', () => {
      expect(inspector.detectMimeType(createPngBuffer(10, 10))).toBe(
        'image/png',
      );
      expect(inspector.detectMimeType(createJpegBuffer(10, 10))).toBe(
        'image/jpeg',
      );
      expect(inspector.detectMimeType(createWebpVp8Buffer(10, 10))).toBe(
        'image/webp',
      );
      expect(inspector.detectMimeType(Buffer.from('not an image'))).toBeNull();
    });
  });
});
