import { CaptionParserService } from '../extraction/caption-parser.service';
import type { YouTubeSegment } from './youtube-acquisition.service';

export interface YouTubeMetadata {
  title: string;
  author?: string;
  durationMs?: number;
  thumbnailUrl?: string;
}

export interface PublicTranscriptResult {
  title?: string;
  author?: string;
  durationMs?: number;
  thumbnailUrl?: string;
  segments: YouTubeSegment[];
}

export function decodeXmlEntities(str: string): string {
  let decoded = str;
  for (let pass = 0; pass < 2; pass++) {
    decoded = decoded
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#(\d+);/g, (_, code: string) =>
        String.fromCharCode(Number(code)),
      )
      .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) =>
        String.fromCharCode(parseInt(code, 16)),
      )
      .replace(/&amp;/g, '&');
  }
  return decoded;
}

export function extractHtmlTag(html: string, tagName: string): string | null {
  const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = html.match(re);
  return match ? decodeXmlEntities(match[1].trim()) : null;
}

export function extractMetaContent(html: string, name: string): string | null {
  const re = new RegExp(
    `<meta\\s+(?:name|property)=["'](?:${name}|og:${name})["']\\s+content=["']([^"']*)["']`,
    'i',
  );
  const match = html.match(re);
  return match ? decodeXmlEntities(match[1].trim()) : null;
}

export function selectPreferredCaptionTrack(
  tracks: Array<{ baseUrl?: string; languageCode?: string; kind?: string }>,
): { baseUrl?: string; languageCode?: string; kind?: string } | undefined {
  const isLang = (track: { languageCode?: string }, prefix: string): boolean =>
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

export function coalesceSegments(segments: YouTubeSegment[]): YouTubeSegment[] {
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

    if (sameSpeaker && combinedLength <= 320 && combinedDurationMs <= 25_000) {
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

interface InnerTubePlayerData {
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
}

interface InitialPlayerResponse {
  videoDetails?: {
    title?: string;
    author?: string;
    lengthSeconds?: string | number;
  };
}

export async function fetchPublicTranscript(
  videoId: string,
  captionParser: CaptionParserService,
): Promise<PublicTranscriptResult | null> {
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

    const playerData = (await playerRes.json()) as InnerTubePlayerData;
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

    const track = selectPreferredCaptionTrack(captionTracks);
    if (!track || typeof track.baseUrl !== 'string') {
      return null;
    }

    const transcriptUrl = track.baseUrl.replace(/&fmt=srv3/g, '');
    const transcriptRes = await fetch(transcriptUrl, {
      headers: androidHeaders,
    });
    if (!transcriptRes.ok) return null;

    const captionPayload = await transcriptRes.text();
    const rawSegments = captionParser.parse(captionPayload, 'auto');
    if (rawSegments.length === 0) return null;

    const segments = coalesceSegments(rawSegments);
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

export async function fetchMetadata(videoId: string): Promise<YouTubeMetadata> {
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
      let playerResponse: InitialPlayerResponse | null = null;
      if (playerResponseMatch && playerResponseMatch[1]) {
        try {
          playerResponse = JSON.parse(
            playerResponseMatch[1],
          ) as InitialPlayerResponse;
        } catch {
          void 0;
        }
      }
      const videoDetails = playerResponse?.videoDetails;
      const title =
        videoDetails?.title ||
        extractHtmlTag(html, 'title')?.replace(' - YouTube', '').trim() ||
        `YouTube Video (${videoId})`;
      const author =
        videoDetails?.author || extractMetaContent(html, 'author') || undefined;
      const durationSeconds = videoDetails?.lengthSeconds
        ? parseInt(String(videoDetails.lengthSeconds), 10)
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
