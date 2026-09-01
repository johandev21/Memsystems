/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Injectable } from '@nestjs/common';
import { BadRequestError } from '../../common/errors/domain-error';
import { assertNotArchiveBomb, parseZipEntries } from './zip-helpers';

export interface EpubChapter {
  ordinal: number;
  title: string;
  textContent: string;
  href: string;
}

export interface TocEntry {
  id: string;
  href: string;
  title: string;
  order: number;
}

export interface EpubParseResult {
  chapterCount: number;
  chapters: EpubChapter[];
  toc?: TocEntry[];
  warnings?: string[];
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, c) =>
      String.fromCharCode(parseInt(c, 16)),
    );
}

function sanitizeXhtml(html: string): string {
  let out = html;
  // Remove script, style, object, embed, form, iframe, link with unsafe
  out = out.replace(/<script[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<style[\s\S]*?<\/style>/gi, '');
  out = out.replace(/<object[\s\S]*?<\/object>/gi, '');
  out = out.replace(/<embed[^>]*\/?>/gi, '');
  out = out.replace(/<form[\s\S]*?<\/form>/gi, '');
  out = out.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
  // Remove event handler attributes on*="..."
  out = out.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // Remove javascript: hrefs
  out = out.replace(/\s+href\s*=\s*["']\s*javascript:[^"']*["']/gi, '');
  return out;
}

function extractTextFromHtml(html: string): string {
  // Simple tag stripping preserving spaces
  let text = sanitizeXhtml(html);
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');
  text = text.replace(/<[^>]+>/g, ' ');
  text = decodeXmlEntities(text);
  text = text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  // Collapse multiple spaces
  text = text.replace(/[ \t]{2,}/g, ' ');
  return text;
}

function extractTitleFromHtml(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    return decodeXmlEntities(titleMatch[1].replace(/<[^>]+>/g, '').trim());
  }
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    return decodeXmlEntities(h1Match[1].replace(/<[^>]+>/g, '').trim());
  }
  const h2Match = html.match(/<h[2-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
  if (h2Match) {
    const t = decodeXmlEntities(h2Match[1].replace(/<[^>]+>/g, '').trim());
    if (t) return t;
  }
  return '';
}

function parseContainerXml(
  containerXml: string,
  warnings: string[],
): string | null {
  const match = containerXml.match(
    /<rootfile[^>]*full-path\s*=\s*["']([^"']+)["'][^>]*>/i,
  );
  if (!match) {
    warnings.push('META-INF/container.xml missing rootfile full-path.');
    return null;
  }
  return match[1].trim();
}

function parseOpf(
  opfContent: string,
  warnings: string[],
): {
  manifest: Map<string, { href: string; mediaType: string }>;
  spineIds: string[];
  hasToc: boolean;
} {
  const manifest = new Map<string, { href: string; mediaType: string }>();
  const idRe = /<item[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = idRe.exec(opfContent)) !== null) {
    const tag = m[0];
    const idMatch = tag.match(/id\s*=\s*["']([^"']+)["']/i);
    const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i);
    const mediaMatch = tag.match(/media-type\s*=\s*["']([^"']+)["']/i);
    if (idMatch && hrefMatch) {
      manifest.set(idMatch[1], {
        href: hrefMatch[1],
        mediaType: mediaMatch ? mediaMatch[1] : '',
      });
    }
  }
  const spineIds: string[] = [];
  const itemRefRe = /<itemref[^>]*idref\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let sm: RegExpExecArray | null;
  while ((sm = itemRefRe.exec(opfContent)) !== null) {
    spineIds.push(sm[1]);
  }
  if (spineIds.length === 0) {
    warnings.push('OPF spine contains no itemrefs.');
  }
  const hasToc =
    /media-type\s*=\s*["']application\/x-dtbncx\+xml["']/i.test(opfContent) ||
    /\bproperties\s*=\s*["'][^"']*nav[^"']*["']/i.test(opfContent) ||
    /<spine[^>]*toc\s*=/i.test(opfContent);
  return { manifest, spineIds, hasToc };
}

function resolveHref(basePath: string, href: string): string {
  if (href.startsWith('/') || href.includes('://')) return href;
  const lastSlash = basePath.lastIndexOf('/');
  const baseDir = lastSlash >= 0 ? basePath.slice(0, lastSlash + 1) : '';
  // Simple normalization: handle ../ and ./
  let combined = baseDir + href;
  // Remove ./ segments
  combined = combined.replace(/\/\.\//g, '/');
  // Handle ../
  const parts = combined.split('/');
  const resolved: string[] = [];
  for (const p of parts) {
    if (p === '..') {
      resolved.pop();
    } else if (p !== '.') {
      resolved.push(p);
    }
  }
  return resolved.join('/');
}

@Injectable()
export class EpubParserService {
  parse(buffer: Buffer): EpubParseResult {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestError('EPUB buffer is empty.');
    }
    if (
      buffer.length < 4 ||
      buffer[0] !== 0x50 ||
      buffer[1] !== 0x4b ||
      buffer[2] !== 0x03 ||
      buffer[3] !== 0x04
    ) {
      throw new BadRequestError('Invalid EPUB ZIP header.');
    }

    const warnings: string[] = [];
    let parsed: ReturnType<typeof parseZipEntries>;
    try {
      parsed = parseZipEntries(buffer);
    } catch (err) {
      if (err instanceof BadRequestError) throw err;
      throw new BadRequestError(
        `Failed to unzip EPUB: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    assertNotArchiveBomb(parsed);

    if (
      !parsed.entries.has('mimetype') ||
      !parsed.entries.has('META-INF/container.xml')
    ) {
      warnings.push(
        'Missing mimetype or container.xml; attempting best-effort parse.',
      );
    }

    const containerXml =
      parsed.entries.get('META-INF/container.xml')?.toString('utf8') ?? '';
    let opfPath = parseContainerXml(containerXml, warnings);
    if (!opfPath) {
      // Fallback: search for .opf
      for (const name of parsed.entries.keys()) {
        if (name.toLowerCase().endsWith('.opf')) {
          opfPath = name;
          break;
        }
      }
    }
    if (!opfPath || !parsed.entries.has(opfPath)) {
      throw new BadRequestError(
        'Invalid EPUB: cannot locate OPF package file.',
      );
    }

    const opfContent = parsed.entries.get(opfPath)!.toString('utf8');
    if ((opfContent.match(/<!ENTITY/g) || []).length > 10) {
      warnings.push('Excessive ENTITY declarations in OPF, stripped.');
    }

    const { manifest, spineIds, hasToc } = parseOpf(opfContent, warnings);

    const chapters: EpubChapter[] = [];
    const toc: TocEntry[] = [];
    let ordinal = 0;

    for (const id of spineIds) {
      const item = manifest.get(id);
      if (!item) {
        warnings.push(`Spine idref "${id}" not found in manifest.`);
        continue;
      }
      const href = item.href;
      const resolvedHref = resolveHref(opfPath, href);
      // Try resolved then raw href
      let contentBuf =
        parsed.entries.get(resolvedHref) ?? parsed.entries.get(href);
      // Try also without base dir resolution fallback search by basename
      if (!contentBuf) {
        const basename = href.split('/').pop()?.toLowerCase();
        if (basename) {
          for (const [k, v] of parsed.entries.entries()) {
            if (
              k.toLowerCase().endsWith('/' + basename) ||
              k.toLowerCase() === basename
            ) {
              contentBuf = v;
              break;
            }
          }
        }
      }
      if (!contentBuf) {
        warnings.push(
          `Chapter href "${href}" (resolved "${resolvedHref}") not found in archive.`,
        );
        continue;
      }
      let html: string;
      try {
        html = contentBuf.toString('utf8');
        if (html.length > 5 * 1024 * 1024) {
          warnings.push(`Chapter "${href}" exceeds 5MB, truncated.`);
          html = html.slice(0, 5 * 1024 * 1024);
        }
        if ((html.match(/<!ENTITY/g) || []).length > 10) {
          warnings.push(
            `Chapter "${href}" contains excessive ENTITY declarations, stripped.`,
          );
          html = html.replace(/<!ENTITY[^>]*>/gi, '');
        }
      } catch {
        warnings.push(`Failed to decode chapter "${href}" as UTF-8.`);
        html = '';
      }

      const sanitized = sanitizeXhtml(html);
      // Additionally check for active content presence
      if (/<script/i.test(html) || /\son\w+\s*=/i.test(html)) {
        warnings.push(`Active content stripped from "${href}".`);
      }

      const textContent = extractTextFromHtml(sanitized);
      const title = extractTitleFromHtml(html) || `Chapter ${ordinal + 1}`;
      ordinal++;
      chapters.push({ ordinal, title, textContent, href: resolvedHref });

      if (hasToc) {
        toc.push({ id, href: resolvedHref, title, order: ordinal });
      }
    }

    // Fallback if spine parsing yielded nothing but there are html files
    if (chapters.length === 0) {
      warnings.push(
        'No spine chapters resolved; falling back to scanning HTML files.',
      );
      let fallbackOrdinal = 0;
      for (const [name, buf] of parsed.entries.entries()) {
        const lower = name.toLowerCase();
        if (
          lower.endsWith('.xhtml') ||
          lower.endsWith('.html') ||
          lower.endsWith('.htm')
        ) {
          if (name.startsWith('META-INF/')) continue;
          const html = buf.toString('utf8');
          const sanitized = sanitizeXhtml(html);
          const textContent = extractTextFromHtml(sanitized);
          if (textContent.length === 0) continue;
          fallbackOrdinal++;
          const title =
            extractTitleFromHtml(html) || `Chapter ${fallbackOrdinal}`;
          chapters.push({
            ordinal: fallbackOrdinal,
            title,
            textContent,
            href: name,
          });
          if (fallbackOrdinal >= 500) break;
        }
      }
    }

    if (chapters.length > 500) {
      throw new BadRequestError(
        `EPUB chapter count (${chapters.length}) exceeds maximum allowed limit of 500.`,
      );
    }

    return {
      chapterCount: chapters.length,
      chapters,
      toc: toc.length > 0 ? toc : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
}
