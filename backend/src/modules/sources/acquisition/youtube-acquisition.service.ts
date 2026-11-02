import { Injectable, Optional } from '@nestjs/common';
import { BadRequestError } from '../../../common/errors/domain-error';
import {
  CaptionFormat,
  CaptionParserService,
} from '../extraction/caption-parser.service';
import { YouTubeOAuthService } from './youtube-oauth.service';
import { extractYouTubeVideoId, isYouTubeUrl } from './youtube-url';
import {
  fetchMetadata as fetchYouTubeMetadata,
  fetchPublicTranscript as fetchYouTubePublicTranscript,
  PublicTranscriptResult,
  YouTubeMetadata,
} from './youtube-metadata-fetcher';

export { extractYouTubeVideoId, isYouTubeUrl };

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

  async fetchPublicTranscript(
    videoId: string,
  ): Promise<PublicTranscriptResult | null> {
    return fetchYouTubePublicTranscript(videoId, this.captionParser);
  }

  async fetchMetadata(videoId: string): Promise<YouTubeMetadata> {
    return fetchYouTubeMetadata(videoId);
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
}
