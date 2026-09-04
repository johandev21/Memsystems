import { StudyMaterialKind } from './shapes';

type NormalizedFlashcard = { front: string; back: string };
type NormalizedFlashcardContent = {
  title?: string;
  cards: NormalizedFlashcard[];
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
};

type NormalizedMindMapNode = {
  id: string;
  label: string;
  color?: string;
  position?: { x: number; y: number };
};
type NormalizedMindMapEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  directed?: boolean;
};
type NormalizedMindMapContent = {
  title?: string;
  rootId?: string;
  nodes: NormalizedMindMapNode[];
  edges: NormalizedMindMapEdge[];
};

export type SlidesLayout =
  'title' | 'title-bullets' | 'two-column' | 'quote' | 'closing';

type NormalizedSlidesSlide = {
  id: string;
  layout: SlidesLayout;
  title: string;
  subtitle?: string;
  bullets: string[];
  body?: string;
  notes?: string;
};

type NormalizedSlidesContent = {
  title?: string;
  theme?: {
    background?: string;
    accent?: string;
    text?: string;
    muted?: string;
  };
  slides: NormalizedSlidesSlide[];
  previews?: { slideId: string; svg: string }[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? (value as unknown[]) : [];

const arrayLength = (value: unknown): number =>
  Array.isArray(value) ? value.length : 0;

const stringify = (value: unknown): string =>
  typeof value === 'string' ? value : String(value);

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
  };
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

      // Check option explanations for explicit "Correct" or "Right answer" vs "Incorrect"
      if (
        !correctOptionId &&
        (correctOptionIndex < 0 ||
          correctOptionIndex >= normalizedOptions.length)
      ) {
        const explicitCorrectIdx = normalizedOptions.findIndex(
          (opt) =>
            /^correct/i.test(opt.explanation.trim()) ||
            /^right/i.test(opt.explanation.trim()),
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
          /^incorrect/i.test(currentOpt.explanation.trim()) ||
          /^not quite/i.test(currentOpt.explanation.trim())
        ) {
          const realCorrectIdx = normalizedOptions.findIndex(
            (opt) =>
              /^correct/i.test(opt.explanation.trim()) ||
              /^right/i.test(opt.explanation.trim()),
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
        correctOptionIndex = 0;
      }

      if (!correctOptionId) {
        correctOptionId = normalizedOptions[correctOptionIndex].id;
      }

      return {
        id: typeof q.id === 'string' ? q.id : `q-${index}`,
        prompt: stringify(prompt),
        options: normalizedOptions,
        correctOptionId,
      };
    },
  );

  return {
    title:
      isRecord(content) && content.title ? stringify(content.title) : undefined,
    questions: normalizedQuestions,
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
          : undefined,
      position:
        isRecord(n.position) &&
        typeof n.position.x === 'number' &&
        typeof n.position.y === 'number'
          ? { x: n.position.x, y: n.position.y }
          : undefined,
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
        label: typeof e.label === 'string' ? e.label : undefined,
        directed: typeof e.directed === 'boolean' ? e.directed : undefined,
      };
    })
    .filter((e): e is NormalizedMindMapEdge => e !== null);

  return {
    title:
      isRecord(content) && content.title ? stringify(content.title) : undefined,
    rootId:
      isRecord(content) && typeof content.rootId === 'string'
        ? content.rootId
        : undefined,
    nodes: normalizedNodes,
    edges: normalizedEdges,
  };
}

