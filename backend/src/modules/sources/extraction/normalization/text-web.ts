import type { ScrapedPage } from '../../acquisition/web-scraper.service';
import { measureHtmlLinkDensity } from '../../source-quality.service';
import type {
  FirecrawlDocumentInput,
  FirecrawlMetaInput,
  ParsedFileDocument,
} from '../../../crawler/crawler.types';
import type { NormalizedDocument, FileDocumentInput } from './document.types';
import {
  contentHashOf,
  normalizeProse,
  singleSection,
  stripProvenCitations,
  asMetadataString,
} from './document-normalization';
import { sectionsFromHtml } from './html-sections';
import { sectionsFromMarkdown } from './markdown-sections';

export function fromText(text: string, title: string): NormalizedDocument {
  const normalized = normalizeProse(text);
  return {
    title,
    text: normalized,
    extractionMethod: 'text',
    contentHash: contentHashOf(normalized),
    sections: singleSection(normalized),
  };
}

export function fromFile(input: FileDocumentInput): NormalizedDocument {
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

export function fromHtml(
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
    linkDensity: page.linkDensity ?? measureHtmlLinkDensity(page.html),
  };
}

export function fromFirecrawlResult(
  doc: FirecrawlDocumentInput,
  meta: FirecrawlMetaInput,
): NormalizedDocument {
  const raw = doc.markdown ?? '';
  const normalized = normalizeProse(raw);
  const sections = sectionsFromMarkdown(raw);
  const metadata = doc.metadata ?? {};

  return {
    title:
      doc.title?.trim() || asMetadataString(metadata, 'title') || 'Untitled',
    text: normalized,
    markdown: raw,
    sourceUrl: meta.sourceUrl,
    canonicalUrl: meta.canonicalUrl,
    fetchedUrl: meta.fetchedUrl,
    language: asMetadataString(metadata, 'language'),
    author: asMetadataString(metadata, 'author'),
    siteName: asMetadataString(metadata, 'siteName'),
    publishedAt: asMetadataString(metadata, 'publishedTime', 'publishedAt'),
    modifiedAt: asMetadataString(metadata, 'modifiedTime', 'modifiedAt'),
    extractionMethod: 'firecrawl',
    contentType: meta.contentType,
    contentHash: contentHashOf(normalized),
    sections,
  };
}

export function fromParsedFileResult(
  doc: ParsedFileDocument,
  meta: { fileName: string; contentType: string },
): NormalizedDocument {
  const markdown = doc.markdown ?? '';
  const text = normalizeProse(markdown);
  const metadata = doc.metadata ?? {};
  const pageCount = ['numPages', 'totalPages', 'pageCount']
    .map((key) => metadata[key])
    .find(
      (value): value is number =>
        typeof value === 'number' && Number.isSafeInteger(value) && value > 0,
    );

  return {
    title:
      doc.title?.trim() ||
      asMetadataString(metadata, 'title')?.trim() ||
      meta.fileName,
    text,
    markdown,
    author: asMetadataString(metadata, 'author')?.trim(),
    pageCount,
    extractionMethod: 'firecrawl',
    contentType: meta.contentType,
    contentHash: contentHashOf(text),
    sections: sectionsFromMarkdown(markdown),
  };
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
