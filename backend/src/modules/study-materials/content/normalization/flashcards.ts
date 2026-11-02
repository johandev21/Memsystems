import { citationsField, isRecord, stringify, toArray } from './value-readers';

export type NormalizedFlashcard = { front: string; back: string };
export type NormalizedFlashcardContent = {
  title?: string;
  cards: NormalizedFlashcard[];
  citations: unknown[];
};

export function normalizeFlashcardContent(
  content: unknown,
): NormalizedFlashcardContent {
  let cardsList: unknown[] = [];

  if (Array.isArray(content)) {
    cardsList = toArray(content);
  } else if (isRecord(content)) {
    if (Array.isArray(content.cards)) {
      cardsList = toArray(content.cards);
    } else if (Array.isArray(content.flashcards)) {
      cardsList = toArray(content.flashcards);
    } else {
      const arrayKey = Object.keys(content).find((k) =>
        Array.isArray(content[k]),
      );
      if (arrayKey) {
        cardsList = toArray(content[arrayKey]);
      } else if ('front' in content || 'back' in content) {
        cardsList = [content];
      }
    }
  }

  if (cardsList.length === 0) {
    cardsList = [{ front: 'Front', back: 'Back' }];
  }

  const normalizedCards = cardsList.map((card, index): NormalizedFlashcard => {
    if (!isRecord(card)) {
      return {
        front: stringify(card) || `Question ${index + 1}`,
        back: 'Answer',
      };
    }
    const front = card.front ?? card.question ?? card.prompt ?? card.q ?? '';
    const back = card.back ?? card.answer ?? card.response ?? card.a ?? '';
    return {
      front: stringify(front) || `Question ${index + 1}`,
      back: stringify(back) || 'Answer',
    };
  });

  return {
    title:
      isRecord(content) && content.title ? stringify(content.title) : undefined,
    cards: normalizedCards,
    citations: citationsField(content),
  };
}
