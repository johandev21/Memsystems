import { StudyMaterialKind } from '../shapes';
import { isRecord } from './value-readers';

export function generateTitle(
  kind: StudyMaterialKind,
  content: unknown,
): string {
  const record = isRecord(content) ? content : {};
  let rawTitle = '';
  if (typeof record.title === 'string' && record.title.trim()) {
    rawTitle = record.title.trim();
  }

  if (!rawTitle) {
    switch (kind) {
      case 'quiz':
        return 'Mastering Quiz Concepts';
      case 'simple_flashcard':
        return 'Recalling Flashcard Concepts';
      case 'roadmap':
        return 'Navigating Learning Roadmap';
      case 'mind_map':
        return 'Mapping Core Concepts';
      case 'slides':
        return 'Exploring Slide Topics';
      default:
        return 'Mastering Key Concepts';
    }
  }

  let title = rawTitle.replace(/^["'`]+|["'`]+$/g, '').trim();

  const suffixMap: Record<StudyMaterialKind, string> = {
    quiz: 'quiz',
    simple_flashcard: 'flashcards?',
    roadmap: 'roadmap',
    mind_map: 'mind[-_ ]*map',
    slides: 'slides?',
    audio_overview: 'audio[-_ ]*overview',
  };
  const suffixPattern = suffixMap[kind];
  if (suffixPattern) {
    const suffixRegex = new RegExp(
      `(?:[-_\\s]+${suffixPattern}|\\s*\\(${suffixPattern}\\))$`,
      'i',
    );
    title = title.replace(suffixRegex, '').trim();
  }

  if (!title.includes(' ') && (title.includes('-') || title.includes('_'))) {
    title = title
      .split(/[-_]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  title = title.replace(/\s+/g, ' ').trim();

  if (title.length > 50) {
    title = title.slice(0, 50).trim();
  }

  return title || 'Mastering Key Concepts';
}