export function normalizeSlidesContent(
  content: unknown,
): NormalizedSlidesContent {
  const record = isRecord(content) ? content : {};
  const rawSlides: unknown[] = Array.isArray(record.slides)
    ? (record.slides as unknown[])
    : (() => {
        const arrayKey = Object.keys(record).find((k) =>
          Array.isArray(record[k]),
        );
        return arrayKey ? toArray(record[arrayKey]) : [];
      })();

  const validLayouts: SlidesLayout[] = [
    'title',
    'title-bullets',
    'two-column',
    'quote',
    'closing',
  ];

  const normalizedSlides = rawSlides.map((s, index): NormalizedSlidesSlide => {
    if (!isRecord(s)) {
      return {
        id: `slide-${index + 1}`,
        layout: index === 0 ? 'title' : 'title-bullets',
        title: stringify(s) || `Slide ${index + 1}`,
        bullets: [],
      };
    }
    const layout =
      typeof s.layout === 'string' &&
      (validLayouts as string[]).includes(s.layout)
        ? (s.layout as SlidesLayout)
        : index === 0
          ? 'title'
          : 'title-bullets';
    const bullets = toArray(s.bullets)
      .map((b) => stringify(b).trim())
      .filter((b) => b.length > 0)
      .slice(0, 6);
    return {
      id: typeof s.id === 'string' && s.id ? s.id : `slide-${index + 1}`,
      layout,
      title: stringify(s.title ?? s.heading ?? `Slide ${index + 1}`),
      subtitle: typeof s.subtitle === 'string' ? s.subtitle : undefined,
      bullets,
      body: typeof s.body === 'string' ? s.body : undefined,
      notes: typeof s.notes === 'string' ? s.notes : undefined,
    };
  });

  const theme = isRecord(record.theme) ? record.theme : {};
  const hexOrUndefined = (v: unknown) =>
    typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v) ? v : undefined;

  return {
    title:
      isRecord(content) && content.title ? stringify(content.title) : undefined,
    theme: {
      ...(hexOrUndefined(theme.background)
        ? { background: hexOrUndefined(theme.background) }
        : {}),
      ...(hexOrUndefined(theme.accent)
        ? { accent: hexOrUndefined(theme.accent) }
        : {}),
      ...(hexOrUndefined(theme.text)
        ? { text: hexOrUndefined(theme.text) }
        : {}),
      ...(hexOrUndefined(theme.muted)
        ? { muted: hexOrUndefined(theme.muted) }
        : {}),
    },
    slides: normalizedSlides,
    ...(Array.isArray(record.previews)
      ? { previews: record.previews as { slideId: string; svg: string }[] }
      : {}),
  };
}

export function normalizeContent(
  kind: StudyMaterialKind,
  content: unknown,
): unknown {
  if (!content || typeof content !== 'object') {
    return content;
  }

  switch (kind) {
    case 'simple_flashcard':
      return normalizeFlashcardContent(content);
    case 'quiz':
      return normalizeQuizContent(content);
    case 'roadmap':
      return normalizeRoadmapContent(content);
    case 'mind_map':
      return normalizeMindMapContent(content);
    case 'slides':
      return normalizeSlidesContent(content);
    default:
      return content;
  }
}

export function extractJson(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match?.[1]) {
    return match[1].trim();
  }
  const structuredMatch = text.match(
    /<structured_output>\s*([\s\S]*?)<\/structured_output>/,
  );
  if (structuredMatch?.[1]) {
    return structuredMatch[1].trim();
  }

  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  let startIdx = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
  }

  if (startIdx !== -1) {
    let sliced = text.slice(startIdx);
    sliced = sliced.replace(/<\/structured_output>[\s\S]*$/, '');
    sliced = sliced.replace(/```[\s\S]*$/, '');
    return sliced.trim();
  }

  return text.trim();
}

export function slugifyTitle(title: string, kind: StudyMaterialKind): string {
  const suffixMap: Record<StudyMaterialKind, string> = {
    quiz: '-quiz',
    simple_flashcard: '-flashcards',
    roadmap: '-roadmap',
    mind_map: '-mind-map',
    slides: '-slides',
  };

  const suffix = suffixMap[kind];
  let base = title.trim();

  const suffixWithoutHyphen = suffix.startsWith('-')
    ? suffix.substring(1)
    : suffix;
  const suffixRegex = new RegExp(
    `(?:[-\\s]${suffixWithoutHyphen}|^${suffixWithoutHyphen})$`,
    'i',
  );
  if (suffixRegex.test(base)) {
    base = base.replace(suffixRegex, '');
  }

  let slug = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  slug = slug.replace(/[^a-z0-9 -]/g, '');
  slug = slug.replace(/[\s_]+/g, '-');
  slug = slug.replace(/-+/g, '-');
  slug = slug.replace(/^-+|-+$/g, '');

  if (!slug) {
    slug = kind.replace('_', '-');
  }

  return `${slug}${suffix}`;
}

export function generateTitle(
  kind: StudyMaterialKind,
  content: unknown,
): string {
  const record = isRecord(content) ? content : {};
  let rawTitle = '';
  if (typeof record.title === 'string' && record.title.trim()) {
    rawTitle = record.title.trim();
  } else {
    switch (kind) {
      case 'quiz':
        rawTitle = `Quiz (${arrayLength(record.questions)} questions)`;
        break;
      case 'simple_flashcard':
        rawTitle = 'Flashcards';
        break;
      case 'roadmap':
        rawTitle = `Roadmap (${arrayLength(record.phases)} phases)`;
        break;
      case 'mind_map':
        rawTitle = `Mind Map (${arrayLength(record.nodes)} nodes)`;
        break;
      case 'slides':
        rawTitle = `Slides (${arrayLength(record.slides)} slides)`;
        break;
      default:
        rawTitle = 'Untitled';
    }
  }
  return slugifyTitle(rawTitle, kind);
}
