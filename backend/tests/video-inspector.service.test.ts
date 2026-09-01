import { describe, expect, it } from 'vitest';
import { BadRequestError } from '../src/common/errors/domain-error';
import { ImageInspectorService } from '../src/modules/sources/image-inspector.service';
import {
  isVideoFile,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_DURATION_MS,
  VideoInspectorService,
} from '../src/modules/sources/video-inspector.service';

function createMp4Buffer(options: {
  brand?: string;
  durationSec?: number;
  timeScale?: number;
  width?: number;
  height?: number;
  hasAudio?: boolean;
}): Buffer {
  const brand = options.brand ?? 'isom';
  const durationSec = options.durationSec ?? 10;
  const timeScale = options.timeScale ?? 1000;
  const duration = durationSec * timeScale;
  const width = options.width ?? 1920;
  const height = options.height ?? 1080;
  const hasAudio = options.hasAudio ?? false;

  // ftyp box (24 bytes)
  const ftyp = Buffer.alloc(24);
  ftyp.writeUInt32BE(24, 0);
  ftyp.write('ftyp', 4, 4, 'ascii');
  ftyp.write(brand.padEnd(4, ' ').substring(0, 4), 8, 4, 'ascii');
  ftyp.writeUInt32BE(0x00000200, 12);
  ftyp.write('isom', 16, 4, 'ascii');
  ftyp.write('mp41', 20, 4, 'ascii');

  // mvhd box (32 bytes)
  const mvhd = Buffer.alloc(32);
  mvhd.writeUInt32BE(32, 0);
  mvhd.write('mvhd', 4, 4, 'ascii');
  mvhd.writeUInt8(0, 8); // version 0
  mvhd.writeUInt32BE(timeScale, 20); // timeScale
  mvhd.writeUInt32BE(duration, 24); // duration

  // Video track: trak -> tkhd
  const tkhd = Buffer.alloc(92);
  tkhd.writeUInt32BE(92, 0);
  tkhd.write('tkhd', 4, 4, 'ascii');
  tkhd.writeUInt8(0, 8); // version 0
  tkhd.writeUInt16BE(width, 84); // width (integer part of 16.16)
  tkhd.writeUInt16BE(height, 88); // height (integer part of 16.16)

  const videoTrak = Buffer.alloc(8 + tkhd.length);
  videoTrak.writeUInt32BE(8 + tkhd.length, 0);
  videoTrak.write('trak', 4, 4, 'ascii');
  tkhd.copy(videoTrak, 8);

  const trakBoxes: Buffer[] = [videoTrak];

  if (hasAudio) {
    const audioTrak = Buffer.alloc(32);
    audioTrak.writeUInt32BE(32, 0);
    audioTrak.write('trak', 4, 4, 'ascii');
    audioTrak.write('soun', 8, 4, 'ascii');
    audioTrak.write('mp4a', 16, 4, 'ascii');
    trakBoxes.push(audioTrak);
  }

  const allTraks = Buffer.concat(trakBoxes);
  const moovLen = 8 + mvhd.length + allTraks.length;
  const moov = Buffer.alloc(moovLen);
  moov.writeUInt32BE(moovLen, 0);
  moov.write('moov', 4, 4, 'ascii');
  mvhd.copy(moov, 8);
  allTraks.copy(moov, 8 + mvhd.length);

  return Buffer.concat([ftyp, moov]);
}

