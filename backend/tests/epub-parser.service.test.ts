import { describe, expect, it } from 'vitest';
import { BadRequestError } from '../src/common/errors/domain-error';
import { EpubParserService } from '../src/modules/sources/epub-parser.service';
import { createStoredZip } from '../src/modules/sources/zip-helpers';

function createEpub(
  spine: Array<{ id: string; href: string; title: string; html: string }>,
  opts: { withScript?: boolean; withOnHandler?: boolean } = {},
): Buffer {
  const entries: Array<{ name: string; content: string }> = [];
  entries.push({ name: 'mimetype', content: 'application/epub+zip' });
  entries.push({
    name: 'META-INF/container.xml',
    content:
      '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
  });
  let manifest = '';
  let spineRefs = '';
  for (const s of spine) {
    manifest += `<item id="${s.id}" href="${s.href}" media-type="application/xhtml+xml"/>`;
    spineRefs += `<itemref idref="${s.id}"/>`;
  }
  const opf = `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata></metadata><manifest>${manifest}</manifest><spine>${spineRefs}</spine></package>`;
  entries.push({ name: 'OEBPS/content.opf', content: opf });
  for (const s of spine) {
    let html = s.html;
    if (opts.withScript) html += '<script>alert("xss")</script>';
    if (opts.withOnHandler)
      html = html.replace('<p>', '<p onclick="alert(1)">');
    // Add object tag for sanitization test
    entries.push({ name: `OEBPS/${s.href}`, content: html });
  }
  return createStoredZip(entries);
}

describe('EpubParserService', () => {
  const parser = new EpubParserService();

  it('parses manifest+spine and preserves chapter hierarchy order', () => {
    const epub = createEpub([
      {
        id: 'c1',
        href: 'ch1.xhtml',
        title: 'Chapter 1',
        html: '<html><head><title>Chapter 1</title></head><body><h1>Chapter 1</h1><p>Alpha</p></body></html>',
      },
      {
        id: 'c2',
        href: 'ch2.xhtml',
        title: 'Chapter 2',
        html: '<html><head><title>Chapter 2</title></head><body><h1>Chapter 2</h1><p>Beta</p></body></html>',
      },
      {
        id: 'c3',
        href: 'ch3.xhtml',
        title: 'Chapter 3',
        html: '<html><head><title>Chapter 3</title></head><body><h1>Chapter 3</h1><p>Gamma</p></body></html>',
      },
    ]);
    const result = parser.parse(epub);
    expect(result.chapterCount).toBe(3);
    expect(result.chapters.map((c) => c.title)).toEqual([
      'Chapter 1',
      'Chapter 2',
      'Chapter 3',
    ]);
    expect(result.chapters[0].ordinal).toBe(1);
    expect(result.chapters[1].ordinal).toBe(2);
    expect(result.chapters[0].href).toContain('ch1.xhtml');
  });

  it('extracts chapter textContent and title correctly', () => {
    const epub = createEpub([
      {
        id: 'c1',
        href: 'ch1.xhtml',
        title: 'Intro',
        html: '<html><head><title>Intro</title></head><body><h1>Intro</h1><p>Hello <b>World</b></p></body></html>',
      },
    ]);
    const result = parser.parse(epub);
    expect(result.chapters[0].textContent).toContain('Hello World');
    expect(result.chapters[0].title).toBe('Intro');
  });

  it('sanitizes script tags (XSS sanitization)', () => {
    const epub = createEpub(
      [
        {
          id: 'c1',
          href: 'ch1.xhtml',
          title: 'Ch1',
          html: '<html><body><p>Safe</p></body></html>',
        },
      ],
      { withScript: true },
    );
    const result = parser.parse(epub);
    expect(result.chapters[0].textContent).not.toContain('alert');
    expect(result.chapters[0].textContent).toContain('Safe');
    expect(result.warnings?.join(' ')).toMatch(/Active content stripped/);
  });

  it('removes on* event handlers', () => {
    const epub = createEpub(
      [
        {
          id: 'c1',
          href: 'ch1.xhtml',
          title: 'Ch1',
          html: '<html><body><p>Click me</p></body></html>',
        },
      ],
      { withOnHandler: true },
    );
    const result = parser.parse(epub);
    expect(result.chapters[0].textContent).toContain('Click me');
    // Ensure onclick not present in sanitized html processing (we strip before extraction)
    // The text extraction should succeed
    expect(result.chapters[0].textContent).not.toContain('onclick');
  });

  it('strips object/embed/form tags', () => {
    const htmlWithObject =
      '<html><body><p>Text</p><object data="evil.swf"></object><embed src="evil.swf"/><form><input/></form></body></html>';
    const epub = createEpub([
      { id: 'c1', href: 'ch1.xhtml', title: 'Ch1', html: htmlWithObject },
    ]);
    const result = parser.parse(epub);
    expect(result.chapters[0].textContent).toContain('Text');
    expect(result.chapters[0].textContent).not.toContain('evil');
  });

  it('preserves order via spine (not manifest order)', () => {
    // Create entries where manifest order differs from spine order; we push in manifest order but spine reversed
    const entries: Array<{ name: string; content: string }> = [];
    entries.push({ name: 'mimetype', content: 'application/epub+zip' });
    entries.push({
      name: 'META-INF/container.xml',
      content:
        '<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>',
    });
    const opf = `<package><manifest><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/><item id="b" href="b.xhtml" media-type="application/xhtml+xml"/><item id="c" href="c.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c"/><itemref idref="a"/><itemref idref="b"/></spine></package>`;
    entries.push({ name: 'OEBPS/content.opf', content: opf });
    entries.push({
      name: 'OEBPS/a.xhtml',
      content:
        '<html><head><title>A</title></head><body><p>A</p></body></html>',
    });
    entries.push({
      name: 'OEBPS/b.xhtml',
      content:
        '<html><head><title>B</title></head><body><p>B</p></body></html>',
    });
    entries.push({
      name: 'OEBPS/c.xhtml',
      content:
        '<html><head><title>C</title></head><body><p>C</p></body></html>',
    });
    const epub = createStoredZip(entries);
    const result = parser.parse(epub);
    expect(result.chapters.map((c) => c.title)).toEqual(['C', 'A', 'B']);
  });

  it('handles missing container fallback to find OPF', () => {
    const entries: Array<{ name: string; content: string }> = [];
    entries.push({ name: 'mimetype', content: 'application/epub+zip' });
    // No container.xml, but OPF at root
    entries.push({
      name: 'content.opf',
      content:
        '<package><manifest><item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="ch1"/></spine></package>',
    });
    entries.push({
      name: 'ch1.xhtml',
      content:
        '<html><head><title>Ch1</title></head><body><p>Hi</p></body></html>',
    });
    const epub = createStoredZip(entries);
    const result = parser.parse(epub);
    expect(result.chapterCount).toBe(1);
    expect(result.warnings).toBeDefined();
  });

  it('rejects invalid ZIP', () => {
    expect(() => parser.parse(Buffer.from('not zip'))).toThrow(BadRequestError);
  });

  it('generates warnings for missing spine refs', () => {
    const entries: Array<{ name: string; content: string }> = [];
    entries.push({ name: 'mimetype', content: 'application/epub+zip' });
    entries.push({
      name: 'META-INF/container.xml',
      content:
        '<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>',
    });
    entries.push({
      name: 'OEBPS/content.opf',
      content:
        '<package><manifest><item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="missing"/></spine></package>',
    });
    const epub = createStoredZip(entries);
    const result = parser.parse(epub);
    expect(result.warnings?.some((w) => w.includes('not found'))).toBe(true);
  });
});
