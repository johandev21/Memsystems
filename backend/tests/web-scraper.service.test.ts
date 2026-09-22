import { describe, expect, it } from 'vitest';
import { WebScraperService } from '../src/modules/sources/web-scraper.service';

const ARTICLE_PAGE = `
  <!DOCTYPE html>
  <html>
    <head>
      <title>Epistemology - Wikipedia</title>
    </head>
    <body>
      <main id="content">
        <h1>Epistemology</h1>
        <p>
          Epistemology is the branch of philosophy concerned with knowledge<sup class="reference"><a href="#cite_note-1">[1]</a></sup>.
          Epistemologists study the nature, origin, and scope of knowledge, epistemic justification, the rationality of belief, and various related issues.
          Epistemology is considered one of the core subfields of philosophy, alongside ethics, logic, and metaphysics.
          Debates in epistemology are generally centered around four core areas: the philosophical analysis of the nature of knowledge and how it relates to concepts such as truth, belief, and justification.
        </p>
        <p>
          Knowledge is often defined as justified true belief<sup class="reference"><a href="#cite_note-2">[2]</a></sup>.
          This concept has been debated extensively across various philosophical traditions since Antiquity.
          The Gettier problem, presented by Edmund Gettier in 1963, challenged the traditional view that justified true belief constitutes knowledge by presenting counterexamples where a belief is both true and justified, yet fails to count as genuine knowledge<sup class="reference"><a href="#cite_note-3">[3]</a></sup>.
        </p>
        <div id="References" class="reflist">
          <h2>References</h2>
          <ol class="references">
            <li id="cite_note-1">1. Steup, Matthias (2005). Epistemology. Stanford Encyclopedia of Philosophy.</li>
            <li id="cite_note-2">2. Gettier, Edmund (1963). Is Justified True Belief Knowledge? Analysis 23 (6): 121–123.</li>
          </ol>
        </div>
        <div class="navbox">Navigation box content</div>
      </main>
    </body>
  </html>
`;

const SHELL_PAGE = `
  <!DOCTYPE html>
  <html>
    <head><title>App Shell</title></head>
    <body>
      <div id="root">
        <nav>Menu</nav>
        <footer>Copyright 2025</footer>
      </div>
    </body>
  </html>
`;

describe('WebScraperService', () => {
  const service = new WebScraperService();

  it('cleans Wikipedia citation sections and inline superscript references', () => {
    const scraped = service.extractHtml(
      ARTICLE_PAGE,
      'https://en.wikipedia.org/wiki/Epistemology',
    );

    expect(scraped.title).toBe('Epistemology - Wikipedia');
    // Inline citations live inside <sup class="reference">, removed by DOM cleaning
    expect(scraped.text).not.toContain('[1]');
    expect(scraped.text).not.toContain('[2]');
    expect(scraped.text).not.toContain('[3]');
    // Citation section (.reflist) and navbox are stripped
    expect(scraped.text).not.toContain('Steup, Matthias');
    expect(scraped.text).not.toContain('Gettier, Edmund');
    expect(scraped.text).not.toContain('Navigation box content');
    // Main text is present
    expect(scraped.text).toContain(
      'Epistemology is the branch of philosophy concerned with knowledge',
    );
    // Article HTML is exposed for section derivation
    expect(scraped.html).toContain('<p>');
  });

  it('throws not_readerable for pages with no article-like content', () => {
    expect(() =>
      service.extractHtml(SHELL_PAGE, 'https://example.com/app'),
    ).toThrow('does not contain article-like content');
  });

  it('throws not_readerable for empty pages', () => {
    expect(() =>
      service.extractHtml(
        '<!DOCTYPE html><html><body></body></html>',
        'https://example.com/empty',
      ),
    ).toThrow('does not contain article-like content');
  });

  it('tolerates malformed HTML', () => {
    const malformed = [
      '<html><head><title>Broken</title></head>',
      '<body><main><h1>Title</h1>',
      '<p>Some substantial paragraph text that makes this article readable enough to be extracted by the reader heuristic. It has plenty of words across several sentences, and every sentence adds just a little more length to the paragraph so the overall block crosses the content threshold comfortably.',
      '<p>Another paragraph with more content to push the length well past the readability threshold. Malformed markup like unclosed tags should not prevent extraction from working on broken pages, because the HTML parser recovers the structure and Readability only needs a solid block of text to work with.',
      '<p>Even a third paragraph to be safe: broken HTML is common in the wild, and the extractor should still return the readable core of the page for indexing. Each of these paragraphs is long enough to contribute meaningful reader score on its own.',
      '</main></body>',
    ].join('');
    const scraped = service.extractHtml(
      malformed,
      'https://example.com/broken',
    );
    expect(scraped.title).toBe('Broken');
    expect(scraped.text).toContain('Title');
  });

  it('retries with a looser heuristic when the first extraction is link-dense', () => {
    const tableOfContents = Array.from(
      { length: 60 },
      (_, i) =>
        `<li><a href="/chapter-${i}">Chapter ${i} study guide summary notes</a></li>`,
    ).join('');
    const linkDensePage = `
      <!DOCTYPE html>
      <html>
        <head><title>Beyond Good and Evil Summary</title></head>
        <body>
          <div class="toc"><h2>Table of Contents</h2><ul>${tableOfContents}</ul></div>
          <div class="article-body">
            <h1>Beyond Good and Evil Summary</h1>
            <p>Nietzsche's Beyond Good and Evil attacks the dogmatic opposition of good and evil that Western philosophy inherited from Plato and the Christian tradition. The book is organized into nine parts, each pursuing a different facet of the same question: what would a philosophy look like if it took the perspectival nature of knowledge seriously?</p>
            <p>The first part examines the prejudices of philosophers. Nietzsche argues that the will to truth is itself a moral commitment, and that the apparent opposites of true and false, good and evil, rest on a faith that cannot justify itself.</p>
            <p>The remaining parts develop the critique of religion, morality, and the philosophers of the future. The famous closing chapters insist that a genuine philosopher legislates values rather than merely describing them.</p>
          </div>
        </body>
      </html>
    `;

    const scraped = service.extractHtml(
      linkDensePage,
      'https://example.com/beyond-good-and-evil',
    );

    expect(scraped.text).toContain('perspectival nature of knowledge');
    expect(scraped.text).not.toContain('Chapter 3 study guide');
    expect(scraped.linkDensity).toBeLessThan(0.4);
  });
});
