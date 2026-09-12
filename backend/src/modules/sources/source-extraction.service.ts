import { Injectable } from '@nestjs/common';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { BadRequestError } from '../../common/errors/domain-error';

import { isYouTubeUrl as checkIsYouTubeUrl } from './youtube-acquisition.service';
import { isPptxFile as checkIsPptxFile } from './pptx-inspector.service';
import { isEpubFile as checkIsEpubFile } from './epub-inspector.service';
import { isTabularFile as checkIsTabularFile } from './tabular-inspector.service';

export type SupportedFileKind =
  'pdf' | 'markdown' | 'txt' | 'docx' | 'image' | 'audio' | 'video' | 'tabular';

export interface ExtractionResult {
  text: string;
  pageCount?: number;
  warnings?: string[];
}

const PDF_MIME_TYPES = new Set(['application/pdf']);
const MD_MIME_TYPES = new Set([
  'text/markdown',
  'text/x-markdown',
  'application/markdown',
]);
const TXT_MIME_TYPES = new Set(['text/plain']);
const DOCX_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);
const AUDIO_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/webm',
  'audio/aac',
  'audio/x-aac',
  'audio/ogg',
  'audio/vorbis',
  'audio/opus',
  'audio/flac',
  'audio/x-flac',
]);
const VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
  'video/mkv',
  'video/x-m4v',
  'video/avi',
  'video/x-msvideo',
  'video/mpeg',
  'video/3gpp',
  'video/ogg',
]);

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\u0000')
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeUtf8(buffer: Buffer): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
}

@Injectable()
export class SourceExtractionService {
  classifyFile(contentType: string, filename?: string): SupportedFileKind {
    const ct = contentType.toLowerCase().split(';')[0].trim();
    if (PDF_MIME_TYPES.has(ct)) return 'pdf';
    if (MD_MIME_TYPES.has(ct)) return 'markdown';
    if (TXT_MIME_TYPES.has(ct)) return 'txt';
    if (DOCX_MIME_TYPES.has(ct)) return 'docx';
    if (IMAGE_MIME_TYPES.has(ct)) return 'image';
    if (AUDIO_MIME_TYPES.has(ct)) return 'audio';
    if (VIDEO_MIME_TYPES.has(ct) || ct.startsWith('video/')) return 'video';
    if (this.isTabularFile(contentType, filename)) return 'tabular';

    if (filename) {
      const lower = filename.toLowerCase();
      if (lower.endsWith('.pdf')) return 'pdf';
      if (lower.endsWith('.md') || lower.endsWith('.markdown'))
        return 'markdown';
      if (lower.endsWith('.txt')) return 'txt';
      if (lower.endsWith('.docx')) return 'docx';
      if (
        lower.endsWith('.png') ||
        lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') ||
        lower.endsWith('.webp')
      ) {
        return 'image';
      }
      if (
        lower.endsWith('.mp3') ||
        lower.endsWith('.m4a') ||
        lower.endsWith('.wav') ||
        lower.endsWith('.webm') ||
        lower.endsWith('.aac') ||
        lower.endsWith('.ogg') ||
        lower.endsWith('.opus') ||
        lower.endsWith('.flac')
      ) {
        return 'audio';
      }
      if (
        lower.endsWith('.mp4') ||
        lower.endsWith('.webm') ||
        lower.endsWith('.mov') ||
        lower.endsWith('.mkv') ||
        lower.endsWith('.avi') ||
        lower.endsWith('.m4v') ||
        lower.endsWith('.3gp') ||
        lower.endsWith('.ogv')
      ) {
        return 'video';
      }
    }

    throw new BadRequestError(
      `Unsupported file type: ${contentType || 'unknown'}`,
      {
        messageKey: 'errors.sources.extract.unsupportedFileType',
        params: { contentType: contentType || 'unknown' },
      },
    );
  }

  isImageFile(contentType: string, filename?: string): boolean {
    try {
      return this.classifyFile(contentType, filename) === 'image';
    } catch {
      return false;
    }
  }

