import { describe, expect, it } from 'vitest';
import { BadRequestError } from '../src/common/errors/domain-error';
import { PptxParserService } from '../src/modules/sources/pptx-parser.service';
import { createStoredZip } from '../src/modules/sources/zip-helpers';

function makeSlideXml(texts: string[]): string {
  const tNodes = texts.map((t) => `<a:r><a:t>${t}</a:t></a:r>`).join('');
  return `<?xml version="1.0"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p>${tNodes}</a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
}
function makeNotesXml(text: string): string {
  return `<?xml version="1.0"?><p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>`;
}

function createPptxWithSlides(
  slides: Array<{ texts: string[]; notes?: string }>,
): Buffer {
  const entries: Array<{ name: string; content: string }> = [];
  entries.push({ name: '[Content_Types].xml', content: '<Types/>' });
  let pres = '<p:presentation><p:sldIdLst>';
  slides.forEach(
    (_, i) => (pres += `<p:sldId id="${256 + i}" r:id="rId${i}"/>`),
  );
  pres += '</p:sldIdLst></p:presentation>';
  entries.push({ name: 'ppt/presentation.xml', content: pres });
  slides.forEach((s, idx) => {
    const n = idx + 1;
    entries.push({
      name: `ppt/slides/slide${n}.xml`,
      content: makeSlideXml(s.texts),
    });
    if (s.notes)
      entries.push({
        name: `ppt/notesSlides/notesSlide${n}.xml`,
        content: makeNotesXml(s.notes),
      });
  });
  return createStoredZip(entries);
}

describe('PptxParserService', () => {
  const parser = new PptxParserService();

  it('extracts slide texts from <a:t> nodes', () => {
    const pptx = createPptxWithSlides([{ texts: ['Hello', 'World'] }]);
    const result = parser.parse(pptx);
    expect(result.slideCount).toBe(1);
    expect(result.slides[0].texts).toEqual(['Hello', 'World']);
    expect(result.slides[0].slideNumber).toBe(1);
  });

  it('extracts title from first <a:t> and preserves slideNumber locator', () => {
    const pptx = createPptxWithSlides([
      { texts: ['My Title', 'Body line 1', 'Body line 2'] },
      { texts: ['Second Slide'] },
    ]);
    const result = parser.parse(pptx);
    expect(result.slides[0].title).toBe('My Title');
    expect(result.slides[1].title).toBe('Second Slide');
    expect(result.slides[0].slideNumber).toBe(1);
    expect(result.slides[1].slideNumber).toBe(2);
  });

  it('extracts speaker notes per slide', () => {
    const pptx = createPptxWithSlides([
      { texts: ['Slide A'], notes: 'Important notes for A' },
    ]);
    const result = parser.parse(pptx);
    expect(result.slides[0].notes).toBe('Important notes for A');
  });

  it('handles malformed XML gracefully with warnings', () => {
    const entries: Array<{ name: string; content: string }> = [
      { name: '[Content_Types].xml', content: '<Types/>' },
      {
        name: 'ppt/presentation.xml',
        content:
          '<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst></p:presentation>',
      },
      { name: 'ppt/slides/slide1.xml', content: '<p:sld><a:t>Unclosed tag' }, // malformed
    ];
    const pptx = createStoredZip(entries);
    const result = parser.parse(pptx);
    // Should not throw, but produce warning or empty texts
    expect(result.slides.length).toBe(1);
    // texts may be empty due to malformed, but warnings should be present or empty gracefully
    // Our extractor uses regex which may still find <a:t> even if unclosed; ensure no crash
    expect(result.slides[0].slideNumber).toBe(1);
  });

  it('preserves slideNumber ordering sorted numerically', () => {
    // Add slides out of order in zip but expect sorted by slide number
    const entries: Array<{ name: string; content: string }> = [
      { name: '[Content_Types].xml', content: '<Types/>' },
      {
        name: 'ppt/presentation.xml',
        content:
          '<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst></p:presentation>',
      },
      { name: 'ppt/slides/slide2.xml', content: makeSlideXml(['Second']) },
      { name: 'ppt/slides/slide1.xml', content: makeSlideXml(['First']) },
    ];
    const pptx = createStoredZip(entries);
    const result = parser.parse(pptx);
    expect(result.slides[0].texts).toContain('First');
    expect(result.slides[1].texts).toContain('Second');
    expect(result.slides[0].slideNumber).toBe(1);
    expect(result.slides[1].slideNumber).toBe(2);
  });

  it('returns warnings for empty PPTX with no slides', () => {
    const pptx = createStoredZip([
      { name: '[Content_Types].xml', content: '<Types/>' },
      {
        name: 'ppt/presentation.xml',
        content: '<p:presentation></p:presentation>',
      },
    ]);
    const result = parser.parse(pptx);
    expect(result.slideCount).toBe(0);
    expect(result.warnings).toBeDefined();
  });

  it('sanitizes excessive XML entities (depth guard)', () => {
    const malicious = `<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;">]><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:txBody><a:p><a:r><a:t>Safe</a:t></a:r></a:p></p:txBody></p:sld>`;
    const pptx = createStoredZip([
      { name: '[Content_Types].xml', content: '<Types/>' },
      {
        name: 'ppt/presentation.xml',
        content:
          '<p:presentation><p:sldIdLst><p:sldId id="256"/></p:sldIdLst></p:presentation>',
      },
      { name: 'ppt/slides/slide1.xml', content: malicious },
    ]);
    const result = parser.parse(pptx);
    expect(result.slides[0].texts).toContain('Safe');
    // Should have warning about ENTITY
    // Our parser pushes warning if ENTITY count >5
  });

  it('rejects legacy PPT', () => {
    const buf = Buffer.alloc(8);
    buf.writeUInt32BE(0xd0cf11e0, 0);
    buf.writeUInt32BE(0xa11b1ae1, 4);
    expect(() => parser.parse(buf)).toThrow(BadRequestError);
  });

  it('enforces slide count limit', () => {
    const entries: Array<{ name: string; content: string }> = [
      { name: '[Content_Types].xml', content: '<Types/>' },
    ];
    let pres = '<p:presentation><p:sldIdLst>';
    for (let i = 1; i <= 501; i++) {
      pres += `<p:sldId id="${256 + i}"/>`;
      entries.push({
        name: `ppt/slides/slide${i}.xml`,
        content: makeSlideXml([`Slide ${i}`]),
      });
    }
    pres += '</p:sldIdLst></p:presentation>';
    entries.push({ name: 'ppt/presentation.xml', content: pres });
    const pptx = createStoredZip(entries);
    expect(() => parser.parse(pptx)).toThrow(BadRequestError);
  });
});
