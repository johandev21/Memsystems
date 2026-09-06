import { StudyMaterialKind } from './shapes';
import { resolveSlideDeckPreservingPreviews } from './slides-design-resolver';
import type { SlideDeck } from './slides-design.types';

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
  };
}

export function normalizeSlidesContent(content: unknown): SlideDeck {
  // The resolver is authoritative: it accepts structured scenes, legacy
  // prose slides, and malformed partial output, always returning a complete
  // validated deck. Previews passthrough is handled by the caller.
  return resolveSlideDeckPreservingPreviews(content);
}

export function normalizeCaseStudyContent(content: unknown): unknown {
  if (!isRecord(content)) return content;
  const questions = toArray(content.questions).map((q, qIndex) => {
    if (!isRecord(q)) {
      return { id: `question-${qIndex + 1}`, prompt: stringify(q), hint: '' };
    }
    return {
      id: typeof q.id === 'string' ? q.id : `question-${qIndex + 1}`,
      prompt: stringify(q.prompt ?? q.question ?? q.text ?? 'Question'),
      hint: typeof q.hint === 'string' ? q.hint : '',
    };
  });
  const questionIds = questions.map((q: { id: string }) => q.id);
  const analyses = toArray(content.analyses).map((a, aIndex) => {
    if (!isRecord(a)) {
      return {
        questionId: questionIds[aIndex] ?? `question-${aIndex + 1}`,
        reasoning: stringify(a),
        keyPoints: [],
        conceptApplications: [],
        assumptions: [],
        tradeoffs: [],
        alternativePerspectives: [],
        checklist: [],
        sourceIds: [],
      };
    }
    const strArray = (v: unknown): string[] =>
      Array.isArray(v) ? (v as unknown[]).map((x) => stringify(x)) : [];
    const conceptApplications = toArray(
      a.conceptApplications ?? a.concepts ?? [],
    ).map((c) => {
      if (!isRecord(c))
        return {
          concept: stringify(c),
          application: stringify(c),
          sourceIds: [],
        };
      return {
        concept: stringify(c.concept ?? c.title ?? c.name ?? 'Concept'),
        application: stringify(c.application ?? c.explanation ?? c.text ?? ''),
        sourceIds: Array.isArray(c.sourceIds)
          ? (c.sourceIds as unknown[]).map((id) => stringify(id))
          : [],
      };
    });
    const alternativePerspectives = toArray(
      a.alternativePerspectives ?? a.alternatives ?? a.perspectives ?? [],
    ).map((p) => {
      if (!isRecord(p))
        return {
          viewpoint: stringify(p),
          reasoning: stringify(p),
          sourceIds: [],
        };
      return {
        viewpoint: stringify(p.viewpoint ?? p.title ?? p.name ?? 'Perspective'),
        reasoning: stringify(p.reasoning ?? p.explanation ?? p.text ?? ''),
        sourceIds: Array.isArray(p.sourceIds)
          ? (p.sourceIds as unknown[]).map((id) => stringify(id))
          : [],
      };
    });
    return {
      questionId:
        typeof a.questionId === 'string'
          ? a.questionId
          : (questionIds[aIndex] ?? `question-${aIndex + 1}`),
      reasoning: stringify(a.reasoning ?? a.analysis ?? a.explanation ?? ''),
      keyPoints: strArray(a.keyPoints ?? a.points ?? []),
      conceptApplications,
      assumptions: strArray(a.assumptions ?? []),
      tradeoffs: strArray(a.tradeoffs ?? []),
      alternativePerspectives,
      checklist: strArray(a.checklist ?? a.selfCheck ?? []),
      sourceIds: Array.isArray(a.sourceIds)
        ? (a.sourceIds as unknown[]).map((id) => stringify(id))
        : [],
    };
  });
  const scenario = isRecord(content.scenario)
    ? {
        title:
          typeof content.scenario.title === 'string'
            ? content.scenario.title
            : 'Scenario',
        setting: stringify(
          content.scenario.setting ?? content.scenario.context ?? '',
        ),
        narrative: stringify(
          content.scenario.narrative ?? content.scenario.story ?? '',
        ),
        isFictional:
          typeof content.scenario.isFictional === 'boolean'
            ? content.scenario.isFictional
            : true,
      }
    : { title: 'Scenario', setting: '', narrative: '', isFictional: true };
  return {
    ...content,
    scenario,
    questions,
    analyses,
    facts: Array.isArray(content.facts)
      ? (content.facts as unknown[]).map((x) => stringify(x))
      : [],
    learningObjectives: Array.isArray(content.learningObjectives)
      ? (content.learningObjectives as unknown[]).map((x) => stringify(x))
      : [],
    conceptsFocus:
      typeof content.conceptsFocus === 'string'
        ? content.conceptsFocus
        : typeof content.focus === 'string'
          ? content.focus
          : '',
    sourceIds: Array.isArray(content.sourceIds)
      ? (content.sourceIds as unknown[]).map((id) => stringify(id))
      : [],
  };
}