  isAudioFile(contentType?: string | null, filename?: string | null): boolean {
    if (contentType) {
      const ct = contentType.toLowerCase().split(';')[0].trim();
      if (AUDIO_MIME_TYPES.has(ct)) {
        return true;
      }
    }
    if (filename) {
      const lower = filename.toLowerCase().split('?')[0].trim();
      if (
        lower.endsWith('.mp3') ||
        lower.endsWith('.m4a') ||
        lower.endsWith('.wav') ||
        lower.endsWith('.aac') ||
        lower.endsWith('.ogg') ||
        lower.endsWith('.opus') ||
        lower.endsWith('.flac')
      ) {
        return true;
      }
    }
    return false;
  }

  isVideoFile(contentType?: string | null, filename?: string | null): boolean {
    if (contentType) {
      const ct = contentType.toLowerCase().split(';')[0].trim();
      if (VIDEO_MIME_TYPES.has(ct) || ct.startsWith('video/')) {
        return true;
      }
    }
    if (filename) {
      const lower = filename.toLowerCase().split('?')[0].trim();
      if (
        lower.endsWith('.mp4') ||
        lower.endsWith('.webm') ||
        lower.endsWith('.mov') ||
        lower.endsWith('.mkv') ||
        lower.endsWith('.avi') ||
        lower.endsWith('.m4v') ||
        lower.endsWith('.3gp') ||
        lower.endsWith('.ogv')
      ) {
        return true;
      }
    }
    return false;
  }

  isYouTubeUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    return checkIsYouTubeUrl(url);
  }

  isPptxFile(contentType?: string | null, filename?: string | null): boolean {
    return checkIsPptxFile(contentType, filename);
  }

  isEpubFile(contentType?: string | null, filename?: string | null): boolean {
    return checkIsEpubFile(contentType, filename);
  }

  isTabularFile(
    contentType?: string | null,
    filename?: string | null,
  ): boolean {
    return checkIsTabularFile(contentType, filename);
  }

  isSupportedFile(contentType: string, filename?: string): boolean {
    if (
      this.isPptxFile(contentType, filename) ||
      this.isEpubFile(contentType, filename) ||
      this.isTabularFile(contentType, filename)
    ) {
      return true;
    }
    try {
      this.classifyFile(contentType, filename);
      return true;
    } catch {
      return false;
    }
  }

  async extractPdf(buffer: Buffer): Promise<ExtractionResult> {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return {
        text: normalizeText(result.text),
        pageCount: result.pages?.length,
      };
    } finally {
      await parser.destroy();
    }
  }

  async extractDocx(buffer: Buffer): Promise<ExtractionResult> {
    const result = await mammoth.extractRawText({ buffer });
    return {
      text: normalizeText(result.value),
      warnings: result.messages?.flatMap((m) =>
        m.type === 'warning' ? [m.message] : [],
      ),
    };
  }

  extractMarkdown(buffer: Buffer): ExtractionResult {
    return { text: normalizeText(decodeUtf8(buffer)) };
  }

  extractTxt(buffer: Buffer): ExtractionResult {
    return { text: normalizeText(decodeUtf8(buffer)) };
  }

  async extractText(
    buffer: Buffer,
    contentType: string,
    filename?: string,
  ): Promise<ExtractionResult> {
    const kind = this.classifyFile(contentType, filename);
    switch (kind) {
      case 'pdf':
        return this.extractPdf(buffer);
      case 'docx':
        return this.extractDocx(buffer);
      case 'markdown':
        return this.extractMarkdown(buffer);
      case 'txt':
        return this.extractTxt(buffer);
      case 'image':
        return { text: normalizeText(`[Image: ${filename || 'image'}]`) };
      case 'audio':
        return { text: normalizeText(`[Audio: ${filename || 'audio'}]`) };
      case 'video':
        return { text: normalizeText(`[Video: ${filename || 'video'}]`) };
      case 'tabular':
        return { text: normalizeText(decodeUtf8(buffer)) };
    }
  }
}
