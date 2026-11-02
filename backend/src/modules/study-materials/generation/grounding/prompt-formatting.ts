import type { RetrievedChunk } from '../../../ai/retrieval/retrieval.service';
import { stripChunkContentHeader } from '../../../ai/indexing/chunking.service';
import type { StudyMaterialKind } from '../../content/shapes';
import {
  getKindGroundingBudget,
  GENERATION_MAX_PROMPT_SOURCE_CHARS,
} from './budgets';
import { applyAdjacentOverlapStripping } from './overlap-trimming';
import { getGroundingKind } from './kind-metadata';
import type { GenerationGrounding, GroundedSource } from './grounding.types';

const SOURCE_SEPARATOR = '\n\n---\n\n';
const BLOCK_SEPARATOR = '\n\n';

export interface FormattedGroundedSourceText {
  text: string;
  droppedBlocks: number;
  truncatedSourceIds: string[];
  renderedChunkIds: string[];
  truncatedChunkIds: string[];
}

export interface FormatGroundedSourceTextOptions {
  maxChars?: number;
  includeSourceId?: boolean;
  kind?: StudyMaterialKind;
}

interface PreparedChunkBlock {
  chunk: RetrievedChunk;
  chunkId: string;
  sectionKey: string;
  bodyText: string;
  fullTextWithSection: string;
}

export function formatGroundedSourceText(
  grounding: Pick<GenerationGrounding, 'sources' | 'evidence'> & {
    kind?: StudyMaterialKind;
  },
  options: FormatGroundedSourceTextOptions = {},
): FormattedGroundedSourceText {
  const attachedKind =
    options.kind ?? grounding.kind ?? getGroundingKind(grounding);
  const maxChars =
    options.maxChars ??
    (attachedKind
      ? getKindGroundingBudget(attachedKind).maxPromptChars
      : GENERATION_MAX_PROMPT_SOURCE_CHARS);
  const includeSourceId = options.includeSourceId ?? false;
  const { sources, evidence } = grounding;
  const empty: FormattedGroundedSourceText = {
    text: '',
    droppedBlocks: 0,
    truncatedSourceIds: [],
    renderedChunkIds: [],
    truncatedChunkIds: [],
  };
  if (sources.length === 0 || maxChars <= 0) return empty;

  const keyByChunkId = new Map(
    evidence.map((item) => [item.chunkId, item.citationKey]),
  );
  const headerOf = (source: GroundedSource) =>
    includeSourceId
      ? `Source: "${source.title}" (Source ID: ${source.id})`
      : `Source: "${source.title}"`;

  const preparedBySource: PreparedChunkBlock[][] = sources.map((source) => {
    const rawList =
      source.promptChunks.length > 0 ? source.promptChunks : source.chunks;
    const { promptChunks: overlapStripped } =
      applyAdjacentOverlapStripping(rawList);
    return overlapStripped.map((chunk) =>
      prepareChunkBlock(chunk, keyByChunkId.get(chunk.chunkId)),
    );
  });

  const headerChars = sources.reduce(
    (sum, source) => sum + headerOf(source).length,
    0,
  );
  const separatorChars =
    SOURCE_SEPARATOR.length * Math.max(0, sources.length - 1);
  const blockSeparatorChars = BLOCK_SEPARATOR.length * sources.length;
  const share = Math.floor(
    Math.max(0, maxChars - headerChars - separatorChars - blockSeparatorChars) /
      sources.length,
  );

  const droppedBlocks: number[] = [];
  const truncatedSourceIds: string[] = [];
  const renderedChunkIds: string[] = [];
  const truncatedChunkIds: string[] = [];
  const sections: string[] = [];

  for (let index = 0; index < sources.length; index++) {
    const source = sources[index];
    const blocks = preparedBySource[index];
    const keptBlocks: PreparedChunkBlock[] = [];
    const seenSectionsInSource = new Set<string>();
    let used = 0;
    let truncatedFirstBlockText: string | null = null;

    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
      const block = blocks[blockIndex];
      const needsSectionHeader =
        block.sectionKey.length > 0 &&
        !seenSectionsInSource.has(block.sectionKey);
      const candidateText = needsSectionHeader
        ? block.fullTextWithSection
        : block.bodyText;
      const joinChars = keptBlocks.length === 0 ? 0 : BLOCK_SEPARATOR.length;

      if (used + joinChars + candidateText.length <= share) {
        keptBlocks.push(block);
        if (block.sectionKey.length > 0) {
          seenSectionsInSource.add(block.sectionKey);
        }
        used += joinChars + candidateText.length;
        continue;
      }

      if (keptBlocks.length === 0 && share > 0) {
        truncatedFirstBlockText = candidateText.slice(0, share);
        keptBlocks.push(block);
        truncatedChunkIds.push(block.chunkId);
        truncatedSourceIds.push(source.id);
        droppedBlocks.push(blocks.length - 1);
      } else {
        droppedBlocks.push(blocks.length - keptBlocks.length);
      }
      break;
    }

    if (keptBlocks.length === 0) continue;

    if (truncatedFirstBlockText !== null) {
      renderedChunkIds.push(keptBlocks[0].chunkId);
      sections.push(
        `${headerOf(source)}${BLOCK_SEPARATOR}${truncatedFirstBlockText}`,
      );
      continue;
    }

    const groupedBlocks = groupKeptBlocksBySection(keptBlocks);
    const renderedStrings: string[] = [];
    let activeSectionKey = '';

    for (const block of groupedBlocks) {
      renderedChunkIds.push(block.chunkId);
      if (
        block.sectionKey.length > 0 &&
        block.sectionKey !== activeSectionKey
      ) {
        renderedStrings.push(block.fullTextWithSection);
        activeSectionKey = block.sectionKey;
      } else {
        renderedStrings.push(block.bodyText);
        if (block.sectionKey.length === 0) {
          activeSectionKey = '';
        }
      }
    }

    sections.push(
      `${headerOf(source)}${BLOCK_SEPARATOR}${renderedStrings.join(BLOCK_SEPARATOR)}`,
    );
  }

  let text = sections.join(SOURCE_SEPARATOR);
  if (text.length > maxChars) text = text.slice(0, maxChars);

  return {
    text,
    droppedBlocks: droppedBlocks.reduce((sum, count) => sum + count, 0),
    truncatedSourceIds,
    renderedChunkIds,
    truncatedChunkIds,
  };
}

