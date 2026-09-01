import { describe, expect, it } from 'vitest';
import { BadRequestError } from '../src/common/errors/domain-error';
import {
  AudioInspectorService,
  isAudioFile,
  MAX_AUDIO_BYTES,
  MAX_AUDIO_DURATION_MS,
} from '../src/modules/sources/audio-inspector.service';

function createWavBuffer(options: {
  channels?: number;
  sampleRate?: number;
  bitsPerSample?: number;
  dataDurationMs?: number;
}): Buffer {
  const channels = options.channels ?? 2;
  const sampleRate = options.sampleRate ?? 44100;
  const bitsPerSample = options.bitsPerSample ?? 16;
  const dataDurationMs = options.dataDurationMs ?? 2000;

  const byteRate = Math.round((sampleRate * channels * bitsPerSample) / 8);
  const blockAlign = Math.round((channels * bitsPerSample) / 8);
  const dataSize = Math.round((dataDurationMs / 1000) * byteRate);

  const buf = Buffer.alloc(44 + dataSize);
  // RIFF header
  buf.write('RIFF', 0, 4, 'ascii');
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8, 4, 'ascii');

  // fmt chunk
  buf.write('fmt ', 12, 4, 'ascii');
  buf.writeUInt32LE(16, 16); // subchunk1 size = 16 for PCM
  buf.writeUInt16LE(1, 20); // audioFormat = 1 (PCM)
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  buf.write('data', 36, 4, 'ascii');
  buf.writeUInt32LE(dataSize, 40);

  return buf;
}

function createMp3Id3Buffer(options: { tlenMs?: number }): Buffer {
  const tlenStr =
    options.tlenMs !== undefined ? options.tlenMs.toString() : '5000';
  const tlenPayload = Buffer.from(`\x00${tlenStr}`, 'latin1');
  const tlenFrameSize = tlenPayload.length;

  const id3BodySize = 10 + tlenFrameSize;
  const id3Header = Buffer.alloc(10);
  id3Header.write('ID3', 0, 3, 'ascii');
  id3Header.writeUInt8(3, 3); // ID3v2.3
  id3Header.writeUInt8(0, 4);
  id3Header.writeUInt8(0, 5); // flags
  // syncsafe size
  id3Header.writeUInt8((id3BodySize >> 21) & 0x7f, 6);
  id3Header.writeUInt8((id3BodySize >> 14) & 0x7f, 7);
  id3Header.writeUInt8((id3BodySize >> 7) & 0x7f, 8);
  id3Header.writeUInt8(id3BodySize & 0x7f, 9);

  const tlenFrameHeader = Buffer.alloc(10);
  tlenFrameHeader.write('TLEN', 0, 4, 'ascii');
  tlenFrameHeader.writeUInt32BE(tlenFrameSize, 4);
  tlenFrameHeader.writeUInt16BE(0, 8); // flags

  // MPEG Frame Header (MPEG-1 Layer 3, 128 kbps, 44.1 kHz, Stereo)
  const mpegFrame = Buffer.from([0xff, 0xfb, 0x90, 0x64]);

  return Buffer.concat([id3Header, tlenFrameHeader, tlenPayload, mpegFrame]);
}

function createMp3FrameBuffer(options: {
  withXing?: boolean;
  frames?: number;
  audioBytes?: number;
}): Buffer {
  const audioBytes = options.audioBytes ?? 16000;
  const buf = Buffer.alloc(audioBytes);

  // MPEG-1 Layer 3, 128 kbps, 44100 Hz, Stereo
  buf.writeUInt8(0xff, 0);
  buf.writeUInt8(0xfb, 1);
  buf.writeUInt8(0x90, 2);
  buf.writeUInt8(0x64, 3);

  if (options.withXing) {
    // Stereo offset for Xing in MPEG-1 is 36
    buf.write('Xing', 36, 4, 'ascii');
    buf.writeUInt32BE(0x01, 40); // flags: frames present
    buf.writeUInt32BE(options.frames ?? 200, 44); // 200 frames
  }

  return buf;
}

