import type { VisionExtractionResult } from '../vision-extraction.port';
import type {
  NormalizedDocument,
  ImageDocumentOptions,
  DocumentSection,
} from './document.types';
import {
  contentHashOf,
  normalizeProse,
  singleSection,
} from './document-normalization';

export function fromImageResult(
  result: VisionExtractionResult,
  options: ImageDocumentOptions = {},
): NormalizedDocument {
  const title =
    options.title ??
    result.title ??
    options.filename ??
    options.fileName ??
    'Image Document';

  const normalizedRawText = normalizeProse(result.rawText || '');

  let currentHeadingPath: string[] = [];
  const sections: DocumentSection[] = (result.segments || []).map(
    (segment, index) => {
      const content = normalizeProse(segment.content);
      if (segment.kind === 'heading') {
        currentHeadingPath = [content];
      }

      return {
        headingPath: [...currentHeadingPath],
        content,
        ordinal: index,
        kind: segment.kind,
        locator: segment.imageRegion
          ? { imageRegion: segment.imageRegion }
          : {},
        metadata: {
          ...(segment.confidence !== undefined
            ? { confidence: segment.confidence }
            : {}),
        },
      };
    },
  );

  const finalSections =
    sections.length > 0
      ? sections
      : singleSection(normalizedRawText || 'Image Document');

  const text =
    normalizedRawText || finalSections.map((s) => s.content).join('\n\n');

  return {
    title,
    text,
    extractionMethod: 'vision',
    contentType: options.contentType,
    sourceUrl: options.sourceUrl,
    contentHash: contentHashOf(text),
    sections: finalSections,
  };
}
