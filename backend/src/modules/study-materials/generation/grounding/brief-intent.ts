import type { StudyMaterialKind } from '../../content/shapes';
import { tokenize } from '../../../ai/retrieval/text-similarity';
import {
  stripDiacritics,
  BOILERPLATE_HEADING_PATTERNS,
} from './content-filtering';
import type { BriefIntent } from './grounding.types';
import {
  EXPLICIT_SECTION_LOCATOR_REGEX,
  GENERIC_SURVEY_WORDS,
} from './brief-vocabulary';

export function classifyBriefIntent(input: {
  brief: string;
  kind: StudyMaterialKind;
  sourceTitles?: string[];
  sections?: string[][];
}): BriefIntent {
  const trimmed = input.brief.trim();
  if (!trimmed) return 'broad-survey';

  const normalizedBrief = stripDiacritics(trimmed).toLowerCase();
  const normalizedKind = input.kind.replaceAll('_', ' ').toLowerCase();
  if (normalizedBrief === normalizedKind) {
    return 'broad-survey';
  }

  for (const entry of BOILERPLATE_HEADING_PATTERNS) {
    if (
      entry.keys.some((key) =>
        new RegExp(`\\b${key.replace(/\s+/g, '\\s+')}\\b`, 'i').test(
          normalizedBrief,
        ),
      )
    ) {
      return 'focused-brief';
    }
  }

  if (EXPLICIT_SECTION_LOCATOR_REGEX.test(normalizedBrief)) {
    return 'focused-brief';
  }

  const titleTokens = new Set(
    (input.sourceTitles ?? []).flatMap((title) =>
      tokenize(title).map((token) => stripDiacritics(token)),
    ),
  );
  const briefTokens = tokenize(trimmed).map((token) => stripDiacritics(token));
  const specificTokens = briefTokens.filter(
    (token) => !GENERIC_SURVEY_WORDS.has(token) && !titleTokens.has(token),
  );

  if (specificTokens.length === 0) {
    return 'broad-survey';
  }

  return 'focused-brief';
}
