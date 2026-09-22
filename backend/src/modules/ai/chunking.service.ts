import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

export interface ChunkOptions {
  chunkSize?: number;
  overlap?: number;
}

export interface ChunkInput {
  id: string;
  notebookId: string;
  title: string;
  rawText: string;
  sourceVersionId?: string | null;
  segments?: SourceSegmentInput[];
}

export interface SourceSegmentInput {
  id: string;
  content: string;
  locator?: Record<string, unknown> | null;
}

interface ChunkPiece {
  content: string;
  segmentIds: string[];
  locator: Record<string, unknown>;
}

export interface ChunkOutput {
  sourceId: string;
  notebookId: string;
  chunkIndex: number;
  content: string;
  sourceVersionId?: string | null;
  locator: Record<string, unknown>;
  segmentIds: string[];
  chunkingVersion: number;
  contentHash: string;
}

export const CHUNKING_VERSION = 1;

/**
 * Every indexed chunk body starts with this header so the embedded text
 * carries the source title. Callers that need the bare body (for example the
 * Generation prompt, which adds the title itself) strip it with
 * `stripChunkContentHeader`.
 */
export function chunkContentHeader(title: string): string {
  return `Source: "${title}"\n`;
}

/** Removes the header added by `chunkContentHeader`, if present. */
export function stripChunkContentHeader(content: string): string {
  return content.replace(/^Source: "[^\n]*"\n/, '');
}

function splitOnBoundaries(text: string, chunkSize: number): string[] {
  if (text.length <= chunkSize) return [text];

  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let current = '';

  for (const para of paragraphs) {
    if (`${current}\n\n${para}`.trim().length <= chunkSize) {
      current = current ? `${current}\n\n${para}` : para;
    } else {
      if (current) {
        chunks.push(current);
      }

      if (para.length <= chunkSize) {
        current = para;
      } else {
        const sentences = para.match(/[^.!?\n]+[.!?]+\s*/g) ?? [para];
        current = '';
        for (const sentence of sentences) {
          if ((current + sentence).trim().length <= chunkSize) {
            current += sentence;
          } else {
            if (current) chunks.push(current.trim());
            if (sentence.length <= chunkSize) {
              current = sentence;
            } else {
              const words = sentence.split(/\s+/);
              current = '';
              for (const word of words) {
                if (`${current} ${word}`.trim().length <= chunkSize) {
                  current = current ? `${current} ${word}` : word;
                } else {
                  if (current) chunks.push(current.trim());
                  current = word;
                }
              }
            }
          }
        }
      }
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

function applyOverlap(chunks: string[], overlap: number): string[] {
  if (chunks.length <= 1 || overlap <= 0) return chunks;

  const result: string[] = [chunks[0]];
  for (let i = 1; i < chunks.length; i++) {
    const prevEnd = chunks[i - 1];
    const overlapText =
      prevEnd.length >= overlap ? prevEnd.slice(-overlap) : prevEnd;
    result.push(overlapText + chunks[i]);
  }
  return result;
}

@Injectable()
export class ChunkingService {
  chunkText(text: string, options?: ChunkOptions): string[] {
    if (!text || text.trim().length === 0) return [];
    const chunkSize = options?.chunkSize ?? 1000;
    const overlap = options?.overlap ?? 200;

    const boundaryChunks = splitOnBoundaries(text.trim(), chunkSize);

    if (overlap > 0) {
      return applyOverlap(boundaryChunks, overlap);
    }

    return boundaryChunks;
  }

  chunkSource(input: ChunkInput): ChunkOutput[] {
    const segments: SourceSegmentInput[] =
      input.segments?.filter((segment) => segment.content.trim()) ?? [];
    const pieces: ChunkPiece[] =
      segments.length > 0
        ? segments.flatMap((segment) =>
            this.chunkText(segment.content).map((content) => ({
              content,
              segmentIds: [segment.id],
              locator: segment.locator ?? {},
            })),
          )
        : this.chunkText(input.rawText).map((content) => ({
            content,
            segmentIds: [],
            locator: {},
          }));

    return pieces.map((piece, index) => {
      const content = `${chunkContentHeader(input.title)}${piece.content}`;
      return {
        sourceId: input.id,
        notebookId: input.notebookId,
        chunkIndex: index,
        content,
        sourceVersionId: input.sourceVersionId ?? null,
        locator: piece.locator,
        segmentIds: piece.segmentIds,
        chunkingVersion: CHUNKING_VERSION,
        contentHash: createHash('sha256').update(content, 'utf8').digest('hex'),
      };
    });
  }
}