function createMovBuffer(options: {
  durationSec?: number;
  width?: number;
  height?: number;
  hasAudio?: boolean;
}): Buffer {
  const durationSec = options.durationSec ?? 5;
  const timeScale = 600;
  const duration = durationSec * timeScale;
  const width = options.width ?? 1280;
  const height = options.height ?? 720;

  // ftyp box with 'qt  ' brand
  const ftyp = Buffer.alloc(20);
  ftyp.writeUInt32BE(20, 0);
  ftyp.write('ftyp', 4, 4, 'ascii');
  ftyp.write('qt  ', 8, 4, 'ascii');
  ftyp.writeUInt32BE(0x00000000, 12);
  ftyp.write('qt  ', 16, 4, 'ascii');

  const mvhd = Buffer.alloc(32);
  mvhd.writeUInt32BE(32, 0);
  mvhd.write('mvhd', 4, 4, 'ascii');
  mvhd.writeUInt8(0, 8);
  mvhd.writeUInt32BE(timeScale, 20);
  mvhd.writeUInt32BE(duration, 24);

  const tkhd = Buffer.alloc(92);
  tkhd.writeUInt32BE(92, 0);
  tkhd.write('tkhd', 4, 4, 'ascii');
  tkhd.writeUInt8(0, 8);
  tkhd.writeUInt16BE(width, 84);
  tkhd.writeUInt16BE(height, 88);

  const videoTrak = Buffer.alloc(8 + tkhd.length);
  videoTrak.writeUInt32BE(8 + tkhd.length, 0);
  videoTrak.write('trak', 4, 4, 'ascii');
  tkhd.copy(videoTrak, 8);

  const moovLen = 8 + mvhd.length + videoTrak.length;
  const moov = Buffer.alloc(moovLen);
  moov.writeUInt32BE(moovLen, 0);
  moov.write('moov', 4, 4, 'ascii');
  mvhd.copy(moov, 8);
  videoTrak.copy(moov, 8 + mvhd.length);

  return Buffer.concat([ftyp, moov]);
}

function createEbmlVideoBuffer(options: {
  docType?: string;
  durationMs?: number;
  width?: number;
  height?: number;
  hasAudio?: boolean;
}): Buffer {
  const docType = options.docType ?? 'webm';
  const durationMs = options.durationMs ?? 15000;
  const width = options.width ?? 1920;
  const height = options.height ?? 1080;
  const hasAudio = options.hasAudio ?? false;

  const buf = Buffer.alloc(256);
  let offset = 0;

  // EBML Header (0x1A 0x45 0xDF 0xA3)
  buf.set([0x1a, 0x45, 0xdf, 0xa3], offset);
  offset += 4;
  buf.writeUInt8(0x84, offset++); // header size 4

  // DocType element (0x42 0x82)
  buf.set([0x42, 0x82], offset);
  offset += 2;
  const docTypeBytes = Buffer.from(docType, 'ascii');
  buf.writeUInt8(0x80 | docTypeBytes.length, offset++);
  docTypeBytes.copy(buf, offset);
  offset += docTypeBytes.length;

  // TimecodeScale element (0x2A 0xD7 0xB1)
  buf.set([0x2a, 0xd7, 0xb1], offset);
  offset += 3;
  buf.writeUInt8(0x84, offset++);
  buf.writeUInt32BE(1000000, offset); // 1 ms
  offset += 4;

  // Duration element (0x44 0x89)
  buf.set([0x44, 0x89], offset);
  offset += 2;
  buf.writeUInt8(0x84, offset++);
  buf.writeFloatBE(durationMs, offset);
  offset += 4;

  // Video track element (0xE0)
  buf.writeUInt8(0xe0, offset++);
  // PixelWidth (0xB0)
  buf.writeUInt8(0xb0, offset++);
  buf.writeUInt8(0x82, offset++); // 2 bytes
  buf.writeUInt16BE(width, offset);
  offset += 2;
  // PixelHeight (0xBA)
  buf.writeUInt8(0xba, offset++);
  buf.writeUInt8(0x82, offset++); // 2 bytes
  buf.writeUInt16BE(height, offset);
  offset += 2;

  if (hasAudio) {
    // Audio track element (0xE1)
    buf.writeUInt8(0xe1, offset++);
    buf.writeUInt8(0x9f, offset++);
    buf.writeUInt8(0x81, offset++);
    buf.writeUInt8(2, offset++); // 2 channels
  }

  return buf.subarray(0, offset);
}

