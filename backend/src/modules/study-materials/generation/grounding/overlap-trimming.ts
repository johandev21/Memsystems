import type { RetrievedChunk } from '../../../ai/retrieval/retrieval.service';
import { stripChunkContentHeader } from '../../../ai/indexing/chunking.service';
import { tokenize } from '../../../ai/retrieval/text-similarity';
import { MAX_FOCUSED_CHUNK_CHARS } from './budgets';
import { stripDiacritics } from './content-filtering';
import { GENERIC_SURVEY_WORDS } from './brief-vocabulary';

function splitIntoSentences(text: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== '.' && ch !== '!' && ch !== '?' && ch !== '\n') continue;
    let end = i + 1;
    while (end < text.length && '.!?'.includes(text[end])) end++;
    if (ch !== '\n' && end < text.length && !/\s/.test(text[end])) continue;
    const piece = text.slice(start, end).trim();
    if (piece) sentences.push(piece);
    start = end;
    i = end - 1;
  }
  const rest = text.slice(start).trim();
  if (rest) sentences.push(rest);
  return sentences.length > 0 ? sentences : [text.trim()].filter(Boolean);
}

export function stripAdjacentBoundaryOverlap(
  prevContent: string,
  nextContent: string,
): string {
  const headerMatch = nextContent.match(/^(Source: "[^\n]*"\n)/);
  const header = headerMatch ? headerMatch[1] : '';
  const prevBody = stripChunkContentHeader(prevContent).trim();
  const nextBody = stripChunkContentHeader(nextContent).trim();
  if (!prevBody || !nextBody) return nextContent;

  const paraSplit = nextBody.indexOf('\n\n');
  if (paraSplit > 0) {
    const leadPara = nextBody.slice(0, paraSplit).trim();
    if (leadPara.length >= 15 && prevBody.endsWith(leadPara)) {
      const remainder = nextBody.slice(paraSplit + 2).trim();
      if (remainder.length > 0) {
        return `${header}${remainder}`;
      }
    }
  }

  const maxOverlap = Math.min(prevBody.length, nextBody.length - 1);
  for (let len = maxOverlap; len >= 20; len--) {
    const prefix = nextBody.slice(0, len);
    if (prevBody.endsWith(prefix)) {
      const afterChar = nextBody[len];
      if (!afterChar || /\s/.test(afterChar)) {
        const remainder = nextBody.slice(len).trim();
        if (remainder.length > 0) {
          return `${header}${remainder}`;
        }
      }
    }
  }

  const prevSentences = splitIntoSentences(prevBody);
  const nextSentences = splitIntoSentences(nextBody);
  if (prevSentences.length > 0 && nextSentences.length > 1) {
    const maxK = Math.min(3, prevSentences.length, nextSentences.length - 1);
    for (let k = maxK; k >= 1; k--) {
      const prevTail = prevSentences
        .slice(prevSentences.length - k)
        .join(' ')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
      const nextHead = nextSentences
        .slice(0, k)
        .join(' ')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
      if (prevTail.length >= 15 && prevTail === nextHead) {
        const remainder = nextSentences.slice(k).join(' ').trim();
        if (remainder.length > 0) {
          return `${header}${remainder}`;
        }
      }
    }
  }

  return nextContent;
}

export function applyAdjacentOverlapStripping(promptChunks: RetrievedChunk[]): {
  chunks: RetrievedChunk[];
  promptChunks: RetrievedChunk[];
} {
  const sortedByIndex = [...promptChunks].sort(
    (a, b) => a.chunkIndex - b.chunkIndex,
  );
  const strippedContentByChunkId = new Map<string, string>();
  const chunkByVersionAndIndex = new Map<string, RetrievedChunk>();

  for (const chunk of sortedByIndex) {
    const key = `${chunk.sourceId}::${chunk.sourceVersionId ?? ''}::${chunk.chunkIndex}`;
    chunkByVersionAndIndex.set(key, chunk);
  }

  for (const chunk of sortedByIndex) {
    const prevKey = `${chunk.sourceId}::${chunk.sourceVersionId ?? ''}::${chunk.chunkIndex - 1}`;
    const prevChunk = chunkByVersionAndIndex.get(prevKey);
    if (prevChunk) {
      const stripped = stripAdjacentBoundaryOverlap(
        prevChunk.content,
        chunk.content,
      );
      strippedContentByChunkId.set(chunk.chunkId, stripped);
    } else {
      strippedContentByChunkId.set(chunk.chunkId, chunk.content);
    }
  }

  const updateChunk = (chunk: RetrievedChunk): RetrievedChunk => ({
    ...chunk,
    content: strippedContentByChunkId.get(chunk.chunkId) ?? chunk.content,
  });

  return {
    chunks: sortedByIndex.map(updateChunk),
    promptChunks: promptChunks.map(updateChunk),
  };
}

export function trimChunkForFocusedBrief(
  content: string,
  brief: string,
  maxChars = MAX_FOCUSED_CHUNK_CHARS,
): string {
  const headerMatch = content.match(/^(Source: "[^\n]*"\n)/);
  const header = headerMatch ? headerMatch[1] : '';
  const body = stripChunkContentHeader(content).trim();
  if (body.length <= maxChars) return content;

  const sentences = splitIntoSentences(body);
  if (sentences.length <= 1) return content;

  const briefTokens = new Set(
    tokenize(brief)
      .map((token) => stripDiacritics(token))
      .filter((token) => !GENERIC_SURVEY_WORDS.has(token)),
  );
  const scores = sentences.map((sentence) => {
    if (briefTokens.size === 0) return 0;
    let hits = 0;
    for (const token of tokenize(sentence)) {
      if (briefTokens.has(stripDiacritics(token))) hits += 1;
    }
    return hits;
  });

  let bestIndex = 0;
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] > scores[bestIndex]) {
      bestIndex = i;
    }
  }

  let start = bestIndex;
  let end = bestIndex;
  let currentLength = sentences[bestIndex].length;

  while (start > 0 || end < sentences.length - 1) {
    const canLeft = start > 0;
    const canRight = end < sentences.length - 1;
    const leftScore = canLeft ? scores[start - 1] : -1;
    const rightScore = canRight ? scores[end + 1] : -1;

    if (canRight && (rightScore >= leftScore || !canLeft)) {
      if (currentLength + 1 + sentences[end + 1].length <= maxChars) {
        end += 1;
        currentLength += 1 + sentences[end].length;
        continue;
      }
      if (
        canLeft &&
        currentLength + 1 + sentences[start - 1].length <= maxChars
      ) {
        start -= 1;
        currentLength += 1 + sentences[start].length;
        continue;
      }
      break;
    }

    if (canLeft) {
      if (currentLength + 1 + sentences[start - 1].length <= maxChars) {
        start -= 1;
        currentLength += 1 + sentences[start].length;
        continue;
      }
      if (
        canRight &&
        currentLength + 1 + sentences[end + 1].length <= maxChars
      ) {
        end += 1;
        currentLength += 1 + sentences[end].length;
        continue;
      }
      break;
    }
  }

  return `${header}${sentences.slice(start, end + 1).join(' ')}`;
}
