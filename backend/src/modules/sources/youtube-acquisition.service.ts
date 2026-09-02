/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Injectable, Optional } from '@nestjs/common';
import { BadRequestError } from '../../common/errors/domain-error';
import { CaptionFormat, CaptionParserService } from './caption-parser.service';
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
    // Not a standard URL
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
      );
    }

    const fallbackOnError = options.fallbackOnError ?? true;

    // Mode 1: User-supplied caption / transcript text
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
          );
        }
      }
    }

    // Mode 2: Google OAuth token authorized caption download
    if (options.oauthToken) {
      try {
        const tracks = await this.youtubeOAuth.listCaptions(
          videoId,
          options.oauthToken,
        );
        if (tracks.length > 0) {
          // Prefer English track or first available
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
          );
        }
      }
    }

    // Mode 3: No custom captions or OAuth token provided.
    // We do NOT scrape captions or generate fake transcripts.
    // Instead, we fetch video metadata (title, author, duration, thumbnail)
    // and return an empty segments array so the video viewer is clean.
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

  async fetchMetadata(videoId: string): Promise<{
    title: string;
    author?: string;
    durationMs?: number;
    thumbnailUrl?: string;
  }> {
    // 1. Try YouTube oEmbed first (fast, public, unauthenticated, never IP-blocked)
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
      // Fall through to watch page scraping or default
    }

    // 2. Try watch page title extraction
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
            // ignore
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
      // Fall through
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