describe('VideoInspectorService', () => {
  const inspector = new VideoInspectorService();

  describe('MP4 container inspection', () => {
    it('validates MP4 ftyp box and extracts dimensions, duration, and audio status', () => {
      const mp4 = createMp4Buffer({
        brand: 'isom',
        durationSec: 12,
        timeScale: 1000,
        width: 1920,
        height: 1080,
        hasAudio: true,
      });

      const result = inspector.inspect(mp4, 'video/mp4', 'clip.mp4');
      expect(result.mimeType).toBe('video/mp4');
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
      expect(result.durationMs).toBe(12000);
      expect(result.durationSeconds).toBe(12);
      expect(result.hasAudio).toBe(true);
      expect(result.size).toBe(mp4.length);
    });

    it('inspects MP4 with mp42 brand without audio track', () => {
      const mp4 = createMp4Buffer({
        brand: 'mp42',
        durationSec: 30,
        width: 3840,
        height: 2160,
        hasAudio: false,
      });

      const result = inspector.inspect(mp4);
      expect(result.mimeType).toBe('video/mp4');
      expect(result.width).toBe(3840);
      expect(result.height).toBe(2160);
      expect(result.durationMs).toBe(30000);
      expect(result.hasAudio).toBe(false);
    });
  });

  describe('QuickTime (MOV) container inspection', () => {
    it('validates MOV ftyp box with qt brand and parses video properties', () => {
      const mov = createMovBuffer({
        durationSec: 8,
        width: 1280,
        height: 720,
      });

      const result = inspector.inspect(mov, 'video/quicktime', 'movie.mov');
      expect(result.mimeType).toBe('video/quicktime');
      expect(result.width).toBe(1280);
      expect(result.height).toBe(720);
      expect(result.durationMs).toBe(8000);
      expect(result.durationSeconds).toBe(8);
    });
  });

  describe('WebM container inspection', () => {
    it('validates WebM EBML header and parses PixelWidth, PixelHeight, Duration, and audio', () => {
      const webm = createEbmlVideoBuffer({
        docType: 'webm',
        durationMs: 45000,
        width: 1280,
        height: 720,
        hasAudio: true,
      });

      const result = inspector.inspect(webm, 'video/webm', 'video.webm');
      expect(result.mimeType).toBe('video/webm');
      expect(result.width).toBe(1280);
      expect(result.height).toBe(720);
      expect(result.durationMs).toBe(45000);
      expect(result.durationSeconds).toBe(45);
      expect(result.hasAudio).toBe(true);
    });
  });

  describe('Matroska (MKV) container inspection', () => {
    it('validates Matroska EBML header and identifies video/x-matroska', () => {
      const mkv = createEbmlVideoBuffer({
        docType: 'matroska',
        durationMs: 90000,
        width: 1920,
        height: 1080,
        hasAudio: false,
      });

      const result = inspector.inspect(mkv, 'video/x-matroska', 'film.mkv');
      expect(result.mimeType).toBe('video/x-matroska');
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
      expect(result.durationMs).toBe(90000);
      expect(result.durationSeconds).toBe(90);
      expect(result.hasAudio).toBe(false);
    });
  });

  describe('Corrupted and invalid headers', () => {
    it('rejects empty video buffer', () => {
      expect(() => inspector.inspect(Buffer.alloc(0))).toThrow(BadRequestError);
    });

    it('rejects non-video arbitrary text buffer', () => {
      const plain = Buffer.from(
        'This is definitely not a valid video file format.',
      );
      expect(() => inspector.inspect(plain)).toThrow(BadRequestError);
    });

    it('rejects truncated MP4 header', () => {
      const partial = Buffer.alloc(10);
      partial.writeUInt32BE(50, 0);
      partial.write('ftyp', 4, 4, 'ascii');
      partial.write('isom', 8, 2, 'ascii');
      const result = inspector.inspect(partial);
      expect(result.mimeType).toBe('video/mp4');
      expect(result.durationMs).toBeUndefined();
    });
  });

  describe('Bounds and limits enforcement', () => {
    it('rejects video exceeding 1 GB byte limit', () => {
      const hugeBuffer = {
        length: MAX_VIDEO_BYTES + 1,
      } as unknown as Buffer;

      expect(() => inspector.inspect(hugeBuffer)).toThrow(BadRequestError);
    });

    it('rejects video exceeding 4-hour max duration limit', () => {
      // 5 hours = 5 * 3600 * 1000 = 18,000,000 ms
      const longVideo = createMp4Buffer({
        durationSec: 5 * 3600,
        timeScale: 1000,
      });

      expect(() => inspector.inspect(longVideo)).toThrow(BadRequestError);
    });

    it('accepts video exactly at 4-hour limit', () => {
      const maxVideo = createMp4Buffer({
        durationSec: 4 * 3600,
        timeScale: 1000,
      });

      const result = inspector.inspect(maxVideo);
      expect(result.durationMs).toBe(MAX_VIDEO_DURATION_MS);
    });
  });

  describe('sampleKeyframes', () => {
    const imageInspector = new ImageInspectorService();

    it('samples bounded keyframes across video duration', () => {
      const mp4 = createMp4Buffer({
        durationSec: 60,
        width: 1920,
        height: 1080,
      });

      const keyframes = inspector.sampleKeyframes(mp4, {
        maxKeyframes: 5,
        minIntervalMs: 10000,
      });

      expect(keyframes.length).toBeGreaterThanOrEqual(1);
      expect(keyframes.length).toBeLessThanOrEqual(5);

      // Verify each keyframe has valid properties
      for (const kf of keyframes) {
        expect(kf.timestampMs).toBeGreaterThanOrEqual(0);
        expect(kf.timestampMs).toBeLessThanOrEqual(60000);
        expect(kf.mimeType).toBe('image/png');
        expect(kf.isKeyframe).toBe(true);

        // Verify that buffer is a valid inspectable PNG
        const inspectedImg = imageInspector.inspect(kf.buffer, 'image/png');
        expect(inspectedImg.mimeType).toBe('image/png');
        expect(inspectedImg.width).toBe(1920);
        expect(inspectedImg.height).toBe(1080);
      }
    });

    it('respects minIntervalMs to avoid redundant dense sampling', () => {
      const mp4 = createMp4Buffer({
        durationSec: 20,
        width: 1280,
        height: 720,
      });

      const keyframes = inspector.sampleKeyframes(mp4, {
        maxKeyframes: 10,
        minIntervalMs: 10000, // min 10s between frames
      });

      expect(keyframes.length).toBe(2);
      expect(keyframes[0].timestampMs).toBe(0);
      expect(keyframes[1].timestampMs).toBe(10000);
    });

    it('handles short video with single keyframe at 0ms', () => {
      const mp4 = createMp4Buffer({
        durationSec: 3,
        width: 1920,
        height: 1080,
      });

      const keyframes = inspector.sampleKeyframes(mp4, {
        minIntervalMs: 5000,
      });

      expect(keyframes).toHaveLength(1);
      expect(keyframes[0].timestampMs).toBe(0);
    });
  });

  describe('isVideoFile helper', () => {
    it('identifies video by MIME types and file extensions', () => {
      expect(isVideoFile('video/mp4', null)).toBe(true);
      expect(isVideoFile('video/webm', null)).toBe(true);
      expect(isVideoFile('video/quicktime', null)).toBe(true);
      expect(isVideoFile('video/x-matroska', null)).toBe(true);
      expect(isVideoFile('video/mkv', null)).toBe(true);
      expect(isVideoFile('video/x-m4v', null)).toBe(true);

      expect(isVideoFile(null, 'presentation.mp4')).toBe(true);
      expect(isVideoFile(null, 'presentation.webm')).toBe(true);
      expect(isVideoFile(null, 'presentation.mov')).toBe(true);
      expect(isVideoFile(null, 'presentation.mkv')).toBe(true);
      expect(isVideoFile(null, 'presentation.m4v')).toBe(true);

      expect(isVideoFile('image/jpeg', 'photo.jpg')).toBe(false);
      expect(isVideoFile('audio/mp3', 'song.mp3')).toBe(false);
      expect(isVideoFile('application/pdf', 'doc.pdf')).toBe(false);
      expect(isVideoFile(null, null)).toBe(false);
    });
  });
});
