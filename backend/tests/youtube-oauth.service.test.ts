import { describe, expect, it, vi } from 'vitest';
import { BadRequestError } from '../src/common/errors/domain-error';
import {
  parseIso8601Duration,
  YouTubeOAuthService,
} from '../src/modules/sources/youtube-oauth.service';

describe('YouTubeOAuthService', () => {
  const service = new YouTubeOAuthService();

  describe('parseIso8601Duration', () => {
    it('parses hours, minutes, and seconds', () => {
      expect(parseIso8601Duration('PT1H2M30S')).toBe(3750000);
      expect(parseIso8601Duration('PT15M33S')).toBe(933000);
      expect(parseIso8601Duration('PT45S')).toBe(45000);
      expect(parseIso8601Duration('PT2H')).toBe(7200000);
    });

    it('returns undefined for invalid format', () => {
      expect(parseIso8601Duration('')).toBeUndefined();
      expect(parseIso8601Duration('12:34')).toBeUndefined();
    });
  });

  describe('listCaptions', () => {
    it('throws BadRequestError if no access token is provided', async () => {
      await expect(service.listCaptions('dQw4w9WgXcQ', '')).rejects.toThrow(
        BadRequestError,
      );
    });

    it('fetches and maps caption tracks when authorized', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'caption-123',
              snippet: {
                language: 'en',
                name: 'English (Original)',
                trackKind: 'standard',
                isDraft: false,
                isAutoSynced: false,
              },
            },
          ],
        }),
      });
      global.fetch = mockFetch;

      const tracks = await service.listCaptions('dQw4w9WgXcQ', 'mock-token');
      expect(tracks).toHaveLength(1);
      expect(tracks[0]).toEqual({
        id: 'caption-123',
        language: 'en',
        name: 'English (Original)',
        trackKind: 'standard',
        isDraft: false,
        isAutoSynced: false,
        lastUpdated: undefined,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('videoId=dQw4w9WgXcQ'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token',
          }),
        }),
      );
    });
  });

  describe('downloadCaption', () => {
    it('downloads caption text via official caption API endpoint', async () => {
      const sampleSrt = `1\n00:00:01,000 --> 00:00:03,000\nSample text\n`;
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => sampleSrt,
      });
      global.fetch = mockFetch;

      const content = await service.downloadCaption(
        'caption-123',
        'mock-token',
        'srt',
      );
      expect(content).toBe(sampleSrt);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/youtube/v3/captions/caption-123?tfmt=srt',
        expect.objectContaining({
          headers: { Authorization: 'Bearer mock-token' },
        }),
      );
    });
  });

  describe('getVideoMetadata', () => {
    it('fetches metadata and duration via YouTube Data API', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'dQw4w9WgXcQ',
              snippet: {
                title: 'Official Music Video',
                channelTitle: 'Rick Astley',
                description: 'Classic song',
                publishedAt: '2009-10-25T06:57:33Z',
                thumbnails: {
                  high: {
                    url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
                  },
                },
              },
              contentDetails: {
                duration: 'PT3M33S',
              },
            },
          ],
        }),
      });
      global.fetch = mockFetch;

      const meta = await service.getVideoMetadata('dQw4w9WgXcQ', {
        accessToken: 'mock-token',
      });
      expect(meta).toEqual({
        videoId: 'dQw4w9WgXcQ',
        title: 'Official Music Video',
        channelTitle: 'Rick Astley',
        description: 'Classic song',
        durationMs: 213000,
        publishedAt: '2009-10-25T06:57:33Z',
        thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      });
    });
  });
});
