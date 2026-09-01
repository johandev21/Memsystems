/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Injectable } from '@nestjs/common';
import { BadRequestError } from '../../common/errors/domain-error';

export interface YouTubeCaptionTrack {
  id: string;
  language: string;
  name?: string;
  trackKind?: string;
  isDraft?: boolean;
  isAutoSynced?: boolean;
  lastUpdated?: string;
}

export interface YouTubeVideoMetadata {
  videoId: string;
  title: string;
  channelTitle?: string;
  description?: string;
  durationMs?: number;
  publishedAt?: string;
  thumbnailUrl?: string;
}

/** Parses ISO 8601 duration format (e.g., "PT1H2M10S", "PT15M33S", "PT45S") to milliseconds. */
export function parseIso8601Duration(durationStr: string): number | undefined {
  if (!durationStr || typeof durationStr !== 'string') return undefined;
  const match = durationStr.match(
    /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/i,
  );
  if (!match) return undefined;

  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const seconds = match[3] ? parseFloat(match[3]) : 0;

  return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
}

@Injectable()
export class YouTubeOAuthService {
  /**
   * Fetches the list of caption tracks for a video via YouTube Data API v3.
   * Requires OAuth access token with caption permissions (e.g., youtube.force-ssl or youtube.readonly).
   */
  async listCaptions(
    videoId: string,
    accessToken: string,
  ): Promise<YouTubeCaptionTrack[]> {
    if (!accessToken) {
      throw new BadRequestError(
        'OAuth access token is required to list YouTube captions',
      );
    }

    const url = `https://www.googleapis.com/youtube/v3/captions?videoId=${videoId}&part=snippet`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new BadRequestError(
        `Failed to list YouTube captions (HTTP ${response.status}): ${errorBody || response.statusText}`,
      );
    }

    const data = (await response.json()) as { items?: any[] };
    const items = data.items || [];

    return items.map((item: any) => ({
      id: item.id,
      language: item.snippet?.language || 'en',
      name: item.snippet?.name,
      trackKind: item.snippet?.trackKind,
      isDraft: item.snippet?.isDraft,
      isAutoSynced: item.snippet?.isAutoSynced,
      lastUpdated: item.snippet?.lastUpdated,
    }));
  }

  /**
   * Downloads an authorized caption track content (in SRT or VTT format).
   */
  async downloadCaption(
    captionId: string,
    accessToken: string,
    format: 'srt' | 'vtt' = 'srt',
  ): Promise<string> {
    if (!accessToken) {
      throw new BadRequestError(
        'OAuth access token is required to download YouTube caption',
      );
    }

    const url = `https://www.googleapis.com/youtube/v3/captions/${captionId}?tfmt=${format}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new BadRequestError(
        `Failed to download YouTube caption track ${captionId} (HTTP ${response.status}): ${errorBody || response.statusText}`,
      );
    }

    return response.text();
  }

  /**
   * Fetches official video metadata via YouTube Data API v3.
   */
  async getVideoMetadata(
    videoId: string,
    auth: { accessToken?: string; apiKey?: string } = {},
  ): Promise<YouTubeVideoMetadata | null> {
    let url = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails`;
    const headers: Record<string, string> = { Accept: 'application/json' };

    if (auth.accessToken) {
      headers.Authorization = `Bearer ${auth.accessToken}`;
    } else if (auth.apiKey) {
      url += `&key=${auth.apiKey}`;
    } else {
      return null;
    }

    try {
      const response = await fetch(url, { headers });
      if (!response.ok) return null;

      const data = (await response.json()) as { items?: any[] };
      const item = data.items?.[0];
      if (!item) return null;

      const durationMs = item.contentDetails?.duration
        ? parseIso8601Duration(item.contentDetails.duration)
        : undefined;

      const snippet = item.snippet || {};
      const thumbnailUrl =
        snippet.thumbnails?.maxres?.url ||
        snippet.thumbnails?.standard?.url ||
        snippet.thumbnails?.high?.url ||
        snippet.thumbnails?.default?.url;

      return {
        videoId,
        title: snippet.title || `YouTube Video (${videoId})`,
        channelTitle: snippet.channelTitle,
        description: snippet.description,
        durationMs,
        publishedAt: snippet.publishedAt,
        thumbnailUrl,
      };
    } catch {
      return null;
    }
  }
}