function prepareChunkBlock(
  chunk: RetrievedChunk,
  citationKey: string | undefined,
): PreparedChunkBlock {
  let rawBody = stripChunkContentHeader(chunk.content);
  let inlineSection = '';
  const sectionLineMatch = rawBody.match(/^Section:\s*([^\n]+)\n/);
  if (sectionLineMatch) {
    inlineSection = sectionLineMatch[1].trim();
    rawBody = rawBody.slice(sectionLineMatch[0].length);
  }

  const sectionKey =
    chunk.sectionPath && chunk.sectionPath.length > 0
      ? chunk.sectionPath.join(' > ')
      : inlineSection;

  const bodyText = citationKey
    ? `[Evidence ${citationKey}]\n${rawBody}`
    : rawBody;
  const fullTextWithSection =
    sectionKey.length > 0 ? `Section: ${sectionKey}\n${bodyText}` : bodyText;

  return {
    chunk,
    chunkId: chunk.chunkId,
    sectionKey,
    bodyText,
    fullTextWithSection,
  };
}

function groupKeptBlocksBySection(
  blocks: PreparedChunkBlock[],
): PreparedChunkBlock[] {
  if (blocks.length <= 1) return blocks;
  const result: PreparedChunkBlock[] = [];
  const bySection = new Map<string, PreparedChunkBlock[]>();

  for (const block of blocks) {
    if (!block.sectionKey) continue;
    const list = bySection.get(block.sectionKey) ?? [];
    list.push(block);
    bySection.set(block.sectionKey, list);
  }

  for (const list of bySection.values()) {
    list.sort((a, b) => a.chunk.chunkIndex - b.chunk.chunkIndex);
  }

  const emittedSections = new Set<string>();
  for (const block of blocks) {
    if (!block.sectionKey) {
      result.push(block);
      continue;
    }
    if (emittedSections.has(block.sectionKey)) continue;
    emittedSections.add(block.sectionKey);
    result.push(...(bySection.get(block.sectionKey) ?? [block]));
  }

  return result;
}
