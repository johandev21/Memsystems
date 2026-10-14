import { StudyMaterialKind } from './shapes';
import { sanitizeGeneralKnowledgeSupplement } from '../generation/generation-supplement';
import { resolveSlideDeckPreservingPreviews } from '../slides/slides-design-resolver';
import type { SlideDeck } from '../slides/slides-design.types';

type NormalizedFlashcard = { front: string; back: string };
type NormalizedFlashcardContent = {
  title?: string;
  cards: NormalizedFlashcard[];
  citations: unknown[];
};

type NormalizedQuizOption = { id: string; text: string; explanation: string };
type NormalizedQuizQuestion = {
  id: string;
  prompt: string;
  options: NormalizedQuizOption[];
  correctOptionId: string;
};
type NormalizedQuizContent = {
  title?: string;
  questions: NormalizedQuizQuestion[];
  citations: unknown[];
};

type NormalizedRoadmapTopic = {
  id: string;
  title: string;
  description?: string;
  estimatedMinutes?: number;
  order: number;
};
type NormalizedRoadmapPhase = {
  id: string;
  title: string;
  description?: string;
  color?: string;
  order: number;
  topics: NormalizedRoadmapTopic[];
};
type NormalizedRoadmapContent = {
  title?: string;
  description?: string;
  phases: NormalizedRoadmapPhase[];
  citations: unknown[];
};

