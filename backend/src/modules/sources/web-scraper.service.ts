import { Injectable } from '@nestjs/common';
import { isProbablyReaderable, Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { WebScrapeError } from './source-errors';

export interface ScrapedPage {
  title: string;
  text: string;
  /** Article content HTML, used to derive structured sections. */
  html: string;
  excerpt?: string;
  byline?: string;
  siteName?: string;
  lang?: string;
}

const MIN_CLEAN_TEXT_LENGTH = 200;

const NOISE_SELECTORS = [
  // Wikipedia Citation & Reference containers
  'sup.reference',
  '.reflist',
  '.references',
  '.mw-cite-backlink',
  '#References',
  '#External_links',
  '.navbox',
  '.catlinks',
  '.authority-control',
  '.portal',
  '.vertical-navbox',
  '.mw-editsection',
  '.citation',
  // Generic Noise
  'nav',
  'footer',
  '.advertisement',
  '.social-share',
  '.comments-section',
  '.sidebar',
];

function cleanDomNoise(document: Document): void {
  for (const selector of NOISE_SELECTORS) {
    const elements = document.querySelectorAll(selector);
    elements.forEach((el) => el.remove());
  }
}

function normalizeBasicText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\u0000')
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function deriveTitleFromHtml(document: Document): string | undefined {
  const ogTitle = document
    .querySelector('meta[property="og:title"]')
    ?.getAttribute('content')
    ?.trim();
  if (ogTitle) return ogTitle;
  const docTitle = document.title?.trim();
  return docTitle || undefined;
}

@Injectable()
export class WebScraperService {
  /**
   * Extracts the main article from an HTML page using Readability.
   * Fetching, URL policy, and normalization are handled by other services.
   */
  extractHtml(html: string, baseUrl: string): ScrapedPage {
    const dom = new JSDOM(html, { url: baseUrl });
    const document = dom.window.document;

    if (!isProbablyReaderable(document)) {
      throw new WebScrapeError(
        'Page does not contain article-like content',
        'not_readerable',
        { messageKey: 'errors.sources.web.notReaderable' },
      );
    }

    // 1. Try DOM pre-cleaned extraction first
    const cleanedDoc = document.cloneNode(true) as Document;
    cleanDomNoise(cleanedDoc);

    let article = new Readability(cleanedDoc, {
      charThreshold: 200,
    }).parse();

    // 2. Safety Fallback: if pre-cleaning stripped too much text (< 200 chars), use uncleaned DOM
    if (
      !article ||
      !article.textContent ||
      article.textContent.trim().length < MIN_CLEAN_TEXT_LENGTH
    ) {
      article = new Readability(document.cloneNode(true) as Document, {
        charThreshold: 200,
      }).parse();
    }

    if (!article || !article.textContent) {
      throw new WebScrapeError(
        'Could not extract main content from page',
        'extraction_failed',
        { messageKey: 'errors.sources.web.extractionFailed' },
      );
    }

    return {
      title: article.title?.trim() || deriveTitleFromHtml(document) || baseUrl,
      text: normalizeBasicText(article.textContent),
      html: article.content ?? '',
      excerpt: article.excerpt ?? undefined,
      byline: article.byline ?? undefined,
      siteName: article.siteName ?? undefined,
      lang: article.lang ?? undefined,
    };
  }
}
