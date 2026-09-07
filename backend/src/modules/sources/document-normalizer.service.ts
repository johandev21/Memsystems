import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { ScrapedPage } from './web-scraper.service';
import type { VisionExtractionResult } from './vision-extraction.port';
import type { TranscriptionResult } from './transcription.port';
import type { YouTubeAcquisitionResult } from './youtube-acquisition.service';
import type { PptxParseResult } from './pptx-parser.service';
import type { EpubParseResult } from './epub-parser.service';
import type { ParsedTabularResult } from './tabular-parser.service';
import type { VideoKeyframe } from './video-inspector.service';

export type ExtractionMethod =
  | 'text'
  | 'file'
  | 'readability'
  | 'playwright'
  | 'vision'
  | 'audio'
  | 'transcription'
  | 'video'
  | 'youtube'
  | 'tabular'
  | 'parser';

export type DocumentSectionKind =
  | 'text'
  | 'heading'
  | 'code'
  | 'table'
  | 'formula'
  | 'visual_description'
  | 'transcript';

export interface DocumentSectionLocator {
  pageNumber?: number;
  slideNumber?: number;
  startOffsetMs?: number;
  endOffsetMs?: number;
  speaker?: string;
  sheetName?: string;
  cellRange?: string;
  symbol?: string;
  lineStart?: number;
  lineEnd?: number;
  imageRegion?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  [key: string]: unknown;
}

export interface DocumentSection {
  headingPath: string[];
  content: string;
  ordinal: number;
  pageNumber?: number;
  kind?: DocumentSectionKind;
  locator?: DocumentSectionLocator;
  metadata?: Record<string, unknown>;
}

/**
 * Shared internal document contract produced by every acquisition adapter.
 * Consumers must not rely on it being a slice of the original input: it is a
 * normalized view with deterministic whitespace and citation handling.
 */
export interface NormalizedDocument {
  title: string;
  text: string;
  markdown?: string;
  sourceUrl?: string;
  canonicalUrl?: string;
  fetchedUrl?: string;
  language?: string;
  author?: string;
  siteName?: string;
  publishedAt?: string;
  modifiedAt?: string;
  extractionMethod: ExtractionMethod;
  contentType?: string;
  contentHash: string;
  sections: DocumentSection[];
}

export interface FileDocumentInput {
  text: string;
  contentType: string;
  fileName?: string;
  title?: string;
  pageCount?: number;
}

/** Bump when normalization rules change; used for idempotent re-processing. */
export const NORMALIZATION_VERSION = 1;
/** Bump when the extraction adapters change; used for re-processing decisions. */
export const EXTRACTOR_VERSION = '1';

/** Inline citation markers that have already been removed by DOM cleaning are
 * stripped again only when directly anchored to sentence punctuation, so
 * legitimate text such as `[RFC 9110]`, `arr[0]`, or `[1, 2]` is preserved. */
const PROVEN_CITATION_RE = /(?<=[.!?])\s*\[\d{1,3}\]/g;

