/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, prefer-const */
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

    // Mode 3: Public watch page & timedtext acquisition
    try {
      return await this.fetchYouTubeData(videoId);
    } catch (err) {
      if (!fallbackOnError) {
        if (err instanceof BadRequestError) {
          throw err;
        }
        throw new BadRequestError(
          `Failed to acquire YouTube transcript: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      const fallback = this.generateMockTranscript(
        videoId,
        undefined,
        undefined,
        undefined,
      );
      return {
        ...fallback,
        warnings: [
          `Failed to fetch YouTube data (${err instanceof Error ? err.message : String(err)}), used fallback transcript.`,
        ],
      };
    }
  }

  private async fetchYouTubeData(
    videoId: string,
  ): Promise<YouTubeAcquisitionResult> {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(watchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} when fetching YouTube page`);
    }

    const html = await response.text();

    // Extract ytInitialPlayerResponse
    const playerResponseMatch =
      html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/s) ||
      html.match(/var\s+ytInitialPlayerResponse\s*=\s*({.+?});/s);

    let playerResponse: any = null;
    if (playerResponseMatch && playerResponseMatch[1]) {
      try {
        playerResponse = JSON.parse(playerResponseMatch[1]);
      } catch {
        // Ignore parse error, fallback to regex
      }
    }

    const videoDetails = playerResponse?.videoDetails;
    let title =
      videoDetails?.title ||
      this.extractHtmlTag(html, 'title')?.replace(' - YouTube', '').trim() ||
      `YouTube Video ${videoId}`;
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

    const captionTracks =
      playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!Array.isArray(captionTracks) || captionTracks.length === 0) {
      // Try timedtext API fallback per spec before mock
      const timedResult = await this.fetchTimedTextCaptions(
        videoId,
        title,
        author,
        durationMs,
      );
      if (timedResult) return timedResult;
      const mock = this.generateMockTranscript(
        videoId,
        title,
        author,
        durationMs,
      );
      return {
        ...mock,
        warnings: [
          'Captions unavailable via player response and timedtext, used fallback transcript.',
        ],
      };
    }

    // Pick English caption track or first track
    const track =
      captionTracks.find(
        (t: any) => t.languageCode === 'en' || t.languageCode?.startsWith('en'),
      ) || captionTracks[0];

    if (!track?.baseUrl) {
      const timedResult = await this.fetchTimedTextCaptions(
        videoId,
        title,
        author,
        durationMs,
      );
      if (timedResult) return timedResult;
      const mock = this.generateMockTranscript(
        videoId,
        title,
        author,
        durationMs,
      );
      return {
        ...mock,
        warnings: ['Caption track URL unavailable, used fallback transcript.'],
      };
    }

    // Fetch caption XML or JSON3
    const captionUrl = track.baseUrl.includes('fmt=')
      ? track.baseUrl
      : `${track.baseUrl}&fmt=json3`;

    const captionRes = await fetch(captionUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!captionRes.ok) {
      const timedResult = await this.fetchTimedTextCaptions(
        videoId,
        title,
        author,
        durationMs,
      );
      if (timedResult) return timedResult;
      const mock = this.generateMockTranscript(
        videoId,
        title,
        author,
        durationMs,
      );
      return {
        ...mock,
        warnings: [
          `Caption fetch failed (HTTP ${captionRes.status}), used fallback transcript.`,
        ],
      };
    }

    const captionData = await captionRes.text();
    const segments = this.parseCaptionData(captionData);

    if (segments.length === 0) {
      const timedResult = await this.fetchTimedTextCaptions(
        videoId,
        title,
        author,
        durationMs,
      );
      if (timedResult) return timedResult;
      const mock = this.generateMockTranscript(
        videoId,
        title,
        author,
        durationMs,
      );
      return {
        ...mock,
        warnings: ['Caption data empty, used fallback transcript.'],
      };
    }

    const rawText = segments.map((s) => s.content).join('\n\n');

    return {
      videoId,
      title,
      author,
      durationMs:
        durationMs ??
        (segments.length > 0
          ? segments[segments.length - 1].endOffsetMs
          : undefined),
      segments,
      rawText,
    };
  }

  private async fetchTimedTextCaptions(
    videoId: string,
    title: string,
    author: string | undefined,
    durationMs: number | undefined,
  ): Promise<YouTubeAcquisitionResult | null> {
    try {
      const timedUrl = `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}`;
      const res = await fetch(timedUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      if (!res.ok) return null;
      const xml = await res.text();
      const segments = this.parseXmlCaptions(xml);
      if (segments.length === 0) return null;
      const rawText = segments.map((s) => s.content).join('\n\n');
      return {
        videoId,
        title,
        author,
        durationMs: durationMs ?? segments[segments.length - 1].endOffsetMs,
        segments,
        rawText,
      };
    } catch {
      return null;
    }
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

  generateMockTranscript(
    videoId: string,
    title?: string,
    author?: string,
    durationMs?: number,
  ): YouTubeAcquisitionResult {
    const effectiveTitle = title || `YouTube Video (${videoId})`;
    const effectiveAuthor = author || 'YouTube Creator';
    const effectiveDurationMs = durationMs || 60_000;

    const segCount = 4;
    const interval = Math.floor(effectiveDurationMs / segCount);

    const segments: YouTubeSegment[] = [
      {
        content: `Welcome back to the channel. Today we are discussing ${effectiveTitle}.`,
        startOffsetMs: 0,
        endOffsetMs: interval,
        speaker: effectiveAuthor,
      },
      {
        content: `In the first part of this video, we explore the core concepts and architectural foundations.`,
        startOffsetMs: interval,
        endOffsetMs: interval * 2,
        speaker: effectiveAuthor,
      },
      {
        content: `Next, let's take a deep dive into practical implementation steps and key takeaways.`,
        startOffsetMs: interval * 2,
        endOffsetMs: interval * 3,
        speaker: effectiveAuthor,
      },
      {
        content: `Thank you for watching! Be sure to like, subscribe, and leave your questions in the comments below.`,
        startOffsetMs: interval * 3,
        endOffsetMs: effectiveDurationMs,
        speaker: effectiveAuthor,
      },
    ];

    const rawText = segments.map((s) => s.content).join('\n\n');

    return {
      videoId,
      title: effectiveTitle,
      author: effectiveAuthor,
      durationMs: effectiveDurationMs,
      segments,
      rawText,
    };
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