function createMp4Buffer(options: {
  durationSec?: number;
  timeScale?: number;
  channels?: number;
  sampleRate?: number;
}): Buffer {
  const durationSec = options.durationSec ?? 4;
  const timeScale = options.timeScale ?? 1000;
  const duration = durationSec * timeScale;
  const channels = options.channels ?? 2;
  const sampleRate = options.sampleRate ?? 48000;

  // ftyp box (20 bytes)
  const ftyp = Buffer.alloc(20);
  ftyp.writeUInt32BE(20, 0);
  ftyp.write('ftyp', 4, 4, 'ascii');
  ftyp.write('M4A ', 8, 4, 'ascii');
  ftyp.writeUInt32BE(0, 12);
  ftyp.write('isom', 16, 4, 'ascii');

  // mvhd box (32 bytes)
  const mvhd = Buffer.alloc(32);
  mvhd.writeUInt32BE(32, 0);
  mvhd.write('mvhd', 4, 4, 'ascii');
  mvhd.writeUInt8(0, 8); // version 0
  mvhd.writeUInt32BE(timeScale, 20); // timeScale
  mvhd.writeUInt32BE(duration, 24); // duration

  // trak -> mdia -> minf -> stbl -> stsd -> mp4a (40 bytes)
  const mp4a = Buffer.alloc(40);
  mp4a.writeUInt32BE(40, 0);
  mp4a.write('mp4a', 4, 4, 'ascii');
  mp4a.writeUInt16BE(channels, 24); // channels at box offset 24
  mp4a.writeUInt16BE(sampleRate, 28); // sampleRate at box offset 28

  const trak = Buffer.alloc(8 + mp4a.length);
  trak.writeUInt32BE(8 + mp4a.length, 0);
  trak.write('trak', 4, 4, 'ascii');
  mp4a.copy(trak, 8);

  const moovLen = 8 + mvhd.length + trak.length;
  const moov = Buffer.alloc(moovLen);
  moov.writeUInt32BE(moovLen, 0);
  moov.write('moov', 4, 4, 'ascii');
  mvhd.copy(moov, 8);
  trak.copy(moov, 8 + mvhd.length);

  return Buffer.concat([ftyp, moov]);
}

function createAacAdtsBuffer(options: {
  sampleRateIdx?: number;
  channelConfig?: number;
  frameCount?: number;
}): Buffer {
  const sampleRateIdx = options.sampleRateIdx ?? 4; // 44100 Hz
  const channelConfig = options.channelConfig ?? 2; // Stereo
  const frameCount = options.frameCount ?? 50;
  const frameLength = 100;

  const totalBuf = Buffer.alloc(frameCount * frameLength);

  for (let i = 0; i < frameCount; i++) {
    const offset = i * frameLength;
    totalBuf.writeUInt8(0xff, offset);
    totalBuf.writeUInt8(0xf1, offset + 1); // ADTS sync MPEG-4 AAC
    totalBuf.writeUInt8(
      (1 << 6) | ((sampleRateIdx & 0x0f) << 2) | ((channelConfig >> 2) & 1),
      offset + 2,
    );
    totalBuf.writeUInt8(
      ((channelConfig & 3) << 6) | ((frameLength >> 11) & 3),
      offset + 3,
    );
    totalBuf.writeUInt8((frameLength >> 3) & 0xff, offset + 4);
    totalBuf.writeUInt8(((frameLength & 7) << 5) | 0x1f, offset + 5);
    totalBuf.writeUInt8(0xfc, offset + 6);
  }

  return totalBuf;
}

