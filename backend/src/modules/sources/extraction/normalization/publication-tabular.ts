import type { YouTubeAcquisitionResult } from '../../acquisition/youtube-acquisition.service';
import type { PptxParseResult } from '../pptx-parser.service';
import type { EpubParseResult } from '../epub-parser.service';
import type { ParsedTabularResult } from '../tabular-parser.service';
import type {
  NormalizedDocument,
  YouTubeDocumentOptions,
  PptxDocumentOptions,
  EpubDocumentOptions,
  TabularDocumentOptions,
  DocumentSection,
  DocumentSectionLocator,
} from './document.types';
import {
  contentHashOf,
  normalizeProse,
  singleSection,
} from './document-normalization';

export function fromYouTubeResult(
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

export function fromPptxResult(
  result: PptxParseResult,
  options: PptxDocumentOptions = {},
): NormalizedDocument {
  const title =
    options.title ?? options.filename ?? options.fileName ?? 'PPTX Document';
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

export function fromEpubResult(
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

export function fromTabularResult(
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
