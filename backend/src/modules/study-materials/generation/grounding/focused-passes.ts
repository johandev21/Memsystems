import { tokenize } from '../../../ai/retrieval/text-similarity';
import type { RetrievedChunk } from '../../../ai/retrieval/retrieval.service';
import { GENERATION_MAX_PASS_QUERY_CHARS } from './budgets';
import { normalizeHeadingSegment, stripDiacritics } from './content-filtering';
import { GENERIC_SURVEY_WORDS } from './brief-vocabulary';
import type {
  PlannedPass,
  SourceMetaRow,
  SourceSection,
} from './grounding.types';

const SECTION_MATCH_STOP_WORDS = new Set([
  ...GENERIC_SURVEY_WORDS,
  'focus',
  'focused',
  'only',
  'specifically',
  'particular',
  'especially',
  'enfocate',
  'enfocado',
  'enfocada',
  'enfocar',
  'centrate',
  'centrado',
  'centrada',
  'centrar',
  'solo',
  'solamente',
  'unicamente',
  'especificamente',
  'particularmente',
  'especialmente',
]);

const STRUCTURAL_LABEL_ALIASES: Record<string, string> = {
  part: '(?:part|parte)',
  chapter: '(?:chapter|chap|ch|capitulo|cap)',
  section: '(?:section|sec|seccion)',
  experiment: '(?:experiment|exp|experimento)',
  unit: '(?:unit|unidad)',
  module: '(?:module|mod|modulo)',
  lecture: '(?:lecture|clase|leccion)',
  appendix: '(?:appendix|apendice|anexo)',
  phase: '(?:phase|fase|etapa)',
};

function canonicalizeStructuralLabel(raw: string): string {
  const clean = stripDiacritics(raw).toLowerCase();
  if (clean.startsWith('chap') || clean === 'ch' || clean.startsWith('cap')) {
    return 'chapter';
  }
  if (clean.startsWith('part')) return 'part';
  if (clean.startsWith('sec')) return 'section';
  if (clean.startsWith('exp')) return 'experiment';
  if (clean.startsWith('uni')) return 'unit';
  if (clean.startsWith('mod')) return 'module';
  if (clean === 'lecture' || clean === 'clase' || clean === 'leccion') {
    return 'lecture';
  }
  if (clean === 'appendix' || clean === 'apendice' || clean === 'anexo') {
    return 'appendix';
  }
  if (clean === 'phase' || clean === 'fase' || clean === 'etapa') {
    return 'phase';
  }
  return clean;
}

export function matchSectionsForBrief(
  brief: string,
  sourceTitle: string,
  sections: SourceSection[],
): SourceSection[] {
  const nonEmptySections = sections.filter((sec) =>
    sec.headingPath.some((segment) => segment.trim().length > 0),
  );
  if (nonEmptySections.length <= 1) return [];

  const lowerBrief = stripDiacritics(brief).toLowerCase();
  const titleTokens = new Set(
    tokenize(sourceTitle).map((token) => stripDiacritics(token)),
  );
  const briefTokens = tokenize(brief)
    .map((token) => stripDiacritics(token))
    .filter(
      (token) =>
        !SECTION_MATCH_STOP_WORDS.has(token) && !titleTokens.has(token),
    );
  const briefTokenSet = new Set(briefTokens);

  const structuralRefs: { label: string; value: string }[] = [];
  const structRegex =
    /\b(part|parte|chapter|chap|ch|capitulo|cap|section|sec|seccion|experiment|exp|experimento|unit|unidad|module|mod|modulo|lecture|clase|leccion|appendix|apendice|anexo|phase|fase|etapa)\s*(\d+|[ivxlcdm]+)\b/gi;
  for (const match of lowerBrief.matchAll(structRegex)) {
    structuralRefs.push({
      label: canonicalizeStructuralLabel(match[1]),
      value: match[2].toLowerCase(),
    });
  }

  const scored: {
    section: SourceSection;
    structuralHits: number;
    lexicalHits: number;
  }[] = [];

  for (const section of nonEmptySections) {
    const joinedLower = stripDiacritics(
      section.headingPath.join(' '),
    ).toLowerCase();
    const headingTokens = tokenize(joinedLower).map((token) =>
      stripDiacritics(token),
    );

    let structuralHits = 0;
    for (const ref of structuralRefs) {
      const labelPattern = STRUCTURAL_LABEL_ALIASES[ref.label] ?? ref.label;
      const refRegex = new RegExp(`\\b${labelPattern}\\s*${ref.value}\\b`, 'i');
      if (refRegex.test(joinedLower)) {
        structuralHits += 1;
      }
    }

    let lexicalHits = 0;
    for (const hToken of headingTokens) {
      if (hToken.length < 3 || SECTION_MATCH_STOP_WORDS.has(hToken)) continue;
      if (titleTokens.has(hToken) && !lowerBrief.includes(joinedLower)) {
        continue;
      }
      if (briefTokenSet.has(hToken)) {
        lexicalHits += 1;
        continue;
      }
      if (
        hToken.length >= 5 &&
        briefTokens.some(
          (bToken) =>
            bToken.length >= 5 &&
            (hToken.startsWith(bToken.slice(0, 5)) ||
              bToken.startsWith(hToken.slice(0, 5))),
        )
      ) {
        lexicalHits += 1;
      }
    }

    for (const segment of section.headingPath) {
      const norm = normalizeHeadingSegment(segment);
      if (norm.length >= 4 && lowerBrief.includes(norm)) {
        lexicalHits += 2;
      }
    }

    if (structuralHits > 0 || lexicalHits > 0) {
      scored.push({ section, structuralHits, lexicalHits });
    }
  }

  if (scored.length === 0) return [];

  const hasBothHits = scored.some(
    (item) => item.structuralHits > 0 && item.lexicalHits > 0,
  );
  const filtered = hasBothHits
    ? scored.filter((item) => item.structuralHits > 0 && item.lexicalHits > 0)
    : scored;

  const matched = filtered.map((item) => item.section);
  return matched.length < nonEmptySections.length ? matched : [];
}

