import {
  FALLBACK_FONT,
  SUPPORTED_FONTS,
  type LegacySlidesContent,
  type LegacySlidesSlide,
  type SlideDeck,
  type SlideDesign,
  type SlideDesignPreset,
  type SlideElement,
  type SlideRole,
  type SlideScene,
  type SupportedFont,
} from './slides-design.types';
import { isStructuredSlidesContent } from './slides-design.schema';

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

const DESIGN_PRESETS: Record<SlideDesignPreset, SlideDesign> = {
  dark: {
    preset: 'dark',
    background: '#0F172A',
    surface: '#1E293B',
    primary: '#38BDF8',
    secondary: '#818CF8',
    text: '#F8FAFC',
    muted: '#94A3B8',
    fontHeading: 'Inter',
    fontBody: 'Inter',
    radius: 'small',
    density: 'balanced',
    decoration: 'geometric',
  },
  light: {
    preset: 'light',
    background: '#FFFFFF',
    surface: '#F1F5F9',
    primary: '#0EA5E9',
    secondary: '#6366F1',
    text: '#0F172A',
    muted: '#64748B',
    fontHeading: 'Inter',
    fontBody: 'Inter',
    radius: 'small',
    density: 'balanced',
    decoration: 'minimal',
  },
  editorial: {
    preset: 'editorial',
    background: '#FDFBF7',
    surface: '#F5EFE6',
    primary: '#B45309',
    secondary: '#44403C',
    text: '#1C1917',
    muted: '#78716C',
    fontHeading: 'Georgia',
    fontBody: 'Inter',
    radius: 'none',
    density: 'airy',
    decoration: 'editorial',
  },
  academic: {
    preset: 'academic',
    background: '#FFFFFF',
    surface: '#EFF6FF',
    primary: '#1D4ED8',
    secondary: '#0F766E',
    text: '#111827',
    muted: '#6B7280',
    fontHeading: 'Times New Roman',
    fontBody: 'Arial',
    radius: 'none',
    density: 'dense',
    decoration: 'minimal',
  },
  technical: {
    preset: 'technical',
    background: '#020617',
    surface: '#0F172A',
    primary: '#22D3EE',
    secondary: '#A78BFA',
    text: '#E2E8F0',
    muted: '#94A3B8',
    fontHeading: 'Inter',
    fontBody: 'Inter',
    radius: 'large',
    density: 'dense',
    decoration: 'diagrammatic',
  },
  warm: {
    preset: 'warm',
    background: '#FFF7ED',
    surface: '#FFEDD5',
    primary: '#EA580C',
    secondary: '#DB2777',
    text: '#431407',
    muted: '#9A3412',
    fontHeading: 'Georgia',
    fontBody: 'Inter',
    radius: 'large',
    density: 'balanced',
    decoration: 'geometric',
  },
};

export const SLIDES_PRESET_IDS = Object.keys(
  DESIGN_PRESETS,
) as SlideDesignPreset[];

export function presetForThemeName(
  theme: string | undefined,
): SlideDesignPreset {
  switch (theme) {
    case 'light':
      return 'light';
    case 'accent':
      return 'warm';
    case 'editorial':
      return 'editorial';
    case 'academic':
      return 'academic';
    case 'technical':
      return 'technical';
    case 'warm':
      return 'warm';
    case 'dark':
    default:
      return 'dark';
  }
}

export function designForPreset(preset: SlideDesignPreset): SlideDesign {
  return { ...DESIGN_PRESETS[preset] };
}

const VALID_ROLES: ReadonlySet<string> = new Set([
  'title',
  'section',
  'content',
  'comparison',
  'timeline',
  'process',
  'statistic',
  'quote',
  'cards',
  'takeaways',
  'closing',
]);

const VALID_ELEMENT_TYPES: ReadonlySet<string> = new Set([
  'text',
  'bullet-list',
  'card-group',
  'comparison',
  'timeline',
  'process',
  'statistic',
  'quote',
  'shape',
]);

const VALID_SHAPES: ReadonlySet<string> = new Set([
  'accent-bar',
  'dots',
  'ring',
  'grid',
  'wave',
]);