type NormalizedMindMapNode = {
  id: string;
  label: string;
  color: string;
  position: { x: number; y: number };
};
type NormalizedMindMapEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  directed: boolean;
};
type NormalizedMindMapContent = {
  title: string;
  rootId: string;
  nodes: NormalizedMindMapNode[];
  edges: NormalizedMindMapEdge[];
  citations: unknown[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? (value as unknown[]) : [];

const stringify = (value: unknown): string =>
  typeof value === 'string' ? value : String(value);

const citationsField = (content: unknown): unknown[] =>
  isRecord(content) && Array.isArray(content.citations)
    ? (content.citations as unknown[])
    : [];

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

export function sanitizeExplanation(explanation: string): string {
  if (!explanation) return '';
  let cleaned = explanation
    .replace(
      /^(correct[oa]?s?|incorrect[oa]?s?|verdad(?:er[oa])?|fals[oa]|not quite|right answer|wrong answer|o)\s*([.:!\s-])\s*/i,
      '',
    )
    .trim();
  cleaned = cleaned
    .replace(
      /^(correct[oa]?s?|incorrect[oa]?s?|verdad(?:er[oa])?|fals[oa]|not quite|right answer|wrong answer)[.:!\s-]*/i,
      '',
    )
    .trim();
  return cleaned || explanation;
}

export function normalizeQuizContent(content: unknown): NormalizedQuizContent {
  let questions: unknown[];
  if (Array.isArray(content)) {
    questions = toArray(content);
  } else if (isRecord(content) && Array.isArray(content.questions)) {
    questions = toArray(content.questions);
  } else if (isRecord(content)) {
    const arrayKey = Object.keys(content).find((k) =>
      Array.isArray(content[k]),
    );
    questions = arrayKey ? toArray(content[arrayKey]) : [content];
  } else {
    questions = [content];
  }

  const normalizedQuestions = questions.map(
    (q, index): NormalizedQuizQuestion => {
      if (!isRecord(q)) {
        return {
          id: `q-${index}`,
          prompt: String(q),
          options: [
            { id: `q-${index}-o-0`, text: 'Option A', explanation: '' },
            { id: `q-${index}-o-1`, text: 'Option B', explanation: '' },
          ],
          correctOptionId: `q-${index}-o-0`,
        };
      }

      const prompt = q.prompt ?? q.question ?? q.text ?? q.title ?? 'Question';
      const rawOptions = q.options ?? q.choices ?? q.answers ?? [];
      const options: unknown[] = toArray(rawOptions);

      const normalizedOptions = options.map(
        (opt, optionIndex): NormalizedQuizOption => {
          if (typeof opt === 'string') {
            return {
              id: `q-${index}-o-${optionIndex}`,
              text: opt,
              explanation: 'Correct answer choice',
            };
          }
          const optRecord = isRecord(opt) ? opt : {};
          return {
            id: stringify(optRecord.id ?? `q-${index}-o-${optionIndex}`),
            text: stringify(
              optRecord.text ?? optRecord.choice ?? optRecord.value ?? 'Option',
            ),
            explanation: stringify(
              optRecord.explanation ?? optRecord.reason ?? 'Explanation',
            ),
          };
        },
      );

      while (normalizedOptions.length < 2) {
        normalizedOptions.push({
          id: `q-${index}-o-${normalizedOptions.length}`,
          text: `Option ${String.fromCharCode(65 + normalizedOptions.length)}`,
          explanation: 'Placeholder option',
        });
      }

      if (normalizedOptions.length > 6) {
        normalizedOptions.length = 6;
      }

      let correctOptionId: string | undefined;
      const rawCorrectId = q.correctOptionId ?? q.correct_option_id;
      if (typeof rawCorrectId === 'string') {
        const matchingOption = normalizedOptions.find(
          (opt) => opt.id === rawCorrectId,
        );
        if (matchingOption) {
          correctOptionId = matchingOption.id;
        }
      }

      let correctOptionIndex = -1;
      const rawCorrect =
        q.correctOptionIndex ??
        q.correct_option_index ??
        q.correctIndex ??
        q.correctAnswer ??
        q.correct_answer ??
        q.answer;

      if (!correctOptionId && typeof rawCorrect === 'number') {
        correctOptionIndex = rawCorrect;
      } else if (!correctOptionId && typeof rawCorrect === 'string') {
        const trimmed = rawCorrect.trim();
        if (/^[a-fA-F]$/.test(trimmed)) {
          correctOptionIndex = trimmed.toUpperCase().charCodeAt(0) - 65;
        } else if (/^option\s*([a-fA-F])$/i.test(trimmed)) {
          const letter = trimmed.match(/^option\s*([a-fA-F])$/i)![1];
          correctOptionIndex = letter.toUpperCase().charCodeAt(0) - 65;
        } else if (/^\d+$/.test(trimmed)) {
          correctOptionIndex = parseInt(trimmed, 10);
        } else {
          const idx = normalizedOptions.findIndex(
            (opt) => opt.text.trim().toLowerCase() === trimmed.toLowerCase(),
          );
          if (idx >= 0) {
            correctOptionIndex = idx;
          }
        }
      }

      if (
        !correctOptionId &&
        (correctOptionIndex < 0 ||
          correctOptionIndex >= normalizedOptions.length)
      ) {
        const explicitCorrectIdx = normalizedOptions.findIndex((opt) =>
          /^(correct[oa]?s?|verdad(?:er[oa])?|right)/i.test(
            opt.explanation.trim(),
          ),
        );
        if (explicitCorrectIdx >= 0) {
          correctOptionIndex = explicitCorrectIdx;
        }
      }

      if (
        !correctOptionId &&
        correctOptionIndex >= 0 &&
        correctOptionIndex < normalizedOptions.length
      ) {
        const currentOpt = normalizedOptions[correctOptionIndex];
        if (
          /^(incorrect[oa]?s?|fals[oa]|not quite)/i.test(
            currentOpt.explanation.trim(),
          )
        ) {
          const realCorrectIdx = normalizedOptions.findIndex((opt) =>
            /^(correct[oa]?s?|verdad(?:er[oa])?|right)/i.test(
              opt.explanation.trim(),
            ),
          );
          if (realCorrectIdx >= 0) {
            correctOptionIndex = realCorrectIdx;
          }
        }
      }

      if (
        !correctOptionId &&
        (correctOptionIndex < 0 ||
          correctOptionIndex >= normalizedOptions.length)
      ) {
        correctOptionIndex = Math.floor(
          Math.random() * normalizedOptions.length,
        );
      }

      if (!correctOptionId) {
        correctOptionId = normalizedOptions[correctOptionIndex].id;
      }

      const sanitizedOptions = normalizedOptions.map((opt) => ({
        ...opt,
        explanation: sanitizeExplanation(opt.explanation),
      }));

      return {
        id: typeof q.id === 'string' ? q.id : `q-${index}`,
        prompt: stringify(prompt),
        options: sanitizedOptions,
        correctOptionId,
      };
    },
  );

  return {
    title:
      isRecord(content) && content.title ? stringify(content.title) : undefined,
    questions: normalizedQuestions,
    citations: citationsField(content),
  };
}

export function normalizeRoadmapContent(
  content: unknown,
): NormalizedRoadmapContent {
  let phases: unknown[];
  if (Array.isArray(content)) {
    phases = toArray(content);
  } else if (isRecord(content) && Array.isArray(content.phases)) {
    phases = toArray(content.phases);
  } else if (isRecord(content)) {
    const arrayKey = Object.keys(content).find((k) =>
      Array.isArray(content[k]),
    );
    phases = arrayKey ? toArray(content[arrayKey]) : [];
  } else {
    phases = [];
  }

  const normalizedPhases = phases.map((p, pIndex): NormalizedRoadmapPhase => {
    if (!isRecord(p)) {
      return {
        id: `p-${pIndex}`,
        title: stringify(p),
        order: pIndex,
        topics: [],
      };
    }

    let topics: unknown[] = [];
    if (Array.isArray(p.topics)) {
      topics = toArray(p.topics);
    } else {
      const arrayKey = Object.keys(p).find((k) => Array.isArray(p[k]));
      if (arrayKey) topics = toArray(p[arrayKey]);
    }

    const normalizedTopics = topics.map((t, tIndex): NormalizedRoadmapTopic => {
      if (!isRecord(t)) {
        return {
          id: `t-${pIndex}-${tIndex}`,
          title: stringify(t),
          order: tIndex,
        };
      }
      return {
        id:
          typeof t.id === 'string'
            ? t.id
            : `t-${pIndex}-${tIndex}-${Math.random().toString(36).substring(7)}`,
        title: stringify(t.title ?? t.name ?? 'Topic'),
        description:
          typeof t.description === 'string'
            ? t.description
            : typeof t.details === 'string'
              ? t.details
              : undefined,
        estimatedMinutes:
          typeof t.estimatedMinutes === 'number'
            ? t.estimatedMinutes
            : undefined,
        order: typeof t.order === 'number' ? t.order : tIndex,
      };
    });

    return {
      id:
        typeof p.id === 'string'
          ? p.id
          : `p-${pIndex}-${Math.random().toString(36).substring(7)}`,
      title: stringify(p.title ?? p.name ?? 'Phase'),
      description:
        typeof p.description === 'string' ? p.description : undefined,
      color:
        typeof p.color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(p.color)
          ? p.color
          : undefined,
      order: typeof p.order === 'number' ? p.order : pIndex,
      topics: normalizedTopics,
    };
  });

  return {
    title:
      isRecord(content) && content.title ? stringify(content.title) : undefined,
    description:
      isRecord(content) && typeof content.description === 'string'
        ? content.description
        : undefined,
    phases: normalizedPhases,
    citations: citationsField(content),
  };
}

export function normalizeMindMapContent(
  content: unknown,
): NormalizedMindMapContent {
  const record = isRecord(content) ? content : {};
  const nodes: unknown[] = toArray(record.nodes);
  const edges: unknown[] = toArray(record.edges);

  const normalizedNodes = nodes.map((n, nIndex): NormalizedMindMapNode => {
    if (!isRecord(n)) {
      return {
        id: `node-${nIndex}`,
        label: stringify(n),
        color: '#64748b',
        position: { x: 0, y: 0 },
      };
    }
    return {
      id:
        typeof n.id === 'string'
          ? n.id
          : `node-${nIndex}-${Math.random().toString(36).substring(7)}`,
      label: stringify(n.label ?? n.title ?? n.text ?? 'Concept'),
      color:
        typeof n.color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(n.color)
          ? n.color
          : '#64748b',
      position:
        isRecord(n.position) &&
        typeof n.position.x === 'number' &&
        typeof n.position.y === 'number'
          ? { x: n.position.x, y: n.position.y }
          : { x: 0, y: 0 },
    };
  });

  const normalizedEdges = edges
    .map((e, eIndex): NormalizedMindMapEdge | null => {
      if (!isRecord(e)) {
        return null;
      }
      return {
        id:
          typeof e.id === 'string'
            ? e.id
            : `edge-${eIndex}-${Math.random().toString(36).substring(7)}`,
        sourceId: stringify(e.sourceId ?? e.source ?? ''),
        targetId: stringify(e.targetId ?? e.target ?? ''),
        label: typeof e.label === 'string' ? e.label : '',
        directed: typeof e.directed === 'boolean' ? e.directed : true,
      };
    })
    .filter((e): e is NormalizedMindMapEdge => e !== null);

  return {
    title:
      isRecord(content) && content.title
        ? stringify(content.title)
        : 'mind-map',
    rootId:
      isRecord(content) && typeof content.rootId === 'string'
        ? content.rootId
        : (normalizedNodes[0]?.id ?? ''),
    nodes: normalizedNodes,
    edges: normalizedEdges,
    citations: citationsField(content),
  };
}

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

export function extractJson(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  let working = trimmed;

  const fencePattern = /```(?:json)?\s*([\s\S]*?)```/gi;
  const blocks: string[] = [];
  let fenceMatch: RegExpExecArray | null;
  while ((fenceMatch = fencePattern.exec(trimmed)) !== null) {
    blocks.push(fenceMatch[1]);
  }
  if (blocks.length > 0) {
    working = (
      blocks.find((block) => block.includes('{') || block.includes('[')) ??
      blocks[0]
    ).trim();
  } else {
    const structuredMatch = trimmed.match(
      /<structured_output>\s*([\s\S]*?)(?:<\/structured_output>|$)/i,
    );
    if (
      structuredMatch?.[1] &&
      (structuredMatch[1].includes('{') || structuredMatch[1].includes('['))
    ) {
      working = structuredMatch[1].trim();
    } else {
      working = trimmed.replace(/<\/?structured_output>/gi, '').trim();
      const firstBrace = working.indexOf('{');
      const firstBracket = working.indexOf('[');
      let startIdx = -1;
      if (
        firstBrace !== -1 &&
        (firstBracket === -1 || firstBrace < firstBracket)
      ) {
        startIdx = firstBrace;
      } else if (firstBracket !== -1) {
        startIdx = firstBracket;
      }
      if (startIdx !== -1) {
        working = working.slice(startIdx);
      }
    }
  }

  working = working.replace(/```[\s\S]*$/, '').trim();
  working = working.replace(/<\/structured_output>[\s\S]*$/i, '').trim();

  const lastBrace = working.lastIndexOf('}');
  const lastBracket = working.lastIndexOf(']');
  const lastClose = Math.max(lastBrace, lastBracket);
  if (lastClose !== -1 && lastClose < working.length - 1) {
    const tail = working.slice(lastClose + 1);
    if (!/[:{[]/.test(tail)) {
      working = working.slice(0, lastClose + 1).trim();
    }
  }

  return working;
}

export function repairJsonText(text: string): string {
  const normalized = text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

  let out = '';
  let i = 0;
  const len = normalized.length;
  let inDouble = false;

  while (i < len) {
    const ch = normalized[i];

    if (inDouble) {
      out += ch;
      if (ch === '\\' && i + 1 < len) {
        out += normalized[i + 1];
        i += 2;
        continue;
      }
      if (ch === '"') inDouble = false;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inDouble = true;
      out += ch;
      i += 1;
      continue;
    }

    if (ch === '/' && i + 1 < len) {
      const next = normalized[i + 1];
      if (next === '/') {
        while (i < len && normalized[i] !== '\n') i += 1;
        continue;
      }
      if (next === '*') {
        i += 2;
        while (
          i < len &&
          !(normalized[i] === '*' && normalized[i + 1] === '/')
        ) {
          i += 1;
        }
        i += 2;
        continue;
      }
    }

    if (ch === "'") {
      let j = i + 1;
      let inner = '';
      let closed = false;
      while (j < len) {
        const c = normalized[j];
        if (c === '\\' && j + 1 < len) {
          inner += c + normalized[j + 1];
          j += 2;
          continue;
        }
        if (c === "'") {
          closed = true;
          break;
        }
        inner += c;
        j += 1;
      }
      if (!closed) {
        out += '"';
        i += 1;
        continue;
      }
      const unescaped = inner.replace(/\\'/g, "'");
      out += `"${unescaped.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
      i = j + 1;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out.replace(/,(\s*[}\]])/g, '$1');
}

export function parseJsonLenient(text: string): unknown {
  const cleaned = extractJson(text);
  try {
    return JSON.parse(cleaned);
  } catch (firstError) {
    const repaired = repairJsonText(cleaned);
    if (repaired !== cleaned) {
      try {
        return JSON.parse(repaired);
      } catch {
        void 0;
      }
    }
    const preview = cleaned.slice(0, 500);
    const reason =
      firstError instanceof Error ? firstError.message : String(firstError);
    throw new SyntaxError(
      `Lenient JSON parse failed (${reason}). Preview: ${preview}`,
    );
  }
}

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
