import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { BadRequestError } from '../src/common/errors/domain-error';
import {
  isPptxFile,
  MAX_PPTX_BYTES,
  MAX_PPTX_SLIDES,
  PptxInspectorService,
} from '../src/modules/sources/pptx-inspector.service';
import { createStoredZip } from '../src/modules/sources/zip-helpers';

function createMinimalPptx(
  slideCount: number,
  opts: { withNotes?: boolean; withPresentationSize?: boolean } = {},
): Buffer {
  const entries: Array<{ name: string; content: string | Buffer }> = [];
  entries.push({
    name: '[Content_Types].xml',
    content:
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>',
  });
  let presXml =
    '<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldIdLst>';
  for (let i = 1; i <= slideCount; i++)
    presXml += `<p:sldId id="${256 + i}" r:id="rId${i}"/>`;
  presXml += '</p:sldIdLst>';
  if (opts.withPresentationSize)
    presXml += '<p:sldSz cx="12192000" cy="6858000"/>';
  presXml += '</p:presentation>';
  entries.push({ name: 'ppt/presentation.xml', content: presXml });
  for (let i = 1; i <= slideCount; i++) {
    const slideXml = `<?xml version="1.0"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Slide ${i} Content</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
    entries.push({ name: `ppt/slides/slide${i}.xml`, content: slideXml });
    if (opts.withNotes) {
      const notesXml = `<?xml version="1.0"?><p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Notes for slide ${i}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>`;
      entries.push({
        name: `ppt/notesSlides/notesSlide${i}.xml`,
        content: notesXml,
      });
    }
  }
  return createStoredZip(entries);
}

function createLegacyPptBuffer(): Buffer {
  const buf = Buffer.alloc(512);
  buf.writeUInt32BE(0xd0cf11e0, 0);
  buf.writeUInt32BE(0xa11b1ae1, 4);
  return buf;
}

describe('PptxInspectorService', () => {
  const inspector = new PptxInspectorService();

  it('validates PPTX ZIP magic and extracts slideCount', () => {
    const pptx = createMinimalPptx(3);
    const result = inspector.inspect(pptx, {
      filename: 'deck.pptx',
      contentType:
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    });
    expect(result.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    );
    expect(result.slideCount).toBe(3);
    expect(result.hasSpeakerNotes).toBe(false);
  });

  it('detects speaker notes', () => {
    const pptx = createMinimalPptx(2, { withNotes: true });
    const result = inspector.inspect(pptx);
    expect(result.slideCount).toBe(2);
    expect(result.hasSpeakerNotes).toBe(true);
  });

  it('extracts width/height from presentation.xml', () => {
    const pptx = createMinimalPptx(1, { withPresentationSize: true });
    const result = inspector.inspect(pptx);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('rejects legacy PPT OLE header', () => {
    const legacy = createLegacyPptBuffer();
    expect(() => inspector.inspect(legacy, { filename: 'old.ppt' })).toThrow(
      BadRequestError,
    );
    expect(() => inspector.inspect(legacy, { filename: 'old.ppt' })).toThrow(
      /Legacy PPT not supported/,
    );
  });

  it('rejects empty buffer', () => {
    expect(() => inspector.inspect(Buffer.alloc(0))).toThrow(BadRequestError);
  });

  it('rejects non-ZIP arbitrary text', () => {
    const txt = Buffer.from('This is not a zip file at all');
    expect(() => inspector.inspect(txt, { filename: 'deck.pptx' })).toThrow(
      BadRequestError,
    );
  });

  it('rejects corrupt ZIP with truncated header', () => {
    const corrupt = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    expect(() => inspector.inspect(corrupt)).toThrow(BadRequestError);
  });

  it('rejects file exceeding 200MB limit', () => {
    const buf = createMinimalPptx(1);
    expect(() =>
      inspector.inspect(buf, { sizeBytes: MAX_PPTX_BYTES + 1 }),
    ).toThrow(BadRequestError);
    // Also test buffer length limit path using fake large buffer length
    const fakeHuge = { length: MAX_PPTX_BYTES + 1 } as unknown as Buffer;
    // We can't fully fake without magic, but we test sizeBytes path above
  });

  it('rejects slide count exceeding 500', () => {
    const pptx = createMinimalPptx(MAX_PPTX_SLIDES + 1);
    expect(() => inspector.inspect(pptx)).toThrow(BadRequestError);
    expect(() => inspector.inspect(pptx)).toThrow(/slide count/);
  });

  it('accepts exactly 500 slides', () => {
    const pptx = createMinimalPptx(MAX_PPTX_SLIDES);
    const result = inspector.inspect(pptx);
    expect(result.slideCount).toBe(MAX_PPTX_SLIDES);
  });

  it('detects archive bomb via entry count > 1000', () => {
    const entries: Array<{ name: string; content: string }> = [];
    for (let i = 0; i < 1001; i++)
      entries.push({
        name: `ppt/slides/slide${i}.xml`,
        content: '<a:t>hi</a:t>',
      });
    // Add minimal required for PPTX structure else inspector will count slides anyway
    entries.push({ name: '[Content_Types].xml', content: '<Types/>' });
    const bomb = createStoredZip(entries);
    expect(() => inspector.inspect(bomb)).toThrow(BadRequestError);
    expect(() => inspector.inspect(bomb)).toThrow(/Archive bomb/);
  });

  it('detects archive bomb via compression ratio >100x (highly compressible entry)', () => {
    const highlyCompressible = Buffer.alloc(1024 * 1024, 'a'); // 1MB of 'a's
    const compressed = deflateRawSync(highlyCompressible);
    // Build a local header with deflate method (8) and high ratio >100
    const fileName = 'ppt/slides/slide1.xml';
    const fileNameBuf = Buffer.from(fileName, 'utf8');
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    header.writeUInt32LE(0, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(highlyCompressible.length, 22);
    header.writeUInt16LE(fileNameBuf.length, 26);
    header.writeUInt16LE(0, 28);
    const bomb = Buffer.concat([header, fileNameBuf, compressed]);
    // Ratio = 1MB / ~1k compressed ≈ 1000x >100 should trigger bomb
    expect(() => inspector.inspect(bomb)).toThrow(BadRequestError);
  });

  describe('isPptxFile helper', () => {
    it('identifies PPTX by MIME and extension', () => {
      expect(
        isPptxFile(
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          null,
        ),
      ).toBe(true);
      expect(isPptxFile(null, 'deck.pptx')).toBe(true);
      expect(isPptxFile(null, 'deck.PPTX')).toBe(true);
      expect(
        isPptxFile(
          'application/vnd.ms-powerpoint.presentation.macroenabled.12',
          null,
        ),
      ).toBe(true);
      expect(isPptxFile('application/pdf', 'file.pdf')).toBe(false);
      expect(isPptxFile(null, null)).toBe(false);
      expect(isPptxFile('image/png', 'photo.png')).toBe(false);
    });
  });
});
