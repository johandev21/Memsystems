import { Injectable } from '@nestjs/common';
import { BadRequestError } from '../../../common/errors/domain-error';
import {
  detectAudioMimeType,
  extractAudioMetadata,
  SupportedAudioMimeType,
} from './audio-probing';

export const MAX_AUDIO_BYTES = 500 * 1024 * 1024;
export const MAX_AUDIO_DURATION_MS = 4 * 60 * 60 * 1000;

export type { SupportedAudioMimeType };

export interface InspectedAudio {
  mimeType: SupportedAudioMimeType;
  durationMs?: number;
  durationSeconds?: number;
  channels?: number;
  sampleRate?: number;
  size?: number;
}

export function isAudioFile(
  contentType?: string | null,
  filenameOrKey?: string | null,
): boolean {
  if (contentType) {
    const ct = contentType.toLowerCase().split(';')[0].trim();
    if (
      ct.startsWith('audio/') ||
      ct === 'audio/mpeg' ||
      ct === 'audio/mp3' ||
      ct === 'audio/mp4' ||
      ct === 'audio/x-m4a' ||
      ct === 'audio/m4a' ||
      ct === 'audio/wav' ||
      ct === 'audio/x-wav' ||
      ct === 'audio/wave' ||
      ct === 'audio/webm' ||
      ct === 'audio/aac' ||
      ct === 'audio/x-aac' ||
      ct === 'audio/ogg' ||
      ct === 'audio/vorbis' ||
      ct === 'audio/opus' ||
      ct === 'audio/flac' ||
      ct === 'audio/x-flac'
    ) {
      return true;
    }
  }
  if (filenameOrKey) {
    const lower = filenameOrKey.toLowerCase().split('?')[0].trim();
    if (
      lower.endsWith('.mp3') ||
      lower.endsWith('.m4a') ||
      lower.endsWith('.wav') ||
      lower.endsWith('.webm') ||
      lower.endsWith('.aac') ||
      lower.endsWith('.ogg') ||
      lower.endsWith('.opus') ||
      lower.endsWith('.flac') ||
      lower.endsWith('.wma')
    ) {
      return true;
    }
  }
  return false;
}

@Injectable()
export class AudioInspectorService {
  inspect(
    buffer: Buffer,
    declaredContentType?: string | null,
    filenameOrKey?: string | null,
  ): InspectedAudio {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestError('Audio buffer is empty.', {
        messageKey: 'errors.sources.inspect.audioEmpty',
      });
    }

    if (buffer.length > MAX_AUDIO_BYTES) {
      throw new BadRequestError(
        `Audio file size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed size of 500 MB.`,
        {
          messageKey: 'errors.sources.inspect.audioTooLarge',
          params: { sizeMb: (buffer.length / (1024 * 1024)).toFixed(2) },
        },
      );
    }

    const mimeType = this.detectMimeType(buffer);
    if (!mimeType) {
      const hint = declaredContentType || filenameOrKey || 'unknown';
      throw new BadRequestError(
        `Unsupported audio format (${hint}). Supported formats are MP3, WAV, M4A, AAC, WebM, and OGG.`,
        {
          messageKey: 'errors.sources.inspect.audioUnsupported',
          params: { hint },
        },
      );
    }

    const metadata = this.extractMetadata(buffer, mimeType);

    if (
      metadata.durationMs !== undefined &&
      metadata.durationMs > MAX_AUDIO_DURATION_MS
    ) {
      throw new BadRequestError(
        `Audio duration (${(metadata.durationMs / 1000).toFixed(1)}s) exceeds maximum allowed duration of 4 hours.`,
        {
          messageKey: 'errors.sources.inspect.audioTooLong',
          params: { durationS: (metadata.durationMs / 1000).toFixed(1) },
        },
      );
    }

    return {
      mimeType,
      durationMs: metadata.durationMs,
      durationSeconds:
        metadata.durationMs !== undefined
          ? Math.round(metadata.durationMs / 1000)
          : undefined,
      channels: metadata.channels,
      sampleRate: metadata.sampleRate,
      size: buffer.length,
    };
  }

  detectMimeType(buffer: Buffer): SupportedAudioMimeType | null {
    return detectAudioMimeType(buffer);
  }

  private extractMetadata(buffer: Buffer, mimeType: SupportedAudioMimeType) {
    return extractAudioMetadata(buffer, mimeType);
  }
}
