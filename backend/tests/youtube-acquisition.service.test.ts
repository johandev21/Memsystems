import { describe, expect, it, vi } from 'vitest';
import { BadRequestError } from '../src/common/errors/domain-error';
import {
  extractYouTubeVideoId,
  isYouTubeUrl,
  YouTubeAcquisitionService,
} from '../src/modules/sources/youtube-acquisition.service';
import { CaptionParserService } from '../src/modules/sources/caption-parser.service';
import { YouTubeOAuthService } from '../src/modules/sources/youtube-oauth.service';

describe('YouTubeAcquisitionService', () => {
  const captionParser = new CaptionParserService();
  const oauthService = new YouTubeOAuthService();
  const service = new YouTubeAcquisitionService(captionParser, oauthService);

  describe('URL parsing and video ID extraction', () => {
    it('extracts video ID from standard watch URL', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      expect(extractYouTubeVideoId(url)).toBe('dQw4w9WgXcQ');
      expect(isYouTubeUrl(url)).toBe(true);
    });

    it('extracts video ID from short youtu.be URL with query params', () => {
      const url = 'https://youtu.be/dQw4w9WgXcQ?t=42';
      expect(extractYouTubeVideoId(url)).toBe('dQw4w9WgXcQ');
      expect(isYouTubeUrl(url)).toBe(true);
    });

    it('extracts video ID from shorts URL', () => {
      const url = 'https://youtube.com/shorts/dQw4w9WgXcQ';
      expect(extractYouTubeVideoId(url)).toBe('dQw4w9WgXcQ');
      expect(isYouTubeUrl(url)).toBe(true);
    });

    it('extracts video ID from embed and live URLs', () => {
      expect(
        extractYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ'),
      ).toBe('dQw4w9WgXcQ');
      expect(
        extractYouTubeVideoId('https://www.youtube.com/live/dQw4w9WgXcQ'),
      ).toBe('dQw4w9WgXcQ');
      expect(
        extractYouTubeVideoId(
          'https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share',
        ),
      ).toBe('dQw4w9WgXcQ');
    });

    it('accepts raw 11-character video IDs', () => {
      expect(extractYouTubeVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(isYouTubeUrl('dQw4w9WgXcQ')).toBe(true);
    });

    it('rejects invalid non-YouTube URLs', () => {
      expect(
        extractYouTubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ'),
      ).toBeNull();
      expect(extractYouTubeVideoId('https://vimeo.com/12345678')).toBeNull();
      expect(extractYouTubeVideoId('')).toBeNull();
      expect(isYouTubeUrl('not a url')).toBe(false);
    });
  });

  describe('User-supplied caption text ingestion', () => {
    it('uses provided SRT caption text instead of making external requests', async () => {
      const srt = `1\n00:00:00,000 --> 00:00:05,000\nWelcome to custom captioned video.\n\n2\n00:00:05,500 --> 00:00:10,000\nSecond line.`;
      const result = await service.acquire('dQw4w9WgXcQ', {
        captionText: srt,
        captionFormat: 'srt',
      });

      expect(result.videoId).toBe('dQw4w9WgXcQ');
      expect(result.segments).toHaveLength(2);
      expect(result.segments[0].content).toBe(
        'Welcome to custom captioned video.',
      );
      expect(result.segments[0].startOffsetMs).toBe(0);
      expect(result.segments[0].endOffsetMs).toBe(5000);
      expect(result.durationMs).toBe(10000);
      expect(result.rawText).toContain('Welcome to custom captioned video.');
    });

    it('uses provided WebVTT caption text', async () => {
      const vtt = `WEBVTT\n\n00:01.000 --> 00:04.000\n<v Alice>Hello from VTT</v>`;
      const result = await service.acquire('https://youtu.be/dQw4w9WgXcQ', {
        captionText: vtt,
        captionFormat: 'vtt',
      });

      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].content).toBe('Hello from VTT');
      expect(result.segments[0].speaker).toBe('Alice');
    });
  });

  describe('Google OAuth authorized caption ingestion', () => {
    it('uses OAuth service to download and parse caption track', async () => {
      vi.spyOn(oauthService, 'listCaptions').mockResolvedValue([
        { id: 'c1', language: 'en', name: 'English' },
      ]);
      vi.spyOn(oauthService, 'downloadCaption').mockResolvedValue(
        `1\n00:00:01,000 --> 00:00:04,000\nOAuth downloaded caption text`,
      );
      vi.spyOn(oauthService, 'getVideoMetadata').mockResolvedValue({
        videoId: 'dQw4w9WgXcQ',
        title: 'OAuth Title',
        channelTitle: 'OAuth Channel',
        durationMs: 4000,
      });

      const result = await service.acquire('dQw4w9WgXcQ', {
        oauthToken: 'valid-oauth-token',
      });

      expect(result.title).toBe('OAuth Title');
      expect(result.author).toBe('OAuth Channel');
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].content).toBe('OAuth downloaded caption text');
    });
  });

  describe('Caption data parsing', () => {
    it('parses JSON3 timed caption events with correct offsets', () => {
      const json3Payload = JSON.stringify({
        events: [
          {
            tStartMs: 0,
            dDurationMs: 2500,
            segs: [{ utf8: 'Hello world' }, { utf8: ' and welcome.' }],
          },
          {
            tStartMs: 3000,
            dDurationMs: 4000,
            segs: [{ utf8: 'Today we discuss distributed systems.' }],
          },
        ],
      });

      const segments = service.parseJson3Captions(json3Payload);
      expect(segments).toHaveLength(2);
      expect(segments[0]).toEqual({
        content: 'Hello world and welcome.',
        startOffsetMs: 0,
        endOffsetMs: 2500,
      });
      expect(segments[1]).toEqual({
        content: 'Today we discuss distributed systems.',
        startOffsetMs: 3000,
        endOffsetMs: 7000,
      });
    });

    it('parses XML timed caption tags and decodes entities', () => {
      const xmlPayload = `
        <transcript>
          <text start="1.5" dur="3.0">Welcome to &amp;quot;Memsystems&amp;quot; &amp;amp; AI</text>
          <text start="5.0" dur="2.5">Let&#39;s dive into the code.</text>
        </transcript>
      `;

      const segments = service.parseXmlCaptions(xmlPayload);
      expect(segments).toHaveLength(2);
      expect(segments[0]).toEqual({
        content: 'Welcome to "Memsystems" & AI',
        startOffsetMs: 1500,
        endOffsetMs: 4500,
      });
      expect(segments[1]).toEqual({
        content: "Let's dive into the code.",
        startOffsetMs: 5000,
        endOffsetMs: 7500,
      });
    });
  });

  describe('Video metadata acquisition without auto transcripts', () => {
    it('returns empty segments and empty rawText when no captions are provided', async () => {
      vi.spyOn(service, 'fetchMetadata').mockResolvedValue({
        title: 'Rick Astley - Never Gonna Give You Up',
        author: 'RickAstleyVEVO',
        durationMs: 213000,
        thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      });

      const result = await service.acquire(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      );

      expect(result.videoId).toBe('dQw4w9WgXcQ');
      expect(result.title).toBe('Rick Astley - Never Gonna Give You Up');
      expect(result.author).toBe('RickAstleyVEVO');
      expect(result.durationMs).toBe(213000);
      expect(result.segments).toEqual([]);
      expect(result.rawText).toBe('');
    });

    it('throws BadRequestError when given an invalid URL', async () => {
      await expect(
        service.acquire('https://invalid-domain.com/video'),
      ).rejects.toThrow(BadRequestError);
    });
  });
});
