import type { TranscriptionResult } from '../transcription.port';
import type {
  NormalizedDocument,
  AudioDocumentOptions,
  VideoDocumentOptions,
  DocumentSection,
} from './document.types';
import {
  contentHashOf,
  normalizeProse,
  singleSection,
} from './document-normalization';

export function fromAudioResult(
  result: TranscriptionResult,
  options: AudioDocumentOptions = {},
): NormalizedDocument {
  const title =
    options.title ??
    result.title ??
    options.filename ??
    options.fileName ??
    'Audio Document';

  const normalizedRawText = normalizeProse(result.rawText || '');

  const sections: DocumentSection[] = (result.segments || []).map(
    (segment, index) => {
      const content = normalizeProse(segment.content);
      const headingPath = segment.speaker ? [segment.speaker] : [];

      return {
        headingPath,
        content,
        ordinal: index,
        kind: 'transcript' as const,
        locator: {
          startOffsetMs: segment.startOffsetMs,
          endOffsetMs: segment.endOffsetMs,
          ...(segment.speaker ? { speaker: segment.speaker } : {}),
        },
        metadata: {
          ...(segment.confidence !== undefined
            ? { confidence: segment.confidence }
            : {}),
          ...(result.durationMs !== undefined
            ? { durationMs: result.durationMs }
            : result.durationSeconds !== undefined
              ? { durationMs: Math.round(result.durationSeconds * 1000) }
              : {}),
        },
      };
    },
  );

  const finalSections =
    sections.length > 0
      ? sections
      : singleSection(normalizedRawText || 'Audio Document');

  const text =
    normalizedRawText || finalSections.map((s) => s.content).join('\n\n');

  return {
    title,
    text,
    language: result.language ?? options.language,
    extractionMethod: 'transcription',
    contentType: options.contentType,
    sourceUrl: options.sourceUrl,
    contentHash: contentHashOf(text),
    sections: finalSections,
  };
}

export function fromVideoResult(
  result: TranscriptionResult,
  options: VideoDocumentOptions = {},
): NormalizedDocument {
  const title =
    options.title ??
    result.title ??
    options.filename ??
    options.fileName ??
    'Video Document';

  const normalizedRawText = normalizeProse(result.rawText || '');

  const transcriptSections: DocumentSection[] = (result.segments || []).map(
    (segment, index) => {
      const content = normalizeProse(segment.content);
      const headingPath = segment.speaker ? [segment.speaker] : [];

      return {
        headingPath,
        content,
        ordinal: index,
        kind: 'transcript' as const,
        locator: {
          startOffsetMs: segment.startOffsetMs,
          endOffsetMs: segment.endOffsetMs,
          ...(segment.speaker ? { speaker: segment.speaker } : {}),
        },
        metadata: {
          ...(segment.confidence !== undefined
            ? { confidence: segment.confidence }
            : {}),
          ...(result.durationMs !== undefined
            ? { durationMs: result.durationMs }
            : result.durationSeconds !== undefined
              ? { durationMs: Math.round(result.durationSeconds * 1000) }
              : {}),
        },
      };
    },
  );

  const visualSections: DocumentSection[] = [];
  if (options.visualResults && options.visualResults.length > 0) {
    for (const { keyframe, result: visResult } of options.visualResults) {
      const startOffsetMs = keyframe.timestampMs;
      const endOffsetMs = keyframe.timestampMs + (keyframe.durationMs ?? 5000);

      for (const seg of visResult.segments || []) {
        const content = normalizeProse(seg.content);
        if (!content) continue;

        visualSections.push({
          headingPath: seg.kind === 'heading' ? [content] : ['Visual Scene'],
          content,
          ordinal: 0,
          kind: seg.kind,
          locator: {
            startOffsetMs,
            endOffsetMs,
            ...(seg.imageRegion ? { imageRegion: seg.imageRegion } : {}),
          },
          metadata: {
            visualKeyframe: true,
            isKeyframe: true,
            ...(seg.confidence !== undefined
              ? { confidence: seg.confidence }
              : {}),
          },
        });
      }
    }
  }

  const allSections = [...transcriptSections, ...visualSections].sort(
    (a, b) => (a.locator?.startOffsetMs ?? 0) - (b.locator?.startOffsetMs ?? 0),
  );

  const indexedSections = allSections.map((sec, idx) => ({
    ...sec,
    ordinal: idx,
  }));

  const finalSections = indexedSections;

  const text =
    finalSections.length > 0
      ? finalSections.map((s) => s.content).join('\n\n')
      : normalizedRawText || '';

  return {
    title,
    text,
    language: result.language ?? options.language,
    extractionMethod: visualSections.length > 0 ? 'video' : 'transcription',
    contentType: options.contentType,
    sourceUrl: options.sourceUrl,
    contentHash: contentHashOf(text),
    sections: finalSections,
  };
}
