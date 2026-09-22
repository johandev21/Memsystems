import { Inject, Injectable, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  estimateVoyageTokens,
  VOYAGE_CHARS_PER_TOKEN,
} from './providers/voyage.client';

/** The Source kinds a chunk can belong to. */
export type SourceKind = 'text' | 'url' | 'file';

/**
 * Token-based chunk sizing. `targetTokens` is the size packing aims for,
 * `minTokens` is the floor below which a fragment is merged into a
 * neighbour, and `overlapTokens` is the tail of the previous chunk repeated
 * at the start of the next one. Tokens are estimated at
 * `VOYAGE_CHARS_PER_TOKEN` characters each, the same ratio the Voyage client
 * uses to batch requests.
 */
export interface ChunkingConfig {
  targetTokens: number;
  minTokens: number;
  overlapTokens: number;
}

export const CHUNKING_CONFIG = 'CHUNKING_CONFIG';

export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  targetTokens: 320,
  minTokens: 96,
  overlapTokens: 48,
};

export interface ChunkOptions {
  targetTokens?: number;
  minTokens?: number;
  overlapTokens?: number;
}

export interface ChunkInput {
  id: string;
  notebookId: string;
  kind: SourceKind;
  title: string;
  rawText: string;
  sourceVersionId?: string | null;
  segments?: SourceSegmentInput[];
}

export interface SourceSegmentInput {
  id: string;
  content: string;
  /** The heading path of the section the segment belongs to. */
  headingPath?: string[];
  locator?: Record<string, unknown> | null;
}

/** One chunk body before the document and section context is attached. */
interface ChunkPiece {
  body: string;
  segmentIds: string[];
  locator: Record<string, unknown>;
  headingPath: string[];
}

export interface ChunkOutput {
  sourceId: string;
  notebookId: string;
  chunkIndex: number;
  /**
   * The text shown to the model and used for citations: the source title
   * followed by the chunk body. It never carries the section context header,
   * which belongs to the searchable representation only.
   */
  content: string;
  /**
   * The contextualized text the dense and lexical legs index: the document
   * and section context header plus the chunk body.
   */
  searchableText: string;
  /** The document and section context header prepended to `searchableText`. */
  contextHeader: string;
  /** The heading path of the source segment this chunk came from. */
  headingPath: string[];
  /** The kind of the Source this chunk belongs to. */
  sourceKind: SourceKind;
  sourceVersionId?: string | null;
  locator: Record<string, unknown>;
  segmentIds: string[];
  chunkingVersion: number;
  contentHash: string;
}

/**
 * Bump when the chunk representation changes. Together with
 * `INDEX_PROCESSING_VERSION` it invalidates stored chunks and makes a
 * reindex-all job rebuild them.
 */
export const CHUNKING_VERSION = 2;

/** Reads the chunking configuration from the environment. */
export function loadChunkingConfig(
  env: NodeJS.ProcessEnv = process.env,
): ChunkingConfig {
  return normalizeChunkingConfig({
    targetTokens: parseEnvInt(
      env.CHUNK_TARGET_TOKENS,
      DEFAULT_CHUNKING_CONFIG.targetTokens,
    ),
    minTokens: parseEnvInt(
      env.CHUNK_MIN_TOKENS,
      DEFAULT_CHUNKING_CONFIG.minTokens,
    ),
    overlapTokens: parseEnvInt(
      env.CHUNK_OVERLAP_TOKENS,
      DEFAULT_CHUNKING_CONFIG.overlapTokens,
      0,
    ),
  });
}

/**
 * Clamps a chunking configuration into a usable shape: the minimum never
 * exceeds the target, and the overlap is always smaller than the target so
 * consecutive chunks cannot grow without bound.
 */
export function normalizeChunkingConfig(
  config: ChunkingConfig,
): ChunkingConfig {
  const targetTokens = Math.max(1, toInt(config.targetTokens, 1));
  const minTokens = Math.min(
    Math.max(1, toInt(config.minTokens, 1)),
    targetTokens,
  );
  const overlapTokens = Math.min(
    Math.max(0, toInt(config.overlapTokens, 0)),
    targetTokens - 1,
  );
  return { targetTokens, minTokens, overlapTokens };
}

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