function normalizeProse(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\u0000')
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripProvenCitations(text: string): string {
  return text.replace(PROVEN_CITATION_RE, '');
}

export function contentHashOf(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function singleSection(content: string): DocumentSection[] {
  return [{ headingPath: [], content: normalizeProse(content), ordinal: 0 }];
}

const HEADING_LEVELS: Record<string, number> = {
  H1: 1,
  H2: 2,
  H3: 3,
  H4: 4,
  H5: 5,
  H6: 6,
};

const TEXT_NODE = 3;

/** Joins text nodes with spaces while preserving exact whitespace in PRE/CODE. */
function inlineText(el: Element): string {
  let out = '';
  const walk = (node: Node): void => {
    if (node.nodeType === TEXT_NODE) {
      out += node.textContent ?? '';
      return;
    }
    const element = node as Element;
    if (element.tagName === 'BR') {
      out += '\n';
      return;
    }
    if (element.tagName === 'PRE' || element.tagName === 'CODE') {
      out += `\u0000${element.textContent ?? ''}\u0000`;
      return;
    }
    for (const child of element.childNodes) walk(child);
  };
  walk(el);
  return out
    .split('\u0000')
    .map((segment, index) => {
      const trimmed = segment.trim();
      if (index % 2 !== 0) return trimmed; // PRE/CODE: exact whitespace
      return trimmed.replace(/[ \t\r\n]+/g, ' '); // prose: collapse
    })
    .filter((segment) => segment.length > 0)
    .join(' ');
}

function containsHeading(el: Element): boolean {
  return el.querySelector('h1, h2, h3, h4, h5, h6') !== null;
}

function headingLevel(el: Element): number {
  return HEADING_LEVELS[el.tagName] ?? 0;
}

interface SectionAccumulator {
  headingPath: string[];
  blocks: string[];
}

/** Builds sections from article HTML, splitting on heading hierarchy. */
export function sectionsFromHtml(articleHtml: string): DocumentSection[] {
  const dom = new JSDOM(articleHtml);
  const root = dom.window.document.body;

  const blocks: { headingPath: string[]; text: string }[] = [];
  let path: string[] = [];

  const collect = (container: Element): void => {
    for (const child of Array.from(container.children)) {
      const level = headingLevel(child);
      if (level > 0) {
        const headingText = inlineText(child);
        if (headingText) {
          while (path.length >= level) path.pop();
          path = [...path, headingText];
          blocks.push({ headingPath: path, text: headingText });
        }
        continue;
      }
      if (containsHeading(child)) {
        collect(child);
        continue;
      }
      const text = inlineText(child);
      if (text) blocks.push({ headingPath: path, text });
    }
  };
  collect(root);

  const sections: SectionAccumulator[] = [];
  let current: SectionAccumulator = { headingPath: [], blocks: [] };
  const finalize = (): void => {
    if (current.blocks.length > 0) {
      sections.push(current);
      current = { headingPath: [], blocks: [] };
    }
  };

  for (const block of blocks) {
    if (
      block.headingPath.length > 0 &&
      block.text === block.headingPath.at(-1)
    ) {
      finalize();
      current = { headingPath: block.headingPath, blocks: [] };
    } else {
      current.blocks.push(block.text);
    }
  }
  finalize();

  return sections.map((section, index) => ({
    headingPath: section.headingPath,
    content: normalizeProse(stripProvenCitations(section.blocks.join('\n\n'))),
    ordinal: index,
  }));
}

const FENCE_RE = /^```/;

/** Builds sections from Markdown, splitting on `#` headings outside code fences. */
export function sectionsFromMarkdown(markdown: string): DocumentSection[] {
  const lines = markdown.split('\n');
  const sections: SectionAccumulator[] = [];
  let current: SectionAccumulator = { headingPath: [], blocks: [] };
  let inFence = false;

  const finalize = (): void => {
    if (current.blocks.length > 0) {
      sections.push(current);
      current = { headingPath: [], blocks: [] };
    }
  };

  for (const line of lines) {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      current.blocks.push(line);
      continue;
    }
    if (!inFence) {
      const match = line.match(/^(#{1,6})\s+(.+?)\s*$/);
      if (match) {
        const level = match[1].length;
        const headingPath = [
          ...current.headingPath.slice(0, level - 1),
          match[2].trim(),
        ];
        finalize();
        current = { headingPath, blocks: [line] };
        continue;
      }
    }
    if (inFence || line.trim() || current.blocks.length > 0) {
      current.blocks.push(line);
    }
  }
  finalize();

  return sections.map((section, index) => ({
    headingPath: section.headingPath,
    content: normalizeProse(section.blocks.join('\n')),
    ordinal: index,
  }));
}

@Injectable()
export class DocumentNormalizerService {
  /** Pasted text: a single section, no markdown. */
  fromText(text: string, title: string): NormalizedDocument {
    const normalized = normalizeProse(text);
    return {
      title,
      text: normalized,
      extractionMethod: 'text',
      contentHash: contentHashOf(normalized),
      sections: singleSection(normalized),
    };
  }

  /** Uploaded file: markdown keeps its structure, everything else is prose. */
  fromFile(input: FileDocumentInput): NormalizedDocument {
    const { text, contentType, fileName, title } = input;
    const kind = detectMarkdown(contentType, fileName);
    const normalized = normalizeProse(text);

    if (kind) {
      const sections = sectionsFromMarkdown(text);
      return {
        title: title ?? fileName ?? 'Untitled',
        text: normalized,
        markdown: text,
        extractionMethod: 'file',
        contentType,
        contentHash: contentHashOf(normalized),
        sections,
      };
    }

    return {
      title: title ?? fileName ?? 'Untitled',
      text: normalized,
      extractionMethod: 'file',
      contentType,
      contentHash: contentHashOf(normalized),
      sections: singleSection(normalized),
    };
  }

  /** HTML/Readability extraction: derives sections from article headings. */
  fromHtml(
    page: ScrapedPage,
    meta: {
      sourceUrl: string;
      canonicalUrl?: string;
      fetchedUrl?: string;
      contentType?: string;
    },
  ): NormalizedDocument {
    const text = normalizeProse(stripProvenCitations(page.text));
    const sections = sectionsFromHtml(page.html);

    return {
      title: page.title,
      text,
      sourceUrl: meta.sourceUrl,
      canonicalUrl: meta.canonicalUrl,
      fetchedUrl: meta.fetchedUrl,
      language: page.lang,
      author: page.byline,
      siteName: page.siteName,
      extractionMethod: 'readability',
      contentType: meta.contentType,
      contentHash: contentHashOf(text),
      sections,
    };
  }

  /** Vision extraction: maps structured visual/text segments into sections with kind & imageRegion locator. */
  fromImageResult(
    result: VisionExtractionResult,
    options: ImageDocumentOptions = {},
  ): NormalizedDocument {
    const title =
      options.title ??
      result.title ??
      options.filename ??
      options.fileName ??
      'Image Document';

    const normalizedRawText = normalizeProse(result.rawText || '');

    let currentHeadingPath: string[] = [];
    const sections: DocumentSection[] = (result.segments || []).map(
      (segment, index) => {
        const content = normalizeProse(segment.content);
        if (segment.kind === 'heading') {
          currentHeadingPath = [content];
        }

        return {
          headingPath: [...currentHeadingPath],
          content,
          ordinal: index,
          kind: segment.kind,
          locator: segment.imageRegion
            ? { imageRegion: segment.imageRegion }
            : {},
          metadata: {
            ...(segment.confidence !== undefined
              ? { confidence: segment.confidence }
              : {}),
          },
        };
      },
    );

    const finalSections =
      sections.length > 0
        ? sections
        : singleSection(normalizedRawText || 'Image Document');

    const text =
      normalizedRawText || finalSections.map((s) => s.content).join('\n\n');

    return {
      title,
      text,
      extractionMethod: 'vision',
      contentType: options.contentType,
      sourceUrl: options.sourceUrl,
      contentHash: contentHashOf(text),
      sections: finalSections,
    };
  }

  /** Transcription extraction: maps structured transcript segments into sections with kind 'transcript' & start/end offset locator. */
  fromAudioResult(
    result: TranscriptionResult,
    options: AudioDocumentOptions = {},
  ): NormalizedDocument {
    const title =
      options.title ??
      result.title ??
      options.filename ??
      options.fileName ??
      'Audio Document';

    const normalizedRawText = normalizeProse(result.rawText || '');

    const sections: DocumentSection[] = (result.segments || []).map(
      (segment, index) => {
        const content = normalizeProse(segment.content);
        const headingPath = segment.speaker ? [segment.speaker] : [];

        return {
          headingPath,
          content,
          ordinal: index,
          kind: 'transcript' as const,
          locator: {
            startOffsetMs: segment.startOffsetMs,
            endOffsetMs: segment.endOffsetMs,
            ...(segment.speaker ? { speaker: segment.speaker } : {}),
          },
          metadata: {
            ...(segment.confidence !== undefined
              ? { confidence: segment.confidence }
              : {}),
            ...(result.durationMs !== undefined
              ? { durationMs: result.durationMs }
              : result.durationSeconds !== undefined
                ? { durationMs: Math.round(result.durationSeconds * 1000) }
                : {}),
          },
        };
      },
    );

    const finalSections =
      sections.length > 0
        ? sections
        : singleSection(normalizedRawText || 'Audio Document');

    const text =
      normalizedRawText || finalSections.map((s) => s.content).join('\n\n');

    return {
      title,
      text,
      language: result.language ?? options.language,
      extractionMethod: 'transcription',
      contentType: options.contentType,
      sourceUrl: options.sourceUrl,
      contentHash: contentHashOf(text),
      sections: finalSections,
    };
  }

  /** Video transcription & visual keyframes extraction: maps structured transcript and visual segments into sections with timestamps and imageRegion locators. */
  fromVideoResult(
    result: TranscriptionResult,
    options: VideoDocumentOptions = {},
  ): NormalizedDocument {
    const title =
      options.title ??
      result.title ??
      options.filename ??
      options.fileName ??
      'Video Document';

    const normalizedRawText = normalizeProse(result.rawText || '');

    const transcriptSections: DocumentSection[] = (result.segments || []).map(
      (segment, index) => {
        const content = normalizeProse(segment.content);
        const headingPath = segment.speaker ? [segment.speaker] : [];

        return {
          headingPath,
          content,
          ordinal: index,
          kind: 'transcript' as const,
          locator: {
            startOffsetMs: segment.startOffsetMs,
            endOffsetMs: segment.endOffsetMs,
            ...(segment.speaker ? { speaker: segment.speaker } : {}),
          },
          metadata: {
            ...(segment.confidence !== undefined
              ? { confidence: segment.confidence }
              : {}),
            ...(result.durationMs !== undefined
              ? { durationMs: result.durationMs }
              : result.durationSeconds !== undefined
                ? { durationMs: Math.round(result.durationSeconds * 1000) }
                : {}),
          },
        };
      },
    );

    const visualSections: DocumentSection[] = [];
    if (options.visualResults && options.visualResults.length > 0) {
      for (const { keyframe, result: visResult } of options.visualResults) {
        const startOffsetMs = keyframe.timestampMs;
        const endOffsetMs =
          keyframe.timestampMs + (keyframe.durationMs ?? 5000);

        for (const seg of visResult.segments || []) {
          const content = normalizeProse(seg.content);
          if (!content) continue;

          visualSections.push({
            headingPath: seg.kind === 'heading' ? [content] : ['Visual Scene'],
            content,
            ordinal: 0,
            kind: seg.kind,
            locator: {
              startOffsetMs,
              endOffsetMs,
              ...(seg.imageRegion ? { imageRegion: seg.imageRegion } : {}),
            },
            metadata: {
              visualKeyframe: true,
              isKeyframe: true,
              ...(seg.confidence !== undefined
                ? { confidence: seg.confidence }
                : {}),
            },
          });
        }
      }
    }

    // Merge all sections and sort chronologically by startOffsetMs
    const allSections = [...transcriptSections, ...visualSections].sort(
      (a, b) =>
        (a.locator?.startOffsetMs ?? 0) - (b.locator?.startOffsetMs ?? 0),
    );

    const indexedSections = allSections.map((sec, idx) => ({
      ...sec,
      ordinal: idx,
    }));

    const finalSections = indexedSections;

    const text =
      finalSections.length > 0
        ? finalSections.map((s) => s.content).join('\n\n')
        : normalizedRawText || '';

    return {
      title,
      text,
      language: result.language ?? options.language,
      extractionMethod: visualSections.length > 0 ? 'video' : 'transcription',
      contentType: options.contentType,
      sourceUrl: options.sourceUrl,
      contentHash: contentHashOf(text),
      sections: finalSections,
    };
  }

  /** YouTube acquisition: maps YouTube transcript/metadata into structured sections with kind 'transcript'. */
  fromYouTubeResult(
    result: YouTubeAcquisitionResult,
    options: YouTubeDocumentOptions = {},
  ): NormalizedDocument {
    const title =
      options.title ?? result.title ?? `YouTube Video (${result.videoId})`;

    const sections: DocumentSection[] = (result.segments || []).map(
      (segment, index) => {
        const content = normalizeProse(segment.content);
        const headingPath = segment.speaker ? [segment.speaker] : [];

        return {
          headingPath,
          content,
          ordinal: index,
          kind: 'transcript' as const,
          locator: {
            startOffsetMs: segment.startOffsetMs,
            endOffsetMs: segment.endOffsetMs,
            ...(segment.speaker ? { speaker: segment.speaker } : {}),
          },
          metadata: {
            ...(result.durationMs !== undefined
              ? { durationMs: result.durationMs }
              : {}),
          },
        };
      },
    );

    const defaultUrl = result.videoId
      ? `https://www.youtube.com/watch?v=${result.videoId}`
      : undefined;

    const text =
      sections.length > 0
        ? sections.map((s) => s.content).join('\n\n')
        : result.rawText || '';

    return {
      title,
      text,
      siteName: 'YouTube',
      author: options.author ?? result.author,
      extractionMethod: 'youtube',
      contentType: options.contentType ?? 'text/html',
      sourceUrl: options.sourceUrl ?? defaultUrl,
      canonicalUrl: options.canonicalUrl ?? defaultUrl,
      contentHash: contentHashOf(text),
      sections,
    };
  }

  fromPptxResult(
    result: PptxParseResult,
    options: PptxDocumentOptions = {},
  ): NormalizedDocument {
    const title =
      options.title ?? options.filename ?? options.fileName ?? 'PPTX Document';
    // Build sections: each slide -> heading+text, notes -> separate transcript-like text
    const sections: DocumentSection[] = [];
    let ordinal = 0;
    for (const slide of result.slides) {
      const joined = slide.texts.join('\n\n');
      const content = normalizeProse(
        joined || slide.title || `Slide ${slide.slideNumber}`,
      );
      const isTitleSlide = slide.slideNumber === 1 && slide.texts.length === 1;
      sections.push({
        headingPath: slide.title ? [slide.title] : [],
        content,
        ordinal: ordinal++,
        kind: isTitleSlide ? 'heading' : 'text',
        locator: { slideNumber: slide.slideNumber },
        metadata: { hasNotes: !!slide.notes },
      });
      if (slide.notes) {
        const notesContent = normalizeProse(slide.notes);
        if (notesContent) {
          sections.push({
            headingPath: slide.title ? [slide.title, 'Notes'] : ['Notes'],
            content: notesContent,
            ordinal: ordinal++,
            kind: 'text',
            locator: { slideNumber: slide.slideNumber },
            metadata: { isSpeakerNotes: true },
          });
        }
      }
    }
    const rawText = sections.map((s) => s.content).join('\n\n');
    const normalizedRawText = normalizeProse(rawText || title);
    const finalSections =
      sections.length > 0 ? sections : singleSection(normalizedRawText);
    const text =
      normalizedRawText || finalSections.map((s) => s.content).join('\n\n');
    return {
      title,
      text,
      extractionMethod: 'parser',
      contentType:
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      contentHash: contentHashOf(text),
      sections: finalSections,
    };
  }

  fromEpubResult(
    result: EpubParseResult,
    options: EpubDocumentOptions = {},
  ): NormalizedDocument {
    const title =
      options.title ?? options.filename ?? options.fileName ?? 'EPUB Document';
    const sections: DocumentSection[] = result.chapters.map((chapter, idx) => ({
      headingPath: [chapter.title],
      content: normalizeProse(chapter.textContent || chapter.title),
      ordinal: idx,
      kind: 'text',
      locator: {
        pageNumber: chapter.ordinal,
        ...({
          chapterNumber: chapter.ordinal,
        } as unknown as DocumentSectionLocator),
      },
      metadata: { href: chapter.href },
    }));
    const rawText = sections.map((s) => s.content).join('\n\n');
    const normalizedRawText = normalizeProse(rawText || title);
    const finalSections =
      sections.length > 0 ? sections : singleSection(normalizedRawText);
    const text =
      normalizedRawText || finalSections.map((s) => s.content).join('\n\n');
    return {
      title,
      text,
      extractionMethod: 'parser',
      contentType: 'application/epub+zip',
      contentHash: contentHashOf(text),
      sections: finalSections,
    };
  }

  fromTabularResult(
    result: ParsedTabularResult,
    options: TabularDocumentOptions = {},
  ): NormalizedDocument {
    const title = options.title ?? result.title;
    const text = result.rawText;

    const sections: DocumentSection[] = result.sheets.map((sheet, idx) => ({
      headingPath: [title, sheet.sheetName],
      content: sheet.rawText,
      ordinal: idx,
      kind: 'table',
      locator: {
        sheetName: sheet.sheetName,
        cellRange: sheet.cellRange,
        lineStart: 1,
        lineEnd: sheet.rowCount,
      },
      metadata: {
        rowCount: sheet.rowCount,
        columnCount: sheet.columnCount,
        headers: sheet.headers,
        columns: sheet.columns,
      },
    }));

    return {
      title,
      text,
      extractionMethod: 'tabular',
      contentType:
        result.format === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : result.format === 'tsv'
            ? 'text/tab-separated-values'
            : 'text/csv',
      contentHash: contentHashOf(text),
      sections: sections.length > 0 ? sections : singleSection(text),
    };
  }
}

export interface TabularDocumentOptions {
  title?: string;
}

export interface ImageDocumentOptions {
  title?: string;
  fileName?: string;
  filename?: string;
  contentType?: string;
  sourceUrl?: string;
}

export interface AudioDocumentOptions {
  title?: string;
  fileName?: string;
  filename?: string;
  contentType?: string;
  sourceUrl?: string;
  language?: string;
}

export interface VideoDocumentOptions {
  title?: string;
  fileName?: string;
  filename?: string;
  contentType?: string;
  sourceUrl?: string;
  language?: string;
  visualResults?: Array<{
    keyframe: VideoKeyframe;
    result: VisionExtractionResult;
  }>;
}

export interface YouTubeDocumentOptions {
  title?: string;
  author?: string;
  sourceUrl?: string;
  canonicalUrl?: string;
  contentType?: string;
}

export interface PptxDocumentOptions {
  title?: string;
  filename?: string;
  fileName?: string;
}

export interface EpubDocumentOptions {
  title?: string;
  filename?: string;
  fileName?: string;
}

function detectMarkdown(contentType: string, fileName?: string): boolean {
  const ct = contentType.toLowerCase().split(';')[0].trim();
  if (
    ct === 'text/markdown' ||
    ct === 'text/x-markdown' ||
    ct === 'application/markdown'
  ) {
    return true;
  }
  if (fileName) {
    const lower = fileName.toLowerCase();
    return lower.endsWith('.md') || lower.endsWith('.markdown');
  }
  return false;
}