export function normalizePracticeProblemsContent(content: unknown): unknown {
  if (!isRecord(content)) return content;
  const problems = toArray(content.problems).map((p, pIndex) => {
    if (!isRecord(p)) {
      return {
        id: `problem-${pIndex + 1}`,
        prompt: stringify(p),
        givens: [],
        constraints: [],
        hints: [],
        steps: [
          {
            id: `problem-${pIndex + 1}-step-1`,
            title: 'Worked solution',
            explanation: 'Solution',
            sourceIds: [],
          },
        ],
        answer: 'Answer',
        checklist: [],
        acceptableAlternatives: [],
        sourceIds: [],
      };
    }
    const steps = toArray(p.steps).map((s, sIndex) => {
      if (!isRecord(s)) {
        return {
          id: `step-${sIndex + 1}`,
          title: stringify(s),
          explanation: stringify(s),
          sourceIds: [],
        };
      }
      return {
        id: typeof s.id === 'string' ? s.id : `step-${sIndex + 1}`,
        title: stringify(s.title ?? s.name ?? `Step ${sIndex + 1}`),
        explanation: stringify(s.explanation ?? s.body ?? s.text ?? ''),
        sourceIds: Array.isArray(s.sourceIds)
          ? (s.sourceIds as unknown[]).map((id) => stringify(id))
          : [],
      };
    });
    const strArray = (v: unknown): string[] =>
      Array.isArray(v) ? (v as unknown[]).map((x) => stringify(x)) : [];
    return {
      id: typeof p.id === 'string' ? p.id : `problem-${pIndex + 1}`,
      prompt: stringify(p.prompt ?? p.question ?? p.title ?? 'Problem'),
      givens: strArray(p.givens ?? p.given ?? []),
      constraints: strArray(p.constraints ?? p.rules ?? []),
      hints: strArray(p.hints ?? []),
      steps,
      answer: stringify(p.answer ?? p.solution ?? p.exemplar ?? ''),
      checklist: strArray(p.checklist ?? p.criteria ?? []),
      acceptableAlternatives: strArray(
        p.acceptableAlternatives ?? p.alternatives ?? [],
      ),
      sourceIds: Array.isArray(p.sourceIds)
        ? (p.sourceIds as unknown[]).map((id) => stringify(id))
        : [],
    };
  });
  return {
    ...content,
    problems,
    sourceIds: Array.isArray(content.sourceIds)
      ? (content.sourceIds as unknown[]).map((id) => stringify(id))
      : [],
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
    case 'practice_problems':
      return normalizePracticeProblemsContent(content);
    case 'case_study':
      return normalizeCaseStudyContent(content);
    default:
      return content;
  }
}

export function extractJson(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  let working = trimmed;

  // 1. Fenced code blocks: prefer the first block containing JSON structure.
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
    // 2. <structured_output> wrappers (case-insensitive, closing tag optional).
    const structuredMatch = trimmed.match(
      /<structured_output>\s*([\s\S]*?)(?:<\/structured_output>|$)/i,
    );
    if (
      structuredMatch?.[1] &&
      (structuredMatch[1].includes('{') || structuredMatch[1].includes('['))
    ) {
      working = structuredMatch[1].trim();
    } else {
      // 3. Strip stray tags, then slice from the first { or [ (leading prose).
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

  // 4. Drop trailing fence fragments / closing tags left over from streaming.
  working = working.replace(/```[\s\S]*$/, '').trim();
  working = working.replace(/<\/structured_output>[\s\S]*$/i, '').trim();

  // 5. Drop trailing prose after the last } / ], but only when the tail shows
  // no sign of being a truncated partial (partials almost always carry a
  // structural continuation such as ":", "{" or "[").
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

/**
 * Minimal tolerant repair for near-JSON model output. Handles the failure
 * modes seen from small/flash models: single-quoted strings (e.g. 'p2-s8'),
 * trailing commas, smart quotes, and stray JS comments. Single-quote
 * conversion only applies outside double-quoted strings, so apostrophes
 * inside "..." are never touched. Best-effort: anything beyond these cases
 * should fail downstream with a truncated preview (see parseJsonLenient).
 */
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

    // Strip JS-style comments outside strings.
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

    // Convert single-quoted strings to double-quoted.
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
        // Unterminated quote: emit an opening double quote and let the
        // downstream parser fail with a preview.
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

  // Drop trailing commas before } or ].
  return out.replace(/,(\s*[}\]])/g, '$1');
}

/**
 * Strict parse with a single tolerant-repair retry. Throws a SyntaxError with
 * a truncated preview of the offending text so logs stay useful.
 */
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
        // Fall through to the preview error below.
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

export function slugifyTitle(title: string, kind: StudyMaterialKind): string {
  const suffixMap: Record<StudyMaterialKind, string> = {
    quiz: '-quiz',
    simple_flashcard: '-flashcards',
    roadmap: '-roadmap',
    mind_map: '-mind-map',
    slides: '-slides',
    study_guide: '-study-guide',
    practice_problems: '-practice-problems',
    case_study: '-case-study',
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
      case 'practice_problems':
        rawTitle = `Practice Problems (${arrayLength(record.problems)} problems)`;
        break;
      case 'case_study':
        rawTitle = `Case Study (${arrayLength(record.questions)} questions)`;
        break;
      default:
        rawTitle = 'Untitled';
    }
  }
  return slugifyTitle(rawTitle, kind);
}