const MAX_SLIDES = 20;
const MAX_ELEMENTS_PER_SLIDE = 6;
const MAX_ELEMENTS_PER_DECK = 120;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function clampText(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}

function cleanHex(value: unknown): string | undefined {
  return typeof value === 'string' && HEX_RE.test(value) ? value : undefined;
}

function cleanFont(value: unknown): SupportedFont {
  if (
    typeof value === 'string' &&
    (SUPPORTED_FONTS as readonly string[]).includes(value)
  ) {
    return value as SupportedFont;
  }
  return FALLBACK_FONT;
}

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const channel = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function bestTextOn(background: string): string {
  const black = contrastRatio('#111827', background);
  const white = contrastRatio('#F8FAFC', background);
  return white >= black ? '#F8FAFC' : '#111827';
}

/** Resolve a (possibly AI-proposed) design into complete, safe tokens. */
export function resolveDesign(input: unknown): SlideDesign {
  const record = isRecord(input) ? input : {};
  const presetName =
    typeof record.preset === 'string' && record.preset in DESIGN_PRESETS
      ? (record.preset as SlideDesignPreset)
      : undefined;
  // Legacy `theme: 'dark' | 'light' | 'accent'` maps onto presets.
  const legacyTheme =
    typeof record.theme === 'string'
      ? presetForThemeName(record.theme)
      : undefined;
  const base = designForPreset(presetName ?? legacyTheme ?? 'dark');

  const pick = (key: keyof SlideDesign): string | undefined => {
    const v = record[key];
    // Legacy decks use `accent` for the primary color.
    if (key === 'primary' && !cleanHex(v) && cleanHex(record.accent)) {
      return cleanHex(record.accent);
    }
    return cleanHex(v);
  };

  const design: SlideDesign = {
    preset: presetName ?? legacyTheme ?? base.preset,
    background: pick('background') ?? base.background,
    surface: pick('surface') ?? base.surface,
    primary: pick('primary') ?? base.primary,
    secondary: pick('secondary') ?? base.secondary,
    text: pick('text') ?? base.text,
    muted: pick('muted') ?? base.muted,
    fontHeading: cleanFont(record.fontHeading),
    fontBody: cleanFont(record.fontBody),
    radius:
      record.radius === 'none' ||
      record.radius === 'small' ||
      record.radius === 'large' ||
      record.radius === 'pill'
        ? record.radius
        : base.radius,
    density:
      record.density === 'airy' ||
      record.density === 'balanced' ||
      record.density === 'dense'
        ? record.density
        : base.density,
    decoration:
      record.decoration === 'minimal' ||
      record.decoration === 'geometric' ||
      record.decoration === 'editorial' ||
      record.decoration === 'diagrammatic'
        ? record.decoration
        : base.decoration,
  };

  // Preserve preset fonts when the AI did not propose explicit fonts.
  if (!isRecord(input) || input.fontHeading === undefined) {
    design.fontHeading = base.fontHeading;
  }
  if (!isRecord(input) || input.fontBody === undefined) {
    design.fontBody = base.fontBody;
  }

  // Contrast safety: text must remain readable on the background.
  if (contrastRatio(design.text, design.background) < 3) {
    design.text = bestTextOn(design.background);
  }
  if (contrastRatio(design.muted, design.background) < 2.2) {
    design.muted = design.text === '#F8FAFC' ? '#CBD5E1' : '#475569';
    if (contrastRatio(design.muted, design.background) < 2.2) {
      design.muted = bestTextOn(design.background);
    }
  }
  return design;
}

function cleanPosition(
  value: unknown,
): SlideElement extends never
  ? never
  : { x: number; y: number; w: number; h: number } | undefined {
  if (!isRecord(value)) return undefined;
  const { x, y, w, h } = value;
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof w !== 'number' ||
    typeof h !== 'number' ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(w) ||
    !Number.isFinite(h) ||
    w <= 0 ||
    h <= 0
  ) {
    return undefined;
  }
  // Clamp to the 1280x720 canvas; drop positions entirely outside.
  const cx = Math.min(1280, Math.max(0, x));
  const cy = Math.min(720, Math.max(0, y));
  const cw = Math.min(1280 - cx, Math.max(1, w));
  const ch = Math.min(720 - cy, Math.max(1, h));
  if (cw <= 0 || ch <= 0) return undefined;
  return { x: cx, y: cy, w: cw, h: ch };
}