/**
 * The document and section context header prepended to the searchable text:
 * the source title, the source kind, and the heading path of the section the
 * chunk came from. A passage that says "the second argument" becomes
 * searchable as a passage about its actual subject.
 */
export function chunkContextHeader(input: {
  title: string;
  kind: SourceKind;
  headingPath?: string[] | null;
}): string {
  const lines = [`Source: "${input.title}"`, `Kind: ${input.kind}`];
  if (input.headingPath && input.headingPath.length > 0) {
    lines.push(`Section: ${input.headingPath.join(' > ')}`);
  }
  return `${lines.join('\n')}\n`;
}

/** Estimates the token length of a chunk with the Voyage ~4 chars/token ratio. */
export function estimateChunkTokens(text: string): number {
  return estimateVoyageTokens(text);
}

/** Paragraphs are separated by blank lines. */
function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

/** Sentences end at `.`, `!`, or `?` and keep their punctuation. */
function splitSentences(paragraph: string): string[] {
  const matches = paragraph.match(/[^.!?\n]+[.!?]+/g);
  if (!matches) return [paragraph];

  const sentences: string[] = [];
  let cursor = 0;
  for (const match of matches) {
    const index = paragraph.indexOf(match, cursor);
    cursor = index + match.length;
    const sentence = match.trim();
    if (sentence) sentences.push(sentence);
  }
  const rest = paragraph.slice(cursor).trim();
  if (rest) sentences.push(rest);
  return sentences.length > 0 ? sentences : [paragraph];
}

/** A single sentence longer than the target is split on word boundaries. */
function splitWords(text: string, targetTokens: number): string[] {
  const pieces: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (estimateVoyageTokens(candidate) <= targetTokens) {
      current = candidate;
      continue;
    }
    if (current) pieces.push(current);
    // A single word longer than the target cannot be split further.
    current = word;
  }
  if (current) pieces.push(current);
  return pieces;
}

/**
 * Splits text at the deepest boundary it can respect: paragraphs first, then
 * sentences, then words. Every returned block fits the target on its own, so
 * the packer never has to cut a block in half.
 */
function splitIntoBlocks(text: string, targetTokens: number): string[] {
  const blocks: string[] = [];
  for (const paragraph of splitParagraphs(text)) {
    if (estimateVoyageTokens(paragraph) <= targetTokens) {
      blocks.push(paragraph);
      continue;
    }
    for (const sentence of splitSentences(paragraph)) {
      if (estimateVoyageTokens(sentence) <= targetTokens) {
        blocks.push(sentence);
        continue;
      }
      blocks.push(...splitWords(sentence, targetTokens));
    }
  }
  return blocks;
}