function createWebmBuffer(options: {
  durationMs?: number;
  channels?: number;
  sampleRate?: number;
}): Buffer {
  const durationMs = options.durationMs ?? 3500;
  const channels = options.channels ?? 2;
  const sampleRate = options.sampleRate ?? 48000;

  const buf = Buffer.alloc(120);
  let offset = 0;

  // EBML Header (0x1A 0x45 0xDF 0xA3)
  buf.set([0x1a, 0x45, 0xdf, 0xa3], offset);
  offset += 4;
  buf.writeUInt8(0x84, offset++); // size 4
  buf.writeUInt32BE(0, offset); // EBML header payload
  offset += 4;

  // TimecodeScale element (0x2A 0xD7 0xB1)
  buf.set([0x2a, 0xd7, 0xb1], offset);
  offset += 3;
  buf.writeUInt8(0x84, offset++); // 4 bytes
  buf.writeUInt32BE(1000000, offset); // 1,000,000 ns = 1 ms
  offset += 4;

  // Duration element (0x44 0x89)
  buf.set([0x44, 0x89], offset);
  offset += 2;
  buf.writeUInt8(0x84, offset++); // 4 bytes float
  buf.writeFloatBE(durationMs, offset);
  offset += 4;

  // Audio track element (0xE1)
  buf.writeUInt8(0xe1, offset++);
  // Channels (0x9F)
  buf.writeUInt8(0x9f, offset++);
  buf.writeUInt8(0x81, offset++);
  buf.writeUInt8(channels, offset++);
  // SamplingFrequency (0xB5)
  buf.writeUInt8(0xb5, offset++);
  buf.writeUInt8(0x84, offset++);
  buf.writeFloatBE(sampleRate, offset);
  offset += 4;

  return buf.subarray(0, offset);
}

function createOggBuffer(options: {
  isOpus?: boolean;
  granulePos?: bigint;
  sampleRate?: number;
  channels?: number;
}): Buffer {
  const sampleRate = options.sampleRate ?? 44100;
  const channels = options.channels ?? 2;
  const granulePos = options.granulePos ?? 88200n; // 2 seconds at 44.1k

  // First page: header packet
  const page1 = Buffer.alloc(64);
  page1.write('OggS', 0, 4, 'ascii');
  page1.writeUInt8(0, 4); // version
  page1.writeUInt8(0x02, 5); // BOS flag
  page1.writeBigInt64LE(0n, 6); // granulePos = 0
  page1.writeUInt32LE(12345, 14); // serial
  page1.writeUInt32LE(0, 18); // page sequence
  page1.writeUInt32LE(0, 22); // checksum
  page1.writeUInt8(1, 26); // 1 segment
  page1.writeUInt8(30, 27); // segment length = 30

  const packetOffset = 28;
  if (options.isOpus) {
    page1.write('OpusHead', packetOffset, 8, 'ascii');
    page1.writeUInt8(1, packetOffset + 8); // version
    page1.writeUInt8(channels, packetOffset + 9);
    page1.writeUInt16LE(0, packetOffset + 10); // preSkip
    page1.writeUInt32LE(sampleRate, packetOffset + 12);
  } else {
    page1.write('\x01vorbis', packetOffset, 7, 'ascii');
    page1.writeUInt32LE(0, packetOffset + 7); // version
    page1.writeUInt8(channels, packetOffset + 11);
    page1.writeUInt32LE(sampleRate, packetOffset + 12);
    page1.writeUInt32LE(128000, packetOffset + 20); // nominal bitrate
  }

  // Second / Last page with granule position
  const page2 = Buffer.alloc(28);
  page2.write('OggS', 0, 4, 'ascii');
  page2.writeUInt8(0, 4);
  page2.writeUInt8(0x04, 5); // EOS flag
  page2.writeBigInt64LE(granulePos, 6);
  page2.writeUInt32LE(12345, 14);
  page2.writeUInt32LE(1, 18);
  page2.writeUInt32LE(0, 22);
  page2.writeUInt8(0, 26);

  return Buffer.concat([page1, page2]);
}

