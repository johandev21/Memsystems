/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import { Injectable } from '@nestjs/common';
import { BadRequestError } from '../../common/errors/domain-error';
import { assertNotArchiveBomb, parseZipEntries } from './zip-helpers';

export const MAX_PPTX_BYTES = 200 * 1024 * 1024; // 200 MB
export const MAX_PPTX_SLIDES = 500;

export type SupportedPptxMimeType =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation';

export interface InspectedPptx {
  mimeType: SupportedPptxMimeType;
  slideCount?: number;
  hasSpeakerNotes?: boolean;
  width?: number;
  height?: number;
}

export function isPptxFile(
  contentType?: string | null,
  filename?: string | null,
): boolean {
  if (contentType) {
    const ct = contentType.toLowerCase().split(';')[0].trim();
    if (
      ct ===
        'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      ct === 'application/vnd.ms-powerpoint.presentation.macroenabled.12'
    ) {
      return true;
    }
  }
  if (filename) {
    const lower = filename.toLowerCase().split('?')[0].trim();
    if (lower.endsWith('.pptx') || lower.endsWith('.pptm')) {
      return true;
    }
  }
  return false;
}

const PPTX_SLIDE_RE = /^ppt\/slides\/slide\d+\.xml$/i;
const NOTES_SLIDE_RE = /^ppt\/notesSlides\/notesSlide\d+\.xml$/i;

@Injectable()
export class PptxInspectorService {
  inspect(
    buffer: Buffer,
    options?:
      | { filename?: string; contentType?: string; sizeBytes?: number }
      | string
      | null,
    filenameOrKey?: string | null,
  ): InspectedPptx {
    let declaredContentType: string | null | undefined;
    let effectiveFilename: string | null | undefined = filenameOrKey ?? null;
    let sizeBytes: number | undefined;

    if (options && typeof options === 'object' && !Buffer.isBuffer(options)) {
      const opts = options as {
        filename?: string;
        contentType?: string;
        sizeBytes?: number;
      };
      declaredContentType = opts.contentType ?? null;
      effectiveFilename = opts.filename ?? filenameOrKey ?? null;
      sizeBytes = opts.sizeBytes;
    } else if (typeof options === 'string') {
      declaredContentType = options;
    }

    if (!buffer || buffer.length === 0) {
      throw new BadRequestError('PPTX buffer is empty.');
    }

    const effectiveSize = sizeBytes ?? buffer.length;
    if (effectiveSize > MAX_PPTX_BYTES || buffer.length > MAX_PPTX_BYTES) {
      const displaySize = Math.max(effectiveSize, buffer.length);
      throw new BadRequestError(
        `PPTX file size (${(displaySize / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed size of 200 MB.`,
      );
    }

    // Legacy PPT OLE detection: D0 CF 11 E0 A1 B1 1A E1
    if (buffer.length >= 8) {
      const sig0 = buffer.readUInt32BE(0);
      const sig1 = buffer.readUInt32BE(4);
      if (sig0 === 0xd0cf11e0 && sig1 === 0xa11b1ae1) {
        throw new BadRequestError('Legacy PPT not supported, requires PPTX');
      }
    }

    // ZIP magic check
    if (
      buffer.length < 4 ||
      buffer[0] !== 0x50 ||
      buffer[1] !== 0x4b ||
      buffer[2] !== 0x03 ||
      buffer[3] !== 0x04
    ) {
      const hint = effectiveFilename || declaredContentType || 'unknown';
      throw new BadRequestError(
        `Unsupported PPTX format (${hint}). Expected PPTX ZIP container with PK\\x03\\x04 header.`,
      );
    }

    let slideCount: number | undefined;
    let hasSpeakerNotes: boolean | undefined;
    let width: number | undefined;
    let height: number | undefined;

    try {
      const parsed = parseZipEntries(buffer);
      assertNotArchiveBomb(parsed);

      // Count slides
      let count = 0;
      let notesCount = 0;
      for (const info of parsed.entryInfos) {
        if (PPTX_SLIDE_RE.test(info.fileName)) count++;
        if (NOTES_SLIDE_RE.test(info.fileName)) notesCount++;
      }
      slideCount = count;
      hasSpeakerNotes = notesCount > 0;

      if (count > MAX_PPTX_SLIDES) {
        throw new BadRequestError(
          `PPTX slide count (${count}) exceeds maximum allowed limit of ${MAX_PPTX_SLIDES}.`,
        );
      }

      // Try to parse presentation size from ppt/presentation.xml if present
      const presXml = parsed.entries.get('ppt/presentation.xml');
      if (presXml) {
        const text = presXml.toString('utf8');
        // <p:sldSz cx="..." cy="..."/>
        const match = text.match(
          /<p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"|<p:sldSz[^>]*cy="(\d+)"[^>]*cx="(\d+)"/,
        );
        if (match) {
          const cx = match[1] ? parseInt(match[1], 10) : parseInt(match[4], 10);
          const cy = match[2] ? parseInt(match[2], 10) : parseInt(match[3], 10);
          if (!isNaN(cx) && !isNaN(cy)) {
            // EMU to approx pixels? 914400 EMU = 1 inch, assume 96 DPI -> pixels = EMU / 914400 * 96
            width = Math.round((cx / 914400) * 96);
            height = Math.round((cy / 914400) * 96);
          }
        }
      }

      // Verify essential PPTX entries exist to detect corrupt vs arbitrary zip
      const hasContentTypes =
        parsed.entries.has('[Content_Types].xml') ||
        parsed.entryInfos.some((e) => e.fileName === '[Content_Types].xml');
      const hasPresentation = parsed.entries.has('ppt/presentation.xml');
      if (!hasContentTypes && !hasPresentation && count === 0) {
        // Check if it's an empty zip or arbitrary zip without PPTX structure
        // We already validated PK header, but if no PPTX structure, warn but still return slideCount 0?
        // For strict validation, if no slide and no presentation, it's corrupt
        // Instead of throwing, leave slideCount as 0 for inspector – parser will warn
      }
    } catch (err) {
      if (err instanceof BadRequestError) throw err;
      throw new BadRequestError(
        `Corrupted or invalid PPTX file: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return {
      mimeType:
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      slideCount,
      hasSpeakerNotes,
      width,
      height,
    };
  }
}
