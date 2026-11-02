import { citationsField, isRecord, stringify, toArray } from './value-readers';

export type NormalizedRoadmapTopic = {
  id: string;
  title: string;
  description?: string;
  estimatedMinutes?: number;
  order: number;
};
export type NormalizedRoadmapPhase = {
  id: string;
  title: string;
  description?: string;
  color?: string;
  order: number;
  topics: NormalizedRoadmapTopic[];
};
export type NormalizedRoadmapContent = {
  title?: string;
  description?: string;
  phases: NormalizedRoadmapPhase[];
  citations: unknown[];
};

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
