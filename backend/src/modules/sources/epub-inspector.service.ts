/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import { Injectable } from '@nestjs/common';
import { BadRequestError } from '../../common/errors/domain-error';
import { assertNotArchiveBomb, parseZipEntries } from './zip-helpers';

export const MAX_EPUB_BYTES = 200 * 1024 * 1024; // 200 MB
export const MAX_EPUB_CHAPTERS = 500;

export type SupportedEpubMimeType = 'application/epub+zip';

export interface InspectedEpub {
  mimeType: SupportedEpubMimeType;
  chapterCount?: number;
  hasToc?: boolean;
}

export function isEpubFile(
  contentType?: string | null,
  filename?: string | null,
): boolean {
  if (contentType) {
    const ct = contentType.toLowerCase().split(';')[0].trim();
    if (ct === 'application/epub+zip') return true;
  }
  if (filename) {
    const lower = filename.toLowerCase().split('?')[0].trim();
    if (lower.endsWith('.epub')) return true;
  }
  return false;
}

@Injectable()
export class EpubInspectorService {
  inspect(
    buffer: Buffer,
    options?:
      | { filename?: string; contentType?: string; sizeBytes?: number }
      | string
      | null,
    filenameOrKey?: string | null,
  ): InspectedEpub {
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
      throw new BadRequestError('EPUB buffer is empty.');
    }

    const effectiveSize = sizeBytes ?? buffer.length;
    if (effectiveSize > MAX_EPUB_BYTES || buffer.length > MAX_EPUB_BYTES) {
      const displaySize = Math.max(effectiveSize, buffer.length);
      throw new BadRequestError(
        `EPUB file size (${(displaySize / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed size of 200 MB.`,
      );
    }

    if (
      buffer.length < 4 ||
      buffer[0] !== 0x50 ||
      buffer[1] !== 0x4b ||
      buffer[2] !== 0x03 ||
      buffer[3] !== 0x04
    ) {
      const hint = effectiveFilename || declaredContentType || 'unknown';
      throw new BadRequestError(
        `Unsupported EPUB format (${hint}). Expected EPUB ZIP container with PK\\x03\\x04 header.`,
      );
    }

    let chapterCount: number | undefined;
    let hasToc: boolean | undefined;

    try {
      const parsed = parseZipEntries(buffer);
      assertNotArchiveBomb(parsed);

      // EPUB validation: mimetype must exist and be first entry uncompressed with correct value
      const mimetypeEntry = parsed.entryInfos.find(
        (e) => e.fileName === 'mimetype',
      );
      if (!mimetypeEntry) {
        throw new BadRequestError('Invalid EPUB: missing mimetype file.');
      }
      // Check mimetype is first entry (first in entryInfos)
      const firstFile = parsed.entryInfos.find((e) => !e.isDirectory);
      if (firstFile && firstFile.fileName !== 'mimetype') {
        throw new BadRequestError(
          'Invalid EPUB: mimetype must be first entry.',
        );
      }
      if (mimetypeEntry.compressionMethod !== 0) {
        throw new BadRequestError(
          'Invalid EPUB: mimetype must be uncompressed.',
        );
      }
      const mimetypeContent = parsed.entries.get('mimetype');
      if (
        !mimetypeContent ||
        mimetypeContent.toString('utf8').trim() !== 'application/epub+zip'
      ) {
        throw new BadRequestError(
          'Invalid EPUB: mimetype must contain "application/epub+zip".',
        );
      }

      const hasContainer = parsed.entries.has('META-INF/container.xml');
      if (!hasContainer) {
        throw new BadRequestError(
          'Invalid EPUB: missing META-INF/container.xml.',
        );
      }

      // Best-effort chapter count: count spine-referenced xhtml/html or fallback to counting
      // Try to parse container -> OPF to get spine, else count files
      let spineCount: number | undefined;
      try {
        const containerXml =
          parsed.entries.get('META-INF/container.xml')?.toString('utf8') ?? '';
        const rootMatch = containerXml.match(
          /<rootfile[^>]*full-path\s*=\s*["']([^"']+)["']/i,
        );
        const opfPath = rootMatch ? rootMatch[1] : null;
        if (opfPath && parsed.entries.has(opfPath)) {
          const opfContent = parsed.entries.get(opfPath)!.toString('utf8');
          // Count spine itemrefs
          const spineMatches = opfContent.match(/<itemref[^>]*>/gi);
          spineCount = spineMatches ? spineMatches.length : undefined;
          // Detect TOC: look for NCX (media-type application/x-dtbncx+xml) or nav property
          const hasNcx =
            /media-type\s*=\s*["']application\/x-dtbncx\+xml["']/i.test(
              opfContent,
            );
          const hasNav = /\bproperties\s*=\s*["'][^"']*nav[^"']*["']/i.test(
            opfContent,
          );
          const hasTocTag = /<spine[^>]*toc\s*=/i.test(opfContent);
          hasToc = hasNcx || hasNav || hasTocTag || false;
        }
      } catch {
        // ignore
      }

      if (spineCount !== undefined) {
        chapterCount = spineCount;
      } else {
        // Fallback: count .xhtml/.html/.htm files
        let count = 0;
        for (const info of parsed.entryInfos) {
          const lower = info.fileName.toLowerCase();
          if (
            lower.endsWith('.xhtml') ||
            lower.endsWith('.html') ||
            lower.endsWith('.htm')
          ) {
            // Exclude nav and container files? Keep simple
            count++;
          }
        }
        chapterCount = count;
      }

      // If hasToc still undefined, check manifest for toc.ncx or nav.xhtml existence
      if (hasToc === undefined) {
        hasToc = parsed.entryInfos.some(
          (e) =>
            /toc\.ncx$/i.test(e.fileName) || /nav\.x?html$/i.test(e.fileName),
        );
      }

      if (chapterCount !== undefined && chapterCount > MAX_EPUB_CHAPTERS) {
        throw new BadRequestError(
          `EPUB chapter count (${chapterCount}) exceeds maximum allowed limit of ${MAX_EPUB_CHAPTERS}.`,
        );
      }
    } catch (err) {
      if (err instanceof BadRequestError) throw err;
      throw new BadRequestError(
        `Corrupted or invalid EPUB file: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return {
      mimeType: 'application/epub+zip',
      chapterCount,
      hasToc,
    };
  }
}