function resolveElement(value: unknown): SlideElement | null {
  if (!isRecord(value)) return null;
  const type = toString(value.type);
  if (!VALID_ELEMENT_TYPES.has(type)) return null;

  switch (type) {
    case 'text': {
      const text = clampText(toString(value.text).trim(), 2000);
      if (!text) return null;
      const style = isRecord(value.style) ? value.style : {};
      const variant =
        style.variant === 'heading' ||
        style.variant === 'body' ||
        style.variant === 'caption'
          ? style.variant
          : undefined;
      const align = style.align === 'center' ? 'center' : undefined;
      const position = cleanPosition(value.position);
      return {
        type: 'text',
        text,
        ...(variant || align
          ? {
              style: {
                ...(variant ? { variant } : {}),
                ...(align ? { align } : {}),
              },
            }
          : {}),
        ...(position ? { position } : {}),
      };
    }
    case 'bullet-list': {
      const raw = Array.isArray(value.items) ? value.items : [];
      const items = raw
        .map((item) => clampText(toString(item).trim(), 500))
        .filter((item) => item.length > 0)
        .slice(0, 6);
      if (items.length === 0) return null;
      const style = isRecord(value.style) ? value.style : {};
      const columns = style.columns === 2 ? 2 : undefined;
      const position = cleanPosition(value.position);
      return {
        type: 'bullet-list',
        items,
        ...(columns ? { style: { columns } } : {}),
        ...(position ? { position } : {}),
      };
    }
    case 'card-group': {
      const raw = Array.isArray(value.cards) ? value.cards : [];
      const cards = raw
        .map((card) => {
          if (!isRecord(card)) return null;
          const title = clampText(
            toString(card.title ?? card.heading).trim(),
            200,
          );
          if (!title) return null;
          const body = toString(card.body ?? card.text ?? '').trim();
          return { title, ...(body ? { body: clampText(body, 500) } : {}) };
        })
        .filter(
          (card): card is { title: string; body?: string } => card !== null,
        )
        .slice(0, 6);
      if (cards.length === 0) return null;
      const columns =
        value.columns === 3 ? 3 : value.columns === 2 ? 2 : undefined;
      return { type: 'card-group', cards, ...(columns ? { columns } : {}) };
    }
    case 'comparison': {
      const cleanColumn = (column: unknown) => {
        if (!isRecord(column)) return null;
        const heading = clampText(
          toString(column.heading ?? column.title).trim(),
          200,
        );
        const raw = Array.isArray(column.points)
          ? column.points
          : Array.isArray(column.items)
            ? column.items
            : [];
        const points = raw
          .map((point) => clampText(toString(point).trim(), 500))
          .filter((point) => point.length > 0)
          .slice(0, 6);
        if (!heading || points.length === 0) return null;
        return { heading, points };
      };
      const left = cleanColumn(value.left);
      const right = cleanColumn(value.right);
      if (!left || !right) return null;
      return { type: 'comparison', left, right };
    }
    case 'timeline':
    case 'process': {
      const raw = Array.isArray(value.steps) ? value.steps : [];
      const steps = raw
        .map((step) => {
          if (!isRecord(step)) {
            const title = clampText(toString(step).trim(), 200);
            return title ? { title } : null;
          }
          const title = clampText(
            toString(step.title ?? step.heading ?? step.label).trim(),
            200,
          );
          if (!title) return null;
          const body = toString(step.body ?? step.text ?? '').trim();
          return { title, ...(body ? { body: clampText(body, 500) } : {}) };
        })
        .filter(
          (step): step is { title: string; body?: string } => step !== null,
        )
        .slice(0, 6);
      if (steps.length < 2) return null;
      return type === 'timeline'
        ? { type: 'timeline', steps }
        : { type: 'process', steps };
    }
    case 'statistic': {
      const val = clampText(toString(value.value).trim(), 60);
      const label = clampText(toString(value.label).trim(), 200);
      if (!val || !label) return null;
      const context = toString(value.context ?? '').trim();
      return {
        type: 'statistic',
        value: val,
        label,
        ...(context ? { context: clampText(context, 500) } : {}),
      };
    }
    case 'quote': {
      const quote = clampText(toString(value.quote ?? value.text).trim(), 1000);
      if (!quote) return null;
      const attribution = toString(
        value.attribution ?? value.author ?? '',
      ).trim();
      return {
        type: 'quote',
        quote,
        ...(attribution ? { attribution: clampText(attribution, 200) } : {}),
      };
    }
    case 'shape': {
      const variant = toString(value.variant);
      if (!VALID_SHAPES.has(variant)) return null;
      const emphasis =
        value.emphasis === 'secondary' || value.emphasis === 'muted'
          ? value.emphasis
          : undefined;
      return {
        type: 'shape',
        variant: variant as import('./slides-design.types').ShapeVariant,
        ...(emphasis ? { emphasis } : {}),
      };
    }
    default:
      return null;
  }
}