describe('AudioInspectorService', () => {
  const inspector = new AudioInspectorService();

  describe('WAV format inspection', () => {
    it('validates RIFF/WAVE header and extracts channels, sampleRate, and duration', () => {
      const wav = createWavBuffer({
        channels: 2,
        sampleRate: 44100,
        bitsPerSample: 16,
        dataDurationMs: 3000,
      });

      const result = inspector.inspect(wav, 'audio/wav', 'recording.wav');
      expect(result.mimeType).toBe('audio/wav');
      expect(result.channels).toBe(2);
      expect(result.sampleRate).toBe(44100);
      expect(result.durationMs).toBe(3000);
    });

    it('rejects corrupted WAV missing fmt chunk', () => {
      const corrupt = Buffer.alloc(30);
      corrupt.write('RIFF', 0, 4, 'ascii');
      corrupt.writeUInt32LE(22, 4);
      corrupt.write('WAVE', 8, 4, 'ascii');
      corrupt.write('data', 12, 4, 'ascii');
      corrupt.writeUInt32LE(10, 16);

      expect(() => inspector.inspect(corrupt)).toThrow(BadRequestError);
    });
  });

  describe('MP3 format inspection', () => {
    it('inspects MP3 with ID3v2 header and TLEN tag duration', () => {
      const mp3 = createMp3Id3Buffer({ tlenMs: 6500 });
      const result = inspector.inspect(mp3, 'audio/mpeg', 'audio.mp3');

      expect(result.mimeType).toBe('audio/mpeg');
      expect(result.durationMs).toBe(6500);
    });

    it('inspects MP3 frame sync with Xing VBR header', () => {
      const mp3 = createMp3FrameBuffer({ withXing: true, frames: 100 });
      const result = inspector.inspect(mp3);

      expect(result.mimeType).toBe('audio/mpeg');
      expect(result.channels).toBe(2);
      expect(result.sampleRate).toBe(44100);
      // 100 frames * 1152 samples / 44100 Hz = 2612 ms
      expect(result.durationMs).toBe(2612);
    });

    it('estimates MP3 duration from CBR bitrate and audio payload size', () => {
      const mp3 = createMp3FrameBuffer({ withXing: false, audioBytes: 16000 });
      const result = inspector.inspect(mp3);

      expect(result.mimeType).toBe('audio/mpeg');
      // 16000 bytes * 8 / 128000 bps * 1000 ms = 1000 ms
      expect(result.durationMs).toBe(1000);
    });
  });

  describe('M4A / MP4 format inspection', () => {
    it('inspects ISO base media ftyp box and parses mvhd duration & mp4a track', () => {
      const m4a = createMp4Buffer({
        durationSec: 4,
        timeScale: 1000,
        channels: 2,
        sampleRate: 48000,
      });

      const result = inspector.inspect(m4a, 'audio/mp4', 'track.m4a');
      expect(result.mimeType).toBe('audio/mp4');
      expect(result.durationMs).toBe(4000);
      expect(result.channels).toBe(2);
      expect(result.sampleRate).toBe(48000);
    });
  });

  describe('AAC format inspection', () => {
    it('inspects AAC ADTS sync headers and calculates duration', () => {
      const aac = createAacAdtsBuffer({
        sampleRateIdx: 4, // 44100
        channelConfig: 2,
        frameCount: 43, // ~1 second
      });

      const result = inspector.inspect(aac, 'audio/aac', 'stream.aac');
      expect(result.mimeType).toBe('audio/aac');
      expect(result.channels).toBe(2);
      expect(result.sampleRate).toBe(44100);
      expect(result.durationMs).toBe(998);
    });
  });

  describe('WebM format inspection', () => {
    it('inspects WebM EBML header, timecodeScale, duration, channels, and sampleRate', () => {
      const webm = createWebmBuffer({
        durationMs: 5200,
        channels: 2,
        sampleRate: 48000,
      });

      const result = inspector.inspect(webm, 'audio/webm', 'speech.webm');
      expect(result.mimeType).toBe('audio/webm');
      expect(result.durationMs).toBe(5200);
      expect(result.channels).toBe(2);
      expect(result.sampleRate).toBe(48000);
    });
  });

  describe('OGG format inspection', () => {
    it('inspects OGG Vorbis headers and computes duration from granule position', () => {
      const ogg = createOggBuffer({
        isOpus: false,
        sampleRate: 44100,
        channels: 2,
        granulePos: 132300n, // 3 seconds
      });

      const result = inspector.inspect(ogg, 'audio/ogg', 'sound.ogg');
      expect(result.mimeType).toBe('audio/ogg');
      expect(result.channels).toBe(2);
      expect(result.sampleRate).toBe(44100);
      expect(result.durationMs).toBe(3000);
    });

    it('inspects OGG Opus headers and computes duration at 48kHz granule position', () => {
      const ogg = createOggBuffer({
        isOpus: true,
        sampleRate: 48000,
        channels: 2,
        granulePos: 240000n, // 5 seconds
      });

      const result = inspector.inspect(ogg, 'audio/ogg', 'voice.opus');
      expect(result.mimeType).toBe('audio/ogg');
      expect(result.channels).toBe(2);
      expect(result.sampleRate).toBe(48000);
      expect(result.durationMs).toBe(5000);
    });
  });

  describe('Security and limits enforcement', () => {
    it('rejects empty audio buffer', () => {
      expect(() => inspector.inspect(Buffer.alloc(0))).toThrow(BadRequestError);
    });

    it('rejects audio exceeding 500 MB limit', () => {
      const oversized = Buffer.alloc(MAX_AUDIO_BYTES + 1);
      oversized.write('RIFF', 0, 4, 'ascii');
      oversized.write('WAVE', 8, 4, 'ascii');
      expect(() => inspector.inspect(oversized)).toThrow(BadRequestError);
    });

    it('rejects audio with duration exceeding 4 hours', () => {
      // 5 hours = 5 * 3600 * 1000 = 18,000,000 ms > 14,400,000 ms limit
      const longAudio = createMp3Id3Buffer({ tlenMs: 18_000_000 });
      expect(() => inspector.inspect(longAudio)).toThrow(BadRequestError);
    });

    it('allows audio within 4 hours limit', () => {
      const validAudio = createMp3Id3Buffer({ tlenMs: MAX_AUDIO_DURATION_MS });
      const result = inspector.inspect(validAudio);
      expect(result.durationMs).toBe(MAX_AUDIO_DURATION_MS);
    });

    it('rejects non-audio binary content', () => {
      const textBuffer = Buffer.from('Plain text content that is not audio.');
      expect(() => inspector.inspect(textBuffer)).toThrow(BadRequestError);
    });
  });

  describe('isAudioFile helper', () => {
    it('detects audio by MIME types and filenames', () => {
      expect(isAudioFile('audio/mpeg', null)).toBe(true);
      expect(isAudioFile('audio/mp4', null)).toBe(true);
      expect(isAudioFile('audio/wav', null)).toBe(true);
      expect(isAudioFile('audio/webm', null)).toBe(true);
      expect(isAudioFile('audio/ogg', null)).toBe(true);
      expect(isAudioFile('audio/aac', null)).toBe(true);
      expect(isAudioFile('audio/flac', null)).toBe(true);

      expect(isAudioFile(null, 'voice.mp3')).toBe(true);
      expect(isAudioFile(null, 'voice.m4a')).toBe(true);
      expect(isAudioFile(null, 'voice.wav')).toBe(true);
      expect(isAudioFile(null, 'voice.webm')).toBe(true);
      expect(isAudioFile(null, 'voice.aac')).toBe(true);
      expect(isAudioFile(null, 'voice.ogg')).toBe(true);
      expect(isAudioFile(null, 'voice.flac')).toBe(true);

      expect(isAudioFile('image/png', 'image.png')).toBe(false);
      expect(isAudioFile('application/pdf', 'doc.pdf')).toBe(false);
      expect(isAudioFile(null, null)).toBe(false);
    });
  });
});