export function planFocusedPasses(input: {
  source: SourceMetaRow;
  sections: SourceSection[];
  excludedChunkIds: string[];
  brief: string;
  budget: number;
  maxPasses: number;
}): PlannedPass[] {
  const { source, sections, excludedChunkIds, brief, budget, maxPasses } =
    input;
  const cleanQuery = brief
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, GENERATION_MAX_PASS_QUERY_CHARS);
  const exclude = excludedChunkIds.length > 0 ? excludedChunkIds : undefined;

  const matchedSections = matchSectionsForBrief(brief, source.title, sections);
  if (matchedSections.length > 0) {
    const passCount = Math.max(
      1,
      Math.min(matchedSections.length, maxPasses, budget),
    );
    const buckets = bucketItems(matchedSections, passCount);
    return buckets.map((bucket) => ({
      sourceId: source.id,
      query: cleanQuery,
      topK: budget,
      headingPaths: bucket.map((sec) => sec.headingPath),
      excludeChunkIds: exclude,
    }));
  }

  const requestsMultiSectionWalk =
    sections.length > 1 &&
    /\b(?:sections?|secciones|seccion|chapters?|capitulos?|parts?|partes)\b/i.test(
      stripDiacritics(brief),
    );

  if (requestsMultiSectionWalk) {
    const passCount = Math.max(1, Math.min(sections.length, maxPasses, budget));
    const buckets = bucketItems(sections, passCount);
    return buckets.map((bucket) => ({
      sourceId: source.id,
      query: cleanQuery,
      topK: budget,
      headingPaths: bucket.map((sec) => sec.headingPath),
      chunkIndexRange: {
        minChunkIndex: Math.min(...bucket.map((sec) => sec.minChunkIndex)),
        maxChunkIndex: Math.max(...bucket.map((sec) => sec.maxChunkIndex)),
      },
      excludeChunkIds: exclude,
    }));
  }

  return [
    {
      sourceId: source.id,
      query: cleanQuery,
      topK: budget,
      excludeChunkIds: exclude,
    },
  ];
}

function bucketItems<T>(items: T[], bucketCount: number): T[][] {
  const count = Math.max(1, Math.min(items.length, bucketCount));
  const buckets: T[][] = Array.from({ length: count }, () => []);
  items.forEach((item, index) => {
    const bucket = Math.min(
      count - 1,
      Math.floor((index * count) / items.length),
    );
    buckets[bucket].push(item);
  });
  return buckets.filter((bucket) => bucket.length > 0);
}

export function postFilterPassChunks(
  chunks: RetrievedChunk[],
  pass: PlannedPass,
): RetrievedChunk[] {
  let result = chunks;
  if (pass.excludeChunkIds && pass.excludeChunkIds.length > 0) {
    const excluded = new Set(pass.excludeChunkIds);
    result = result.filter((chunk) => !excluded.has(chunk.chunkId));
  }
  if (pass.headingPaths && pass.headingPaths.length > 0) {
    const allowed = new Set(pass.headingPaths.map((path) => path.join(' > ')));
    const matching = result.filter((chunk) =>
      allowed.has((chunk.sectionPath ?? []).join(' > ')),
    );
    if (matching.length > 0) {
      result = matching;
    }
  }
  if (pass.chunkIndexRange) {
    const { minChunkIndex, maxChunkIndex } = pass.chunkIndexRange;
    const inRange = result.filter(
      (chunk) =>
        chunk.chunkIndex >= minChunkIndex && chunk.chunkIndex <= maxChunkIndex,
    );
    if (inRange.length > 0) {
      result = inRange;
    }
  }
  return result;
}