/** Convert a legacy prose slide into a structured scene. */
export function legacySlideToScene(
  slide: LegacySlidesSlide,
  index: number,
): SlideScene {
  const id = slide.id && slide.id.trim() ? slide.id : `slide-${index + 1}`;
  const title = clampText(
    (slide.title || `Slide ${index + 1}`).trim() || `Slide ${index + 1}`,
    200,
  );
  const subtitle = slide.subtitle?.trim()
    ? clampText(slide.subtitle.trim(), 500)
    : undefined;
  const speakerNotes = slide.notes?.trim()
    ? clampText(slide.notes.trim(), 2000)
    : undefined;
  const bullets = (slide.bullets ?? [])
    .map((bullet) => bullet.trim())
    .filter((bullet) => bullet.length > 0)
    .slice(0, 6)
    .map((bullet) => clampText(bullet, 500));
  const body = slide.body?.trim()
    ? clampText(slide.body.trim(), 2000)
    : undefined;

  const roleForLayout = (layout: LegacySlidesSlide['layout']): SlideRole => {
    switch (layout) {
      case 'title':
        return 'title';
      case 'quote':
        return 'quote';
      case 'closing':
        return 'closing';
      case 'two-column':
        return 'content';
      case 'title-bullets':
      default:
        return 'content';
    }
  };

  const twoColumn = slide.layout === 'two-column';
  const elements: SlideElement[] = [];

  if (slide.layout === 'quote') {
    elements.push({
      type: 'quote',
      quote: clampText(body || bullets[0] || title, 1000),
      ...(subtitle ? { attribution: subtitle } : {}),
    });
    if (bullets.length > 1) {
      elements.push({ type: 'bullet-list', items: bullets.slice(1) });
    } else if (bullets.length === 1 && body) {
      elements.push({ type: 'bullet-list', items: bullets });
    }
  } else {
    if (bullets.length > 0) {
      elements.push({
        type: 'bullet-list',
        items: bullets,
        ...(twoColumn ? { style: { columns: 2 as const } } : {}),
      });
    }
    if (body) {
      elements.push({
        type: 'text',
        text: body,
        style: { variant: 'body' as const },
      });
    }
    if (
      elements.length === 0 &&
      subtitle &&
      roleForLayout(slide.layout) === 'content'
    ) {
      elements.push({
        type: 'text',
        text: subtitle,
        style: { variant: 'body' as const },
      });
    }
  }

  return {
    id,
    role: roleForLayout(slide.layout),
    title,
    ...(subtitle ? { subtitle } : {}),
    ...(speakerNotes ? { speakerNotes } : {}),
    elements: elements.slice(0, MAX_ELEMENTS_PER_SLIDE),
  };
}

