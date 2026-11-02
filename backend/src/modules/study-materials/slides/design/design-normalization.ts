import type {
  ShapeVariant,
  SlideElement,
  SlideRole,
  SlideScene,
} from '../slides-design.types';
import {
  clampText,
  isRecord,
  toString,
  MAX_ELEMENTS_PER_SLIDE,
} from './design-values';

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
        variant: variant as ShapeVariant,
        ...(emphasis ? { emphasis } : {}),
      };
    }
    default:
      return null;
  }
}

export function resolveScene(value: unknown, index: number): SlideScene | null {
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