/** Greedily packs blocks into chunks that stay within the target. */
function packBlocks(blocks: string[], targetTokens: number): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const block of blocks) {
    if (!current) {
      current = block;
      continue;
    }
    const candidate = `${current}\n\n${block}`;
    if (estimateVoyageTokens(candidate) <= targetTokens) {
      current = candidate;
      continue;
    }
    chunks.push(current);
    current = block;
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Merges fragments below the minimum into a neighbour: short fragments
 * accumulate into the following chunk, and a short tail is appended to the
 * previous one. A document smaller than the minimum stays one chunk.
 */
function mergeShortFragments(chunks: string[], minTokens: number): string[] {
  if (chunks.length <= 1) return chunks;

  const merged: string[] = [];
  let pending = '';
  for (const chunk of chunks) {
    const current = pending ? `${pending}\n\n${chunk}` : chunk;
    if (estimateVoyageTokens(current) < minTokens) {
      pending = current;
      continue;
    }
    merged.push(current);
    pending = '';
  }

  if (pending) {
    const previous = merged[merged.length - 1];
    if (previous === undefined) merged.push(pending);
    else merged[merged.length - 1] = `${previous}\n\n${pending}`;
  }
  return merged;
}

/** Repeats the tail of each chunk at the start of the next one. */
function applyOverlap(chunks: string[], overlapTokens: number): string[] {
  if (chunks.length <= 1 || overlapTokens <= 0) return chunks;

  const result: string[] = [chunks[0]];
  for (let index = 1; index < chunks.length; index++) {
    const tail = overlapTail(chunks[index - 1], overlapTokens);
    result.push(tail ? `${tail}\n\n${chunks[index]}` : chunks[index]);
  }
  return result;
}

/**
 * The overlap slice of a chunk, snapped forward to the next word boundary so
 * the repeated text never starts mid-word.
 */
function overlapTail(text: string, overlapTokens: number): string {
  const maxChars = overlapTokens * VOYAGE_CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  const start = text.length - maxChars;
  const boundary = text.slice(start).search(/\s/);
  const snapped = boundary === -1 ? start : start + boundary + 1;
  return text.slice(snapped).trim();
}

function parseEnvInt(
  value: string | undefined,
  fallback: number,
  minimum = 1,
): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < minimum) return fallback;
  return parsed;
}

function toInt(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.floor(value);
}

/**
 * Structure-aware, token-based chunking. Sections (source segments) are
 * chunked independently so a chunk never merges two sections, boundaries
 * follow paragraphs and sentences, and the heading path travels with every
 * chunk as first-class metadata. The service is also the single place that
 * builds the searchable representation: contextual header plus body.
 */
@Injectable()
export class ChunkingService {
  private readonly config: ChunkingConfig;

  constructor(
    @Optional()
    @Inject(CHUNKING_CONFIG)
    config?: ChunkingConfig,
  ) {
    this.config = normalizeChunkingConfig(config ?? DEFAULT_CHUNKING_CONFIG);
  }

  chunkText(text: string, options?: ChunkOptions): string[] {
    if (!text || text.trim().length === 0) return [];
    const config = normalizeChunkingConfig({
      targetTokens: options?.targetTokens ?? this.config.targetTokens,
      minTokens: options?.minTokens ?? this.config.minTokens,
      overlapTokens: options?.overlapTokens ?? this.config.overlapTokens,
    });

    const packed = packBlocks(
      splitIntoBlocks(text.trim(), config.targetTokens),
      config.targetTokens,
    );
    const merged = mergeShortFragments(packed, config.minTokens);
    return applyOverlap(merged, config.overlapTokens);
  }

  chunkSource(input: ChunkInput): ChunkOutput[] {
    const segments: SourceSegmentInput[] =
      input.segments?.filter((segment) => segment.content.trim()) ?? [];
    const pieces: ChunkPiece[] =
      segments.length > 0
        ? segments.flatMap((segment) =>
            this.chunkText(segment.content).map((body) => ({
              body,
              segmentIds: [segment.id],
              locator: segment.locator ?? {},
              headingPath: segment.headingPath ?? [],
            })),
          )
        : this.chunkText(input.rawText).map((body) => ({
            body,
            segmentIds: [],
            locator: {},
            headingPath: [],
          }));

    return pieces.map((piece, index) => {
      const content = `${chunkContentHeader(input.title)}${piece.body}`;
      const contextHeader = chunkContextHeader({
        title: input.title,
        kind: input.kind,
        headingPath: piece.headingPath,
      });
      return {
        sourceId: input.id,
        notebookId: input.notebookId,
        chunkIndex: index,
        content,
        searchableText: `${contextHeader}${piece.body}`,
        contextHeader,
        headingPath: piece.headingPath,
        sourceKind: input.kind,
        sourceVersionId: input.sourceVersionId ?? null,
        locator: piece.locator,
        segmentIds: piece.segmentIds,
        chunkingVersion: CHUNKING_VERSION,
        contentHash: createHash('sha256').update(content, 'utf8').digest('hex'),
      };
    });
  }
}
