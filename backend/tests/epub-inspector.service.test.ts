import { describe, expect, it } from 'vitest';
import { BadRequestError } from '../src/common/errors/domain-error';
import {
  EpubInspectorService,
  isEpubFile,
  MAX_EPUB_BYTES,
  MAX_EPUB_CHAPTERS,
} from '../src/modules/sources/epub-inspector.service';
import { createStoredZip } from '../src/modules/sources/zip-helpers';

function createMinimalEpub(
  opts: {
    chapterCount?: number;
    withToc?: boolean;
    invalidMimetype?: boolean;
    missingContainer?: boolean;
  } = {},
): Buffer {
  const chapterCount = opts.chapterCount ?? 2;
  const entries: Array<{ name: string; content: string | Buffer }> = [];
  const mimetypeContent = opts.invalidMimetype
    ? 'application/zip'
    : 'application/epub+zip';
  entries.push({ name: 'mimetype', content: mimetypeContent });
  if (!opts.missingContainer) {
    const containerXml = `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`;
    entries.push({ name: 'META-INF/container.xml', content: containerXml });
  }
  // Build OPF
  let manifest = '';
  let spine = '';
  for (let i = 1; i <= chapterCount; i++) {
    manifest += `<item id="ch${i}" href="chapter${i}.xhtml" media-type="application/xhtml+xml"/>`;
    spine += `<itemref idref="ch${i}"/>`;
  }
  if (opts.withToc) {
    manifest += `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`;
    spine = spine.replace('<itemref', '<itemref'); // keep
  }
  const tocAttr = opts.withToc ? ' toc="ncx"' : '';
  const opf = `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata></metadata><manifest>${manifest}</manifest><spine${tocAttr}>${spine}</spine></package>`;
  entries.push({ name: 'OEBPS/content.opf', content: opf });
  for (let i = 1; i <= chapterCount; i++) {
    entries.push({
      name: `OEBPS/chapter${i}.xhtml`,
      content: `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter ${i}</title></head><body><h1>Chapter ${i}</h1><p>Content ${i}</p></body></html>`,
    });
  }
  if (opts.withToc) {
    entries.push({
      name: 'OEBPS/toc.ncx',
      content: '<?xml version="1.0"?><ncx></ncx>',
    });
  }
  return createStoredZip(entries);
}

describe('EpubInspectorService', () => {
  const inspector = new EpubInspectorService();

  it('validates EPUB ZIP+mimetype and extracts chapterCount', () => {
    const epub = createMinimalEpub({ chapterCount: 3 });
    const result = inspector.inspect(epub, {
      filename: 'book.epub',
      contentType: 'application/epub+zip',
    });
    expect(result.mimeType).toBe('application/epub+zip');
    expect(result.chapterCount).toBe(3);
  });

  it('detects TOC via NCX', () => {
    const epub = createMinimalEpub({ chapterCount: 2, withToc: true });
    const result = inspector.inspect(epub);
    expect(result.hasToc).toBe(true);
  });

  it('hasToc false when no NCX/nav', () => {
    const epub = createMinimalEpub({ chapterCount: 1, withToc: false });
    const result = inspector.inspect(epub);
    expect(result.hasToc).toBe(false);
  });

  it('rejects missing mimetype', () => {
    const entries: Array<{ name: string; content: string }> = [
      {
        name: 'META-INF/container.xml',
        content:
          '<container><rootfiles><rootfile full-path="content.opf"/></rootfiles></container>',
      },
      {
        name: 'content.opf',
        content: '<package><manifest></manifest><spine></spine></package>',
      },
    ];
    const buf = createStoredZip(entries);
    expect(() => inspector.inspect(buf)).toThrow(BadRequestError);
    expect(() => inspector.inspect(buf)).toThrow(/mimetype/);
  });

  it('rejects missing container.xml', () => {
    const epub = createMinimalEpub({ missingContainer: true });
    expect(() => inspector.inspect(epub)).toThrow(BadRequestError);
    expect(() => inspector.inspect(epub)).toThrow(/container\.xml/);
  });

  it('rejects invalid mimetype content', () => {
    const epub = createMinimalEpub({ invalidMimetype: true });
    expect(() => inspector.inspect(epub)).toThrow(BadRequestError);
  });

  it('rejects non-ZIP buffer', () => {
    const txt = Buffer.from('not a zip');
    expect(() => inspector.inspect(txt)).toThrow(BadRequestError);
  });

  it('rejects empty buffer', () => {
    expect(() => inspector.inspect(Buffer.alloc(0))).toThrow(BadRequestError);
  });

  it('rejects exceeding 200MB limit', () => {
    const epub = createMinimalEpub({ chapterCount: 1 });
    expect(() =>
      inspector.inspect(epub, { sizeBytes: MAX_EPUB_BYTES + 1 }),
    ).toThrow(BadRequestError);
  });

  it('rejects chapter count exceeding 500', () => {
    const epub = createMinimalEpub({ chapterCount: MAX_EPUB_CHAPTERS + 1 });
    expect(() => inspector.inspect(epub)).toThrow(BadRequestError);
  });

  it('detects archive bomb via entry count', () => {
    const entries: Array<{ name: string; content: string }> = [
      { name: 'mimetype', content: 'application/epub+zip' },
      {
        name: 'META-INF/container.xml',
        content:
          '<container><rootfiles><rootfile full-path="content.opf"/></rootfiles></container>',
      },
    ];
    const opf = '<package><manifest></manifest><spine></spine></package>';
    entries.push({ name: 'content.opf', content: opf });
    for (let i = 0; i < 1001; i++)
      entries.push({
        name: `OEBPS/ch${i}.xhtml`,
        content: '<html><p>hi</p></html>',
      });
    const bomb = createStoredZip(entries);
    expect(() => inspector.inspect(bomb)).toThrow(BadRequestError);
  });

  it('rejects corrupt ZIP header', () => {
    const corrupt = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    expect(() => inspector.inspect(corrupt)).toThrow(BadRequestError);
  });

  describe('isEpubFile helper', () => {
    it('identifies EPUB by MIME and extension', () => {
      expect(isEpubFile('application/epub+zip', null)).toBe(true);
      expect(isEpubFile(null, 'book.epub')).toBe(true);
      expect(isEpubFile(null, 'BOOK.EPUB')).toBe(true);
      expect(isEpubFile('application/pdf', 'file.pdf')).toBe(false);
      expect(isEpubFile(null, null)).toBe(false);
    });
  });
});
