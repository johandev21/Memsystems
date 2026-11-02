import { Injectable } from '@nestjs/common';
import { BadRequestError } from '../../../common/errors/domain-error';
import {
  detectVideoMimeType,
  extractVideoMetadata,
  SupportedVideoMimeType,
} from './video-probing';
import {
  createValidPngBuffer,
  sampleVideoKeyframes,
  VideoKeyframe,
  VideoKeyframeOptions,
} from './video-keyframes';

export const MAX_VIDEO_BYTES = 1024 * 1024 * 1024;
export const MAX_VIDEO_DURATION_MS = 4 * 60 * 60 * 1000;

export type { SupportedVideoMimeType, VideoKeyframe, VideoKeyframeOptions };
export { createValidPngBuffer };

export interface InspectedVideo {
  mimeType: SupportedVideoMimeType;
  width?: number;
  height?: number;
  durationMs?: number;
  durationSeconds?: number;
  hasAudio?: boolean;
  size?: number;
}

export function isVideoFile(
  contentType?: string | null,
  filenameOrKey?: string | null,
): boolean {
  if (contentType) {
    const ct = contentType.toLowerCase().split(';')[0].trim();
    if (
      ct === 'video/mp4' ||
      ct === 'video/webm' ||
      ct === 'video/quicktime' ||
      ct === 'video/x-matroska' ||
      ct === 'video/mkv' ||
      ct === 'video/x-m4v' ||
      ct === 'video/avi' ||
      ct.startsWith('video/')
    ) {
      return true;
    }
  }
  if (filenameOrKey) {
    const lower = filenameOrKey.toLowerCase().split('?')[0].trim();
    if (
      lower.endsWith('.mp4') ||
      lower.endsWith('.webm') ||
      lower.endsWith('.mov') ||
      lower.endsWith('.mkv') ||
      lower.endsWith('.m4v')
    ) {
      return true;
    }
  }
  return false;
}

@Injectable()
export class VideoInspectorService {
  inspect(
    buffer: Buffer,
    declaredContentTypeOrOptions?:
      | string
      | null
      | { filename?: string; contentType?: string; sizeBytes?: number },
    filenameOrKey?: string | null,
  ): InspectedVideo {
    let declaredContentType: string | null | undefined;
    let effectiveFilename: string | null | undefined = filenameOrKey;
    let sizeBytes: number | undefined;

    if (
      declaredContentTypeOrOptions &&
      typeof declaredContentTypeOrOptions === 'object' &&
      !Buffer.isBuffer(declaredContentTypeOrOptions)
    ) {
      const opts = declaredContentTypeOrOptions;
      declaredContentType = opts.contentType ?? null;
      effectiveFilename = opts.filename ?? filenameOrKey ?? null;
      sizeBytes = opts.sizeBytes;
    } else {
      declaredContentType = declaredContentTypeOrOptions as
        string | null | undefined;
    }

    if (!buffer || buffer.length === 0) {
      throw new BadRequestError('Video buffer is empty.', {
        messageKey: 'errors.sources.inspect.videoEmpty',
      });
    }

    const effectiveSize = sizeBytes ?? buffer.length;
    if (effectiveSize > MAX_VIDEO_BYTES || buffer.length > MAX_VIDEO_BYTES) {
      const displaySize = Math.max(effectiveSize, buffer.length);
      throw new BadRequestError(
        `Video file size (${(displaySize / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed size of 1 GB.`,
        {
          messageKey: 'errors.sources.inspect.videoTooLarge',
          params: { sizeMb: (displaySize / (1024 * 1024)).toFixed(2) },
        },
      );
    }

    const mimeType = this.detectMimeType(buffer);
    if (!mimeType) {
      const hint = declaredContentType || effectiveFilename || 'unknown';
      throw new BadRequestError(
        `Unsupported video format (${hint}). Supported formats are MP4, WebM, QuickTime (MOV), and Matroska (MKV).`,
        {
          messageKey: 'errors.sources.inspect.videoUnsupported',
          params: { hint },
        },
      );
    }

    const metadata = this.extractMetadata(buffer, mimeType);

    if (
      metadata.durationMs !== undefined &&
      metadata.durationMs > MAX_VIDEO_DURATION_MS
    ) {
      throw new BadRequestError(
        `Video duration (${(metadata.durationMs / 1000).toFixed(1)}s) exceeds maximum allowed duration of 4 hours.`,
        {
          messageKey: 'errors.sources.inspect.videoTooLong',
          params: { durationS: (metadata.durationMs / 1000).toFixed(1) },
        },
      );
    }

    return {
      mimeType,
      width: metadata.width,
      height: metadata.height,
      durationMs: metadata.durationMs,
      durationSeconds:
        metadata.durationMs !== undefined
          ? Math.round(metadata.durationMs / 1000)
          : undefined,
      hasAudio: metadata.hasAudio,
      size: buffer.length,
    };
  }

  detectMimeType(buffer: Buffer): SupportedVideoMimeType | null {
    return detectVideoMimeType(buffer);
  }

  sampleKeyframes(
    buffer: Buffer,
    options?: VideoKeyframeOptions,
  ): VideoKeyframe[] {
    return sampleVideoKeyframes(buffer, options);
  }

  private extractMetadata(buffer: Buffer, mimeType: SupportedVideoMimeType) {
    return extractVideoMetadata(buffer, mimeType);
  }
}
