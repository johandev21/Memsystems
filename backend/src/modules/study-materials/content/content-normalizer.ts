import { StudyMaterialKind } from './shapes';
import { sanitizeGeneralKnowledgeSupplement } from '../generation/generation-supplement';
import { resolveSlideDeckPreservingPreviews } from '../slides/slides-design-resolver';
import type { SlideDeck } from '../slides/slides-design.types';
import { normalizeFlashcardContent } from './normalization/flashcards';
import { normalizeMindMapContent } from './normalization/mind-map';
import { normalizeQuizContent } from './normalization/quiz';
import { normalizeRoadmapContent } from './normalization/roadmap';

export { normalizeFlashcardContent } from './normalization/flashcards';
export {
  normalizeQuizContent,
  sanitizeExplanation,
} from './normalization/quiz';
export { normalizeRoadmapContent } from './normalization/roadmap';
export { normalizeMindMapContent } from './normalization/mind-map';
export {
  extractJson,
  repairJsonText,
  parseJsonLenient,
} from './normalization/json-recovery';
export { generateTitle } from './normalization/title-generation';

export function normalizeSlidesContent(content: unknown): SlideDeck {
  return resolveSlideDeckPreservingPreviews(content);
}

export function normalizeContent(
  kind: StudyMaterialKind,
  content: unknown,
): unknown {
  if (!content || typeof content !== 'object') {
    return content;
  }

  const supplement = sanitizeGeneralKnowledgeSupplement(content);

  let normalized: unknown;
  switch (kind) {
    case 'simple_flashcard':
      normalized = normalizeFlashcardContent(content);
      break;
    case 'quiz':
      normalized = normalizeQuizContent(content);
      break;
    case 'roadmap':
      normalized = normalizeRoadmapContent(content);
      break;
    case 'mind_map':
      normalized = normalizeMindMapContent(content);
      break;
    case 'slides':
      normalized = normalizeSlidesContent(content);
      break;
    default:
      normalized = content;
      break;
  }

  if (
    supplement !== undefined &&
    normalized !== null &&
    typeof normalized === 'object'
  ) {
    return {
      ...(normalized as Record<string, unknown>),
      generalKnowledgeSupplement: supplement,
    };
  }
  return normalized;
}