function resolveScene(value: unknown, index: number): SlideScene | null {
  if (!isRecord(value)) {
    return {
      id: `slide-${index + 1}`,
      role: index === 0 ? 'title' : 'content',
      title: `Slide ${index + 1}`,
      elements: [{ type: 'text', text: `Slide ${index + 1}` }],
    };
  }
  const id = toString(value.id).trim() || `slide-${index + 1}`;
  const rawRole = toString(value.role || value.layout).trim();
  const role: SlideRole = VALID_ROLES.has(rawRole)
    ? (rawRole as SlideRole)
    : index === 0
      ? 'title'
      : 'content';
  const title = clampText(
    toString(value.title ?? value.heading ?? `Slide ${index + 1}`).trim() ||
      `Slide ${index + 1}`,
    200,
  );
  const subtitleRaw = toString(value.subtitle ?? '').trim();
  const subtitle = subtitleRaw ? clampText(subtitleRaw, 500) : undefined;
  const notesRaw = toString(value.speakerNotes ?? value.notes ?? '').trim();
  const speakerNotes = notesRaw ? clampText(notesRaw, 2000) : undefined;

  const rawElements = Array.isArray(value.elements) ? value.elements : [];
  let elements = rawElements
    .map((element) => resolveElement(element))
    .filter((element): element is SlideElement => element !== null)
    .slice(0, MAX_ELEMENTS_PER_SLIDE);

  // Bridge legacy prose fields inside a structured-looking slide.
  if (elements.length === 0) {
    const bullets = (Array.isArray(value.bullets) ? value.bullets : [])
      .map((bullet) => clampText(toString(bullet).trim(), 500))
      .filter((bullet) => bullet.length > 0)
      .slice(0, 6);
    const body = toString(value.body ?? '').trim();
    if (role === 'quote') {
      const quoteText = clampText(body || bullets[0] || title, 1000);
      elements = [
        {
          type: 'quote',
          quote: quoteText,
          ...(subtitle ? { attribution: subtitle } : {}),
        },
      ];
      if (bullets.length > 1) {
        elements.push({ type: 'bullet-list', items: bullets.slice(1) });
      }
    } else {
      if (bullets.length > 0)
        elements.push({ type: 'bullet-list', items: bullets });
      if (body)
        elements.push({
          type: 'text',
          text: clampText(body, 2000),
          style: { variant: 'body' },
        });
    }
  }

  // Partially-valid scene: drop invalid elements, keep safe text fallback.
  if (elements.length === 0) {
    const fallback = subtitle ? `${title}. ${subtitle}` : title;
    elements = [{ type: 'text', text: clampText(fallback, 2000) }];
  }

  return {
    id,
    role,
    title,
    ...(subtitle ? { subtitle } : {}),
    ...(speakerNotes ? { speakerNotes } : {}),
    elements,
  };
}

function applyRoleRules(scenes: SlideScene[]): SlideScene[] {
  if (scenes.length === 0) return scenes;
  const next = scenes.map((scene) => ({
    ...scene,
    elements: [...scene.elements],
  }));

  // First slide must be `title`.
  next[0] = { ...next[0], role: 'title' };

  // Final slide must be `closing` or `takeaways` (single-slide decks stay `title`).
  if (next.length > 1) {
    const last = next[next.length - 1];
    if (last.role !== 'closing' && last.role !== 'takeaways') {
      next[next.length - 1] = { ...last, role: 'closing' };
    }
  }

  // No more than two consecutive `content` slides: the third becomes `cards`.
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

  // `section` slides clarify major transitions: cap at 3, extras become `content`.
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

/**
 * Accept new structured AI output, legacy slide output, or malformed partial
 * output and always return a complete, validated deck (or throw only when
 * nothing renderable remains).
 */
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
    // Legacy deck: convert prose slides into scenes.
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

  // Enforce deck-level element budget deterministically (trim trailing elements).
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

  // Deduplicate IDs deterministically.
  const seen = new Set<string>();
  scenes = scenes.map((scene, index) => {
    let id = scene.id.trim() || `slide-${index + 1}`;
    if (seen.has(id)) {
      id = `${id}-${index + 1}`;
    }
    seen.add(id);
    return { ...scene, id };
  });

  return { schemaVersion: 2, title, design, slides: scenes };
}

export function resolveSlideDeckPreservingPreviews(input: unknown): SlideDeck {
  const deck = resolveSlideDeck(input);
  const record = isRecord(input) ? input : {};
  if (Array.isArray(record.previews)) {
    return { ...deck, previews: record.previews as SlideDeck['previews'] };
  }
  return deck;
}

export {
  DESIGN_PRESETS,
  MAX_ELEMENTS_PER_DECK,
  MAX_ELEMENTS_PER_SLIDE,
  MAX_SLIDES,
};
