import { Injectable } from '@nestjs/common';
import { isProbablyReaderable, Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { WebScrapeError } from './source-errors';
import { measureHtmlLinkDensity, wordTokens } from './source-quality.service';

export interface ScrapedPage {
  title: string;
  text: string;
  /** Article content HTML, used to derive structured sections. */
  html: string;
  excerpt?: string;
  byline?: string;
  siteName?: string;
  lang?: string;
  /** Word-based link density of the extracted article HTML. */
  linkDensity?: number;
}

const MIN_CLEAN_TEXT_LENGTH = 200;
/** Retry with the looser heuristic when the extraction is at least this link-dense. */
export const RETRY_LINK_DENSITY_THRESHOLD = 0.4;
/** Retry with the looser heuristic when the extraction is shorter than this. */
export const RETRY_MIN_TEXT_LENGTH = 400;
/** A body block at or above this link density is navigation, not content. */
const LINK_BLOCK_DENSITY = 0.8;
/** Body blocks shorter than this are not considered navigation containers. */
const LINK_BLOCK_MIN_CHARS = 200;

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

/**
 * Removes body blocks whose text is almost entirely anchor text. Tables of
 * contents and navigation trees look like content to Readability's scoring but
 * carry no substance.
 */
function stripLinkDenseBlocks(document: Document): void {
  for (const element of Array.from(document.querySelectorAll('body *'))) {
    const text = element.textContent?.trim() ?? '';
    if (text.length < LINK_BLOCK_MIN_CHARS) continue;
    const totalWords = wordTokens(text).length;
    if (totalWords === 0) continue;
    let linkWords = 0;
    element.querySelectorAll('a').forEach((anchor) => {
      linkWords += wordTokens(anchor.textContent ?? '').length;
    });
    if (linkWords / totalWords < LINK_BLOCK_DENSITY) continue;
    // A container that also holds prose paragraphs is not pure navigation.
    if (element.querySelector('p, h1, h2, h3, h4, h5, h6')) continue;
    element.remove();
  }
}

function collectBlockText(body: HTMLElement): string {
  const blocks = Array.from(
    body.querySelectorAll(
      'p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, td, th',
    ),
  )
    .map((block) => (block.textContent ?? '').trim())
    .filter((text) => text.length > 0);
  if (blocks.length > 0) return normalizeBasicText(blocks.join('\n\n'));
  return normalizeBasicText(body.textContent ?? '');
}

interface ExtractedArticle {
  title: string;
  text: string;
  html: string;
  linkDensity: number;
  excerpt?: string;
  byline?: string;
  siteName?: string;
  lang?: string;
}

/**
 * Picks the most usable extraction: a candidate that clears both the length
 * floor and the link-density bar wins, preferring the longest; otherwise the
 * least link-dense candidate wins, with the longest text as the tie-breaker.
 */
function pickBestExtraction(candidates: ExtractedArticle[]): ExtractedArticle {
  const usable = candidates.filter(
    (candidate) =>
      candidate.linkDensity < RETRY_LINK_DENSITY_THRESHOLD &&
      candidate.text.length >= RETRY_MIN_TEXT_LENGTH,
  );
  const pool = usable.length > 0 ? usable : candidates;
  return pool.reduce((best, candidate) => {
    if (candidate.linkDensity < best.linkDensity) return candidate;
    if (
      candidate.linkDensity === best.linkDensity &&
      candidate.text.length > best.text.length
    ) {
      return candidate;
    }
    return best;
  });
}

@Injectable()
export class WebScraperService {
  /**
   * Extracts the main article from an HTML page using Readability.
   * Fetching, URL policy, and normalization are handled by other services.
   *
   * When the first extraction is mostly links or too short, the extraction is
   * retried with looser heuristics: Readability without a character threshold,
   * and the body with navigation-like blocks stripped. The most usable
   * candidate wins, so pages whose article container was misclassified still
   * have a chance of being captured.
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

    const primary = this.readArticle(document, { relaxed: false });

    if (!primary) {
      throw new WebScrapeError(
        'Could not extract main content from page',
        'extraction_failed',
        { messageKey: 'errors.sources.web.extractionFailed' },
      );
    }

    let chosen = primary;
    if (this.needsLooserRetry(primary)) {
      const candidates = [primary];
      const relaxed = this.readArticle(document, { relaxed: true });
      if (relaxed) candidates.push(relaxed);
      const fallback = this.readFallbackArticle(document);
      if (fallback) candidates.push(fallback);
      chosen = pickBestExtraction(candidates);
    }

    return {
      title: chosen.title?.trim() || deriveTitleFromHtml(document) || baseUrl,
      text: chosen.text,
      html: chosen.html,
      excerpt: chosen.excerpt ?? undefined,
      byline: chosen.byline ?? undefined,
      siteName: chosen.siteName ?? undefined,
      lang: chosen.lang ?? undefined,
      linkDensity: chosen.linkDensity,
    };
  }

  private readArticle(
    document: Document,
    options: { relaxed: boolean },
  ): ExtractedArticle | null {
    // The strict pass pre-cleans noise; the looser pass keeps the whole DOM
    // and drops the character threshold so short article containers survive.
    const source = document.cloneNode(true) as Document;
    if (!options.relaxed) cleanDomNoise(source);

    let article = new Readability(source, {
      charThreshold: options.relaxed ? 0 : 200,
    }).parse();

    // Safety fallback: if pre-cleaning stripped too much text, use the uncleaned DOM.
    if (
      !options.relaxed &&
      (!article ||
        !article.textContent ||
        article.textContent.trim().length < MIN_CLEAN_TEXT_LENGTH)
    ) {
      article = new Readability(document.cloneNode(true) as Document, {
        charThreshold: 200,
      }).parse();
    }

    if (!article || !article.textContent) return null;

    const articleHtml = article.content ?? '';
    return {
      title: article.title?.trim() || '',
      text: normalizeBasicText(article.textContent),
      html: articleHtml,
      linkDensity: measureHtmlLinkDensity(articleHtml),
      excerpt: article.excerpt ?? undefined,
      byline: article.byline ?? undefined,
      siteName: article.siteName ?? undefined,
      lang: article.lang ?? undefined,
    };
  }

  /** Whole-body fallback with obvious navigation containers removed. */
  private readFallbackArticle(document: Document): ExtractedArticle | null {
    const clone = document.cloneNode(true) as Document;
    cleanDomNoise(clone);
    clone
      .querySelectorAll('script, style, noscript, template, iframe')
      .forEach((el) => el.remove());
    stripLinkDenseBlocks(clone);

    const body = clone.body;
    if (!body) return null;
    const text = collectBlockText(body);
    if (!text) return null;

    const html = body.innerHTML ?? '';
    return {
      title: deriveTitleFromHtml(document) ?? '',
      text,
      html,
      linkDensity: measureHtmlLinkDensity(html),
    };
  }

  private needsLooserRetry(article: ExtractedArticle): boolean {
    return (
      article.linkDensity >= RETRY_LINK_DENSITY_THRESHOLD ||
      article.text.length < RETRY_MIN_TEXT_LENGTH
    );
  }
}
