/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Injectable } from '@nestjs/common';
import { BadRequestError } from '../../common/errors/domain-error';
import { assertNotArchiveBomb, parseZipEntries } from './zip-helpers';

export interface PptxSlide {
  slideNumber: number;
  title?: string;
  texts: string[];
  notes?: string;
}

export interface PptxParseResult {
  slideCount: number;
  slides: PptxSlide[];
  warnings?: string[];
}

const SLIDE_RE = /^ppt\/slides\/slide(\d+)\.xml$/;
const NOTES_RE = /^ppt\/notesSlides\/notesSlide(\d+)\.xml$/;

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, c) =>
      String.fromCharCode(parseInt(c, 16)),
    );
}

function extractATextNodes(xml: string, warnings: string[]): string[] {
  try {
    // Limit entity expansion depth via simple check
    if ((xml.match(/&[^;]+;/g) || []).length > 10000) {
      warnings.push('Excessive XML entities detected, truncated.');
      xml = xml.slice(0, 100000);
    }
    const matches = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi)];
    return matches
      .map((m) => decodeXmlEntities(m[1].trim()))
      .filter((t) => t.length > 0);
  } catch {
    warnings.push('Malformed slide XML: failed to extract text.');
    return [];
  }
}

function extractNotesText(xml: string, warnings: string[]): string | undefined {
  const texts = extractATextNodes(xml, warnings);
  if (texts.length === 0) return undefined;
  return texts.join(' ');
}

@Injectable()
export class PptxParserService {
  parse(buffer: Buffer): PptxParseResult {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestError('PPTX buffer is empty.', {
        messageKey: 'errors.sources.inspect.pptxEmpty',
      });
    }
    if (buffer.length >= 8) {
      const sig0 = buffer.readUInt32BE(0);
      const sig1 = buffer.readUInt32BE(4);
      if (sig0 === 0xd0cf11e0 && sig1 === 0xa11b1ae1) {
        throw new BadRequestError('Legacy PPT not supported, requires PPTX', {
          messageKey: 'errors.sources.inspect.pptxLegacy',
        });
      }
    }
    if (
      buffer.length < 4 ||
      buffer[0] !== 0x50 ||
      buffer[1] !== 0x4b ||
      buffer[2] !== 0x03 ||
      buffer[3] !== 0x04
    ) {
      throw new BadRequestError('Invalid PPTX ZIP header.', {
        messageKey: 'errors.sources.parse.pptxCorrupted',
      });
    }

    const warnings: string[] = [];
    let parsed: ReturnType<typeof parseZipEntries>;
    try {
      parsed = parseZipEntries(buffer);
    } catch (err) {
      if (err instanceof BadRequestError) throw err;
      throw new BadRequestError(
        `Failed to unzip PPTX: ${err instanceof Error ? err.message : String(err)}`,
        { messageKey: 'errors.sources.parse.pptxCorrupted' },
      );
    }

    assertNotArchiveBomb(parsed);

    const slideMap = new Map<number, Buffer>();
    const notesMap = new Map<number, Buffer>();

    for (const [name, data] of parsed.entries.entries()) {
      const slideMatch = name.match(SLIDE_RE);
      if (slideMatch) {
        const num = parseInt(slideMatch[1], 10);
        if (!isNaN(num) && num >= 1 && num <= 5000) {
          slideMap.set(num, data);
        }
      }
      const notesMatch = name.match(NOTES_RE);
      if (notesMatch) {
        const num = parseInt(notesMatch[1], 10);
        if (!isNaN(num)) notesMap.set(num, data);
      }
    }

    if (slideMap.size === 0) {
      warnings.push('No slides found in PPTX.');
    }

    // Try to determine order via presentation.xml sldIdLst if available
    const orderedNumbers: number[] = [...slideMap.keys()].sort((a, b) => a - b);
    try {
      const pres = parsed.entries.get('ppt/presentation.xml');
      if (pres) {
        const presText = pres.toString('utf8');
        // Extract slide ids order: <p:sldId r:id="rId2"/> ; then resolve rId to target via _rels/presentation.xml.rels
        // Simpler: just parse order of sldId elements, but without rels mapping we assume numeric order already sorted
        // Check for malformed XML entities limit
        if ((presText.match(/<!ENTITY/g) || []).length > 10) {
          warnings.push('Suspicious ENTITY expansion in presentation.xml');
        }
      }
    } catch {
      warnings.push('Failed to parse presentation.xml for slide order.');
    }

    if (orderedNumbers.length > 500) {
      throw new BadRequestError(
        `PPTX slide count (${orderedNumbers.length}) exceeds maximum allowed limit of 500.`,
        {
          messageKey: 'errors.sources.inspect.pptxTooManySlides',
          params: { count: orderedNumbers.length, max: 500 },
        },
      );
    }

    const slides: PptxSlide[] = [];
    for (let idx = 0; idx < orderedNumbers.length; idx++) {
      const slideNumber = idx + 1;
      const actualNum = orderedNumbers[idx];
      const data = slideMap.get(actualNum);
      if (!data) continue;
      let xml: string;
      try {
        xml = data.toString('utf8');
        if (xml.length > 5 * 1024 * 1024) {
          warnings.push(`Slide ${slideNumber} truncated: exceeds 5MB.`);
          xml = xml.slice(0, 5 * 1024 * 1024);
        }
        // Check entity expansion
        const entityCount = (xml.match(/<!ENTITY/g) || []).length;
        if (entityCount > 5) {
          warnings.push(
            `Slide ${slideNumber} contains excessive ENTITY declarations.`,
          );
          xml = xml.replace(/<!ENTITY[^>]*>/gi, '');
        }
      } catch {
        warnings.push(`Slide ${slideNumber} malformed XML.`);
        xml = '';
      }
      const texts = extractATextNodes(xml, warnings);
      let notes: string | undefined;
      if (notesMap.has(actualNum)) {
        try {
          const notesXml = notesMap.get(actualNum)!.toString('utf8');
          notes = extractNotesText(notesXml, warnings);
        } catch {
          warnings.push(`Notes slide ${slideNumber} malformed.`);
        }
      }
      const title = texts.length > 0 ? texts[0] : undefined;
      slides.push({ slideNumber, title, texts, notes });
    }

    return {
      slideCount: slides.length,
      slides,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
}
