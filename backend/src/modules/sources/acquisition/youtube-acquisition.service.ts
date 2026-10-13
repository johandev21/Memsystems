/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Injectable, Optional } from '@nestjs/common';
import { BadRequestError } from '../../../common/errors/domain-error';
import {
  CaptionFormat,
  CaptionParserService,
} from '../extraction/caption-parser.service';
import { YouTubeOAuthService } from './youtube-oauth.service';

export interface YouTubeSegment {
  content: string;
  startOffsetMs: number;
  endOffsetMs: number;
  speaker?: string;
}

export interface YouTubeAcquisitionResult {
  videoId: string;
  title: string;
  author?: string;
  durationMs?: number;
  segments: YouTubeSegment[];
  rawText: string;
  warnings?: string[];
  thumbnailUrl?: string;
}

export interface YouTubeAcquisitionOptions {
  fallbackOnError?: boolean;
  oauthToken?: string;
  captionText?: string;
  captionFormat?: CaptionFormat;
}

const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

const YOUTUBE_URL_PATTERNS = [
  /(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/i,
  /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/i,
  /(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i,
  /(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/i,
  /(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})/i,
  /(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/live\/([a-zA-Z0-9_-]{11})/i,
];

export function extractYouTubeVideoId(urlOrId: string): string | null {
  if (!urlOrId || typeof urlOrId !== 'string') {
    return null;
  }

  const trimmed = urlOrId.trim();
  if (YOUTUBE_ID_RE.test(trimmed)) {
    return trimmed;
  }

  for (const pattern of YOUTUBE_URL_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match && match[1] && YOUTUBE_ID_RE.test(match[1])) {
      return match[1];
    }
  }

  try {
    const parsed = new URL(trimmed);
    if (
      parsed.hostname === 'youtube.com' ||
      parsed.hostname === 'www.youtube.com' ||
      parsed.hostname === 'm.youtube.com'
    ) {
      const v = parsed.searchParams.get('v');
      if (v && YOUTUBE_ID_RE.test(v)) {
        return v;
      }
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (
        (parts[0] === 'shorts' ||
          parts[0] === 'embed' ||
          parts[0] === 'v' ||
          parts[0] === 'live') &&
        parts[1] &&
        YOUTUBE_ID_RE.test(parts[1])
      ) {
        return parts[1];
      }
    }
    if (parsed.hostname === 'youtu.be') {
      const id = parsed.pathname.replace(/^\//, '').split('/')[0];
      if (id && YOUTUBE_ID_RE.test(id)) {
        return id;
      }
    }
  } catch {
    void 0;
  }

  return null;
}

export function isYouTubeUrl(urlOrId: string): boolean {
  return extractYouTubeVideoId(urlOrId) !== null;
}

function decodeXmlEntities(str: string): string {
  let decoded = str;
  for (let pass = 0; pass < 2; pass++) {
    decoded = decoded
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, code) =>
        String.fromCharCode(parseInt(code, 16)),
      )
      .replace(/&amp;/g, '&');
  }
  return decoded;
}

@Injectable()
export class YouTubeAcquisitionService {
  private readonly captionParser: CaptionParserService;
  private readonly youtubeOAuth: YouTubeOAuthService;

  constructor(
    @Optional() captionParser?: CaptionParserService,
    @Optional() youtubeOAuth?: YouTubeOAuthService,
  ) {
    this.captionParser = captionParser ?? new CaptionParserService();
    this.youtubeOAuth = youtubeOAuth ?? new YouTubeOAuthService();
  }

  isYouTubeUrl(url: string): boolean {
    return isYouTubeUrl(url);
  }

  extractVideoId(url: string): string | null {
    return extractYouTubeVideoId(url);
  }

  async acquire(
    urlOrVideoId: string,
    options: YouTubeAcquisitionOptions = {},
  ): Promise<YouTubeAcquisitionResult> {
    const videoId = this.extractVideoId(urlOrVideoId);
    if (!videoId) {
      throw new BadRequestError(
        `Invalid YouTube URL or video ID: "${urlOrVideoId}"`,
        {
          messageKey: 'errors.sources.youtube.invalidUrl',
          params: { url: urlOrVideoId },
        },
      );
    }

    const fallbackOnError = options.fallbackOnError ?? true;

    if (options.captionText && options.captionText.trim().length > 0) {
      try {
        const segments = this.captionParser.parse(
          options.captionText,
          options.captionFormat ?? 'auto',
        );
        if (segments.length > 0) {
          const rawText = segments.map((s) => s.content).join('\n\n');
          const durationMs = segments[segments.length - 1].endOffsetMs;
          return {
            videoId,
            title: `YouTube Video (${videoId})`,
            durationMs,
            segments,
            rawText,
          };
        }
      } catch (err) {
        if (!fallbackOnError) {
          throw new BadRequestError(
            `Failed to parse user-provided caption: ${err instanceof Error ? err.message : String(err)}`,
            {
              messageKey: 'errors.sources.youtube.captionParseFailed',
              params: {
                reason: err instanceof Error ? err.message : String(err),
              },
            },
          );
        }
      }
    }

    if (options.oauthToken) {
      try {
        const tracks = await this.youtubeOAuth.listCaptions(
          videoId,
          options.oauthToken,
        );
        if (tracks.length > 0) {
          const track =
            tracks.find(
              (t) =>
                t.language === 'en' ||
                t.language.startsWith('en') ||
                t.language === 'en-US',
            ) || tracks[0];

          const srtData = await this.youtubeOAuth.downloadCaption(
            track.id,
            options.oauthToken,
            'srt',
          );
          const segments = this.captionParser.parseSrt(srtData);

          const meta = await this.youtubeOAuth
            .getVideoMetadata(videoId, { accessToken: options.oauthToken })
            .catch(() => null);

          const title = meta?.title || `YouTube Video (${videoId})`;
          const author = meta?.channelTitle;
          const durationMs =
            meta?.durationMs ??
            (segments.length > 0
              ? segments[segments.length - 1].endOffsetMs
              : undefined);
          const rawText = segments.map((s) => s.content).join('\n\n');

          return {
            videoId,
            title,
            author,
            durationMs,
            segments,
            rawText,
            thumbnailUrl: meta?.thumbnailUrl,
          };
        }
      } catch (err) {
        if (!fallbackOnError) {
          throw new BadRequestError(
            `OAuth caption acquisition failed: ${err instanceof Error ? err.message : String(err)}`,
            {
              messageKey: 'errors.sources.youtube.oauthCaptionFailed',
              params: {
                reason: err instanceof Error ? err.message : String(err),
              },
            },
          );
        }
      }
    }

    const publicTranscript = await this.fetchPublicTranscript(videoId);
    if (publicTranscript && publicTranscript.segments.length > 0) {
      const needsMetadataFallback =
        !publicTranscript.title ||
        publicTranscript.title === `YouTube Video (${videoId})`;
      const meta = needsMetadataFallback
        ? await this.fetchMetadata(videoId)
        : null;
      const title =
        publicTranscript.title && !needsMetadataFallback
          ? publicTranscript.title
          : meta?.title || `YouTube Video (${videoId})`;
      const author = publicTranscript.author ?? meta?.author;
      const durationMs =
        publicTranscript.durationMs ??
        meta?.durationMs ??
        publicTranscript.segments[publicTranscript.segments.length - 1]
          .endOffsetMs;
      const thumbnailUrl =
        publicTranscript.thumbnailUrl ||
        meta?.thumbnailUrl ||
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      const rawText = publicTranscript.segments
        .map((s) => s.content)
        .join('\n\n');

      return {
        videoId,
        title,
        author,
        durationMs,
        thumbnailUrl,
        segments: publicTranscript.segments,
        rawText,
      };
    }

    const meta = await this.fetchMetadata(videoId);
    return {
      videoId,
      title: meta.title,
      author: meta.author,
      durationMs: meta.durationMs,
      thumbnailUrl: meta.thumbnailUrl,
      segments: [],
      rawText: '',
    };
  }

  async fetchPublicTranscript(videoId: string): Promise<{
    title?: string;
    author?: string;
    durationMs?: number;
    thumbnailUrl?: string;
    segments: YouTubeSegment[];
  } | null> {
    try {
      const androidHeaders: Record<string, string> = {
        'User-Agent':
          'com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip',
        'Accept-Language': 'en-US,en;q=0.9',
      };

      const playerUrl =
        'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
      const playerRes = await fetch(playerUrl, {
        method: 'POST',
        headers: {
          ...androidHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'ANDROID',
              clientVersion: '20.10.38',
            },
          },
          videoId,
        }),
      });
      if (!playerRes.ok) return null;

      const playerData = (await playerRes.json()) as {
        videoDetails?: {
          title?: string;
          author?: string;
          lengthSeconds?: string | number;
        };
        captions?: {
          playerCaptionsTracklistRenderer?: {
            captionTracks?: Array<{
              baseUrl?: string;
              languageCode?: string;
              kind?: string;
            }>;
          };
        };
      };
      const videoDetails = playerData?.videoDetails;
      const title =
        typeof videoDetails?.title === 'string' && videoDetails.title.trim()
          ? videoDetails.title.trim()
          : undefined;
      const author =
        typeof videoDetails?.author === 'string' && videoDetails.author.trim()
          ? videoDetails.author.trim()
          : undefined;
      const durationSeconds = videoDetails?.lengthSeconds
        ? parseInt(String(videoDetails.lengthSeconds), 10)
        : undefined;
      const durationMs =
        durationSeconds && !isNaN(durationSeconds)
          ? durationSeconds * 1000
          : undefined;

      const captionTracks =
        playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!Array.isArray(captionTracks) || captionTracks.length === 0) {
        return null;
      }

      const track = this.selectPreferredCaptionTrack(captionTracks);
      if (!track || typeof track.baseUrl !== 'string') {
        return null;
      }

      const transcriptUrl = track.baseUrl.replace(/&fmt=srv3/g, '');
      const transcriptRes = await fetch(transcriptUrl, {
        headers: androidHeaders,
      });
      if (!transcriptRes.ok) return null;

      const captionPayload = await transcriptRes.text();
      const rawSegments = this.captionParser.parse(captionPayload, 'auto');
      if (rawSegments.length === 0) return null;

      const segments = this.coalesceSegments(rawSegments);
      return {
        title,
        author,
        durationMs,
        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        segments,
      };
    } catch {
      return null;
    }
  }

  private selectPreferredCaptionTrack(
    tracks: Array<{ baseUrl?: string; languageCode?: string; kind?: string }>,
  ): { baseUrl?: string; languageCode?: string; kind?: string } | undefined {
    const isLang = (
      track: { languageCode?: string },
      prefix: string,
    ): boolean =>
      typeof track?.languageCode === 'string' &&
      (track.languageCode === prefix ||
        track.languageCode.startsWith(`${prefix}-`));

    return (
      tracks.find((t) => t.kind !== 'asr' && isLang(t, 'en')) ||
      tracks.find((t) => isLang(t, 'en')) ||
      tracks.find((t) => t.kind !== 'asr' && isLang(t, 'es')) ||
      tracks.find((t) => isLang(t, 'es')) ||
      tracks.find((t) => t.kind !== 'asr') ||
      tracks[0]
    );
  }

  private coalesceSegments(segments: YouTubeSegment[]): YouTubeSegment[] {
    if (segments.length <= 4) {
      return segments;
    }

    const merged: YouTubeSegment[] = [];
    let current: YouTubeSegment = { ...segments[0] };

    for (let i = 1; i < segments.length; i++) {
      const next = segments[i];
      const sameSpeaker = current.speaker === next.speaker;
      const combinedLength = current.content.length + 1 + next.content.length;
      const combinedDurationMs = next.endOffsetMs - current.startOffsetMs;

      if (
        sameSpeaker &&
        combinedLength <= 320 &&
        combinedDurationMs <= 25_000
      ) {
        current.content = `${current.content} ${next.content}`.trim();
        current.endOffsetMs = Math.max(current.endOffsetMs, next.endOffsetMs);
      } else {
        merged.push(current);
        current = { ...next };
      }
    }
    merged.push(current);
    return merged;
  }

  async fetchMetadata(videoId: string): Promise<{
    title: string;
    author?: string;
    durationMs?: number;
    thumbnailUrl?: string;
  }> {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const res = await fetch(oembedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (res.ok) {
        const data = (await res.json()) as {
          title?: string;
          author_name?: string;
          thumbnail_url?: string;
        };
        if (data.title) {
          return {
            title: data.title,
            author: data.author_name,
            thumbnailUrl:
              data.thumbnail_url ||
              `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          };
        }
      }
    } catch {
      void 0;
    }

    try {
      const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const response = await fetch(watchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      if (response.ok) {
        const html = await response.text();
        const playerResponseMatch =
          html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/s) ||
          html.match(/var\s+ytInitialPlayerResponse\s*=\s*({.+?});/s);
        let playerResponse: any = null;
        if (playerResponseMatch && playerResponseMatch[1]) {
          try {
            playerResponse = JSON.parse(playerResponseMatch[1]);
          } catch {
            void 0;
          }
        }
        const videoDetails = playerResponse?.videoDetails;
        const title =
          videoDetails?.title ||
          this.extractHtmlTag(html, 'title')
            ?.replace(' - YouTube', '')
            .trim() ||
          `YouTube Video (${videoId})`;
        const author =
          videoDetails?.author ||
          this.extractMetaContent(html, 'author') ||
          undefined;
        const durationSeconds = videoDetails?.lengthSeconds
          ? parseInt(videoDetails.lengthSeconds, 10)
          : undefined;
        const durationMs =
          durationSeconds && !isNaN(durationSeconds)
            ? durationSeconds * 1000
            : undefined;

        return {
          title,
          author,
          durationMs,
          thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        };
      }
    } catch {
      void 0;
    }

    return {
      title: `YouTube Video (${videoId})`,
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };
  }

  parseCaptionData(captionData: string): YouTubeSegment[] {
    return this.captionParser.parse(captionData, 'auto');
  }

  parseJson3Captions(jsonStr: string): YouTubeSegment[] {
    return this.captionParser.parseJson3(jsonStr);
  }

  parseXmlCaptions(xmlStr: string): YouTubeSegment[] {
    return this.captionParser.parseXml(xmlStr);
  }

  private extractHtmlTag(html: string, tagName: string): string | null {
    const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
    const match = html.match(re);
    return match ? decodeXmlEntities(match[1].trim()) : null;
  }

  private extractMetaContent(html: string, name: string): string | null {
    const re = new RegExp(
      `<meta\\s+(?:name|property)=["'](?:${name}|og:${name})["']\\s+content=["']([^"']*)["']`,
      'i',
    );
    const match = html.match(re);
    return match ? decodeXmlEntities(match[1].trim()) : null;
  }
}
