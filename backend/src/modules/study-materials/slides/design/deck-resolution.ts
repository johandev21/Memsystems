import {
  GENERAL_KNOWLEDGE_SUPPLEMENT_FIELD,
  sanitizeGeneralKnowledgeSupplement,
} from '../../generation/generation-supplement';
import type {
  LegacySlidesContent,
  SlideDeck,
  SlideScene,
} from '../slides-design.types';
import { isStructuredSlidesContent } from '../slides-design.schema';
import { presetForThemeName, resolveDesign } from './design-presets';
import { resolveScene } from './design-normalization';
import { legacySlideToScene } from './legacy-slide-conversion';
import {
  clampText,
  isRecord,
  toString,
  MAX_ELEMENTS_PER_DECK,
  MAX_SLIDES,
} from './design-values';

function applyRoleRules(scenes: SlideScene[]): SlideScene[] {
  if (scenes.length === 0) return scenes;
  const next = scenes.map((scene) => ({
    ...scene,
    elements: [...scene.elements],
  }));

  next[0] = { ...next[0], role: 'title' };

  if (next.length > 1) {
    const last = next[next.length - 1];
    if (last.role !== 'closing' && last.role !== 'takeaways') {
      next[next.length - 1] = { ...last, role: 'closing' };
    }
  }

  let consecutive = 0;
  for (let i = 0; i < next.length; i++) {
    if (next[i].role === 'content') {
      consecutive += 1;
      if (consecutive > 2) {
        next[i] = { ...next[i], role: 'cards' };
        consecutive = 0;
      }
    } else {
      consecutive = 0;
    }
  }

  let sections = 0;
  for (let i = 0; i < next.length; i++) {
    if (next[i].role === 'section') {
      sections += 1;
      if (sections > 3) {
        next[i] = { ...next[i], role: 'content' };
      }
    }
  }
  return next;
}

export function resolveSlideDeck(input: unknown): SlideDeck {
  const record = isRecord(input) ? input : {};
  const title = clampText(
    toString(record.title ?? 'slides').trim() || 'slides',
    200,
  );

  const designInput = isRecord(record.design)
    ? record.design
    : isRecord(record.theme)
      ? { ...record.theme }
      : undefined;
  const design = resolveDesign(designInput ?? presetForThemeName(undefined));

  let scenes: SlideScene[] = [];
  const rawSlides: unknown[] = Array.isArray(record.slides)
    ? record.slides
    : (() => {
        const arrayKey = Object.keys(record).find((key) =>
          Array.isArray(record[key]),
        );
        return arrayKey ? (record[arrayKey] as unknown[]) : [];
      })();

  if (rawSlides.length > 0 && !isStructuredSlidesContent(input)) {
    scenes = (rawSlides as LegacySlidesContent['slides']).map(
      (slide, index) => {
        if (!isRecord(slide)) {
          return {
            id: `slide-${index + 1}`,
            role: index === 0 ? 'title' : 'content',
            title: clampText(
              toString(slide).trim() || `Slide ${index + 1}`,
              200,
            ),
            elements: [
              {
                type: 'text' as const,
                text: clampText(
                  toString(slide).trim() || `Slide ${index + 1}`,
                  2000,
                ),
              },
            ],
          };
        }
        const legacy = {
          id: toString(slide.id) || `slide-${index + 1}`,
          layout: [
            'title',
            'title-bullets',
            'two-column',
            'quote',
            'closing',
          ].includes(toString(slide.layout))
            ? slide.layout
            : index === 0
              ? ('title' as const)
              : ('title-bullets' as const),
          title: toString(
            slide.title ??
              (slide as { heading?: unknown }).heading ??
              `Slide ${index + 1}`,
          ),
          subtitle:
            typeof slide.subtitle === 'string' ? slide.subtitle : undefined,
          bullets: Array.isArray(slide.bullets) ? slide.bullets : [],
          body: typeof slide.body === 'string' ? slide.body : undefined,
          notes: typeof slide.notes === 'string' ? slide.notes : undefined,
        };
        return legacySlideToScene(legacy, index);
      },
    );
  } else {
    scenes = rawSlides
      .map((slide, index) => resolveScene(slide, index))
      .filter((scene): scene is SlideScene => scene !== null);
  }

  scenes = scenes.slice(0, MAX_SLIDES);
  if (scenes.length === 0) {
    scenes = [
      {
        id: 'slide-1',
        role: 'title',
        title,
        elements: [{ type: 'text', text: title }],
      },
    ];
  }

  let total = scenes.reduce((sum, scene) => sum + scene.elements.length, 0);
  if (total > MAX_ELEMENTS_PER_DECK) {
    let overflow = total - MAX_ELEMENTS_PER_DECK;
    for (let i = scenes.length - 1; i >= 0 && overflow > 0; i--) {
      const removable = Math.min(overflow, scenes[i].elements.length - 1);
      if (removable > 0) {
        scenes[i] = {
          ...scenes[i],
          elements: scenes[i].elements.slice(
            0,
            scenes[i].elements.length - removable,
          ),
        };
        overflow -= removable;
      }
    }
    total = scenes.reduce((sum, scene) => sum + scene.elements.length, 0);
    void total;
  }

  scenes = applyRoleRules(scenes);

  const seen = new Set<string>();
  scenes = scenes.map((scene, index) => {
    let id = scene.id.trim() || `slide-${index + 1}`;
    if (seen.has(id)) {
      id = `${id}-${index + 1}`;
    }
    seen.add(id);
    return { ...scene, id };
  });

  const citations = asCitations(record.citations);
  const supplement = sanitizeGeneralKnowledgeSupplement(record);

  return {
    schemaVersion: 2,
    title,
    design,
    slides: scenes,
    ...(supplement !== undefined
      ? { [GENERAL_KNOWLEDGE_SUPPLEMENT_FIELD]: supplement }
      : {}),
    citations,
  };
}

function asCitations(value: unknown): SlideDeck['citations'] {
  return Array.isArray(value) ? (value as SlideDeck['citations']) : undefined;
}

export function resolveSlideDeckPreservingPreviews(input: unknown): SlideDeck {
  const deck = resolveSlideDeck(input);
  const record = isRecord(input) ? input : {};
  if (Array.isArray(record.previews)) {
    return { ...deck, previews: record.previews as SlideDeck['previews'] };
  }
  return deck;
}
