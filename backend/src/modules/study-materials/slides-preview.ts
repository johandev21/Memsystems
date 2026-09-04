import { resolveSlideDeck } from './slides-design-resolver';
import type {
  ShapeVariant,
  SlideDeck,
  SlideDesign,
  SlideElement,
  SlideScene,
} from './slides-design.types';

const WIDTH = 1280;
const HEIGHT = 720;

// Bottom edge of the usable content region. Everything text-related must be
// laid out above this so nothing spills past the viewBox and gets clipped by
// the <img> viewport in the frontend.
const CONTENT_BOTTOM = 656;

type DeckSlide = {
  id: string;
  layout?: string;
  title: string;
  subtitle?: string;
  bullets?: string[];
  body?: string;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

/**
 * Greedy word-wrap. SVG <text> never wraps on its own, so every string must
 * be split into lines that fit the available pixel width (approximated via a
 * per-line char budget) before rendering.
 */
function wrapWords(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (word.length > maxChars) {
      if (current) {
        lines.push(current);
        current = '';
      }
      for (let i = 0; i < word.length; i += maxChars) {
        lines.push(word.slice(i, i + maxChars));
      }
      continue;
    }
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Wrap then cap the line count, ellipsizing the last visible line. */
function fitLines(text: string, maxChars: number, maxLines: number): string[] {
  const wrapped = wrapWords(text, maxChars);
  if (wrapped.length <= maxLines) return wrapped;
  const lines = wrapped.slice(0, maxLines);
  lines[maxLines - 1] = `${truncate(lines[maxLines - 1], maxChars)}`;
  return lines;
}

export type LegacyPreviewTheme = {
  background: string;
  accent: string;
  text: string;
  muted: string;
};

type Theme = LegacyPreviewTheme;

/** Map a supported font name to an SVG font-family stack. */
function fontFamilyFor(
  font: string | undefined,
  kind: 'heading' | 'body',
): string {
  switch (font) {
    case 'Georgia':
      return 'Georgia,serif';
    case 'Times New Roman':
      return "'Times New Roman',Times,serif";
    case 'Helvetica':
      return 'Helvetica,Arial,sans-serif';
    case 'Verdana':
      return 'Verdana,Geneva,sans-serif';
    case 'Arial':
      return 'Arial,Helvetica,sans-serif';
    case 'Inter':
    default:
      return kind === 'heading'
        ? 'Inter,Arial,sans-serif'
        : 'Inter,Arial,sans-serif';
  }
}

function designTokens(design: SlideDesign) {
  const density = design.density ?? 'balanced';
  return {
    titleSize: density === 'airy' ? 54 : density === 'dense' ? 44 : 50,
    titleLine: density === 'airy' ? 64 : density === 'dense' ? 54 : 60,
    bodySize: density === 'airy' ? 26 : density === 'dense' ? 22 : 25,
    bodyLine: density === 'airy' ? 34 : density === 'dense' ? 29 : 32,
    gap: density === 'airy' ? 20 : density === 'dense' ? 10 : 14,
    headingFont: fontFamilyFor(design.fontHeading, 'heading'),
    bodyFont: fontFamilyFor(design.fontBody, 'body'),
    radius:
      design.radius === 'none'
        ? 0
        : design.radius === 'large' || design.radius === 'pill'
          ? 20
          : 10,
  };
}

function textBlock(options: {
  x: number;
  y: number;
  lines: string[];
  fontSize: number;
  lineHeight: number;
  fill: string;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  anchor?: 'start' | 'middle';
}): string {
  const {
    x,
    y,
    lines,
    fontSize,
    lineHeight,
    fill,
    fontFamily = 'Inter,Arial,sans-serif',
    bold = false,
    italic = false,
    anchor = 'start',
  } = options;
  const tspans = lines
    .map(
      (line, i) =>
        `<tspan x="${x}" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join('');
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${escapeXml(fontFamily)}" font-size="${fontSize}"${bold ? ' font-weight="700"' : ''}${italic ? ' font-style="italic"' : ''} fill="${fill}">${tspans}</text>`;
}

function bulletBlock(options: {
  bullets: string[];
  x: number;
  y: number;
  maxChars: number;
  fontSize: number;
  lineHeight: number;
  gap: number;
  fill: string;
  dotFill: string;
  maxBullets: number;
  maxLinesPerBullet: number;
  maxY: number;
  anchor?: 'start' | 'middle';
}): { svg: string; nextY: number } {
  const {
    bullets,
    x,
    y,
    maxChars,
    fontSize,
    lineHeight,
    gap,
    fill,
    dotFill,
    maxBullets,
    maxLinesPerBullet,
    maxY,
    anchor = 'start',
  } = options;
  let cursor = y;
  let svg = '';
  for (const bullet of bullets.slice(0, maxBullets)) {
    const lines = fitLines(bullet, maxChars, maxLinesPerBullet);
    const blockHeight = lines.length * lineHeight + gap;
    if (cursor + blockHeight - gap > maxY) break;
    if (anchor === 'middle') {
      const prefixed =
        lines.length > 0 ? [`• ${lines[0]}`, ...lines.slice(1)] : lines;
      svg += textBlock({
        x,
        y: cursor,
        lines: prefixed,
        fontSize,
        lineHeight,
        fill,
        anchor: 'middle',
      });
    } else {
      const dotCy = cursor - Math.round(fontSize * 0.35);
      svg += `<circle cx="${x}" cy="${dotCy}" r="7" fill="${dotFill}"/>`;
      svg += textBlock({
        x: x + 25,
        y: cursor,
        lines,
        fontSize,
        lineHeight,
        fill,
      });
    }
    cursor += blockHeight;
  }
  return { svg, nextY: cursor };
}

// ---------------------------------------------------------------------------
// Legacy prose renderer (kept for legacy slides until migration completes).
// ---------------------------------------------------------------------------

function renderTitleClosing(slide: DeckSlide, theme: Theme): string {
  const titleLines = fitLines(slide.title || 'Slide', 30, 2);
  const subtitleLines = slide.subtitle ? fitLines(slide.subtitle, 58, 2) : [];
  const titleHeight = titleLines.length * 70;
  const subtitleHeight = subtitleLines.length * 38;
  const bullets = (slide.bullets ?? []).slice(0, 4);
  const bulletHeight = bullets.length > 0 ? bullets.length * (2 * 34 + 14) : 0;
  const bodyLines =
    bullets.length === 0 && slide.body ? fitLines(slide.body, 62, 3) : [];
  const bodyHeight = bodyLines.length * 34;
  const total = titleHeight + subtitleHeight + bulletHeight + bodyHeight + 120;
  let cursor = Math.max(250, Math.round(360 - total / 2) + 60);

  let svg = textBlock({
    x: 640,
    y: cursor,
    lines: titleLines,
    fontSize: 60,
    lineHeight: 70,
    fill: theme.text,
    bold: true,
    anchor: 'middle',
  });
  cursor += titleHeight + 26;

  if (subtitleLines.length > 0) {
    svg += textBlock({
      x: 640,
      y: cursor,
      lines: subtitleLines,
      fontSize: 28,
      lineHeight: 38,
      fill: theme.muted,
      anchor: 'middle',
    });
    cursor += subtitleHeight + 30;
  } else {
    cursor += 10;
  }

  if (bullets.length > 0) {
    const block = bulletBlock({
      bullets,
      x: 640,
      y: cursor,
      maxChars: 54,
      fontSize: 25,
      lineHeight: 34,
      gap: 14,
      fill: theme.text,
      dotFill: theme.accent,
      maxBullets: 4,
      maxLinesPerBullet: 2,
      maxY: CONTENT_BOTTOM,
      anchor: 'middle',
    });
    svg += block.svg;
    cursor = block.nextY;
  } else if (bodyLines.length > 0) {
    svg += textBlock({
      x: 640,
      y: cursor,
      lines: bodyLines,
      fontSize: 25,
      lineHeight: 34,
      fill: theme.text,
      anchor: 'middle',
    });
    cursor += bodyHeight;
  }
  return svg;
}

function renderQuote(slide: DeckSlide, index: number, theme: Theme): string {
  void index;
  const titleLines = fitLines(slide.title || 'Slide', 34, 4);
  const bodyLines = slide.body ? fitLines(slide.body, 58, 3) : [];
  const subtitleLines = slide.subtitle ? fitLines(slide.subtitle, 58, 2) : [];
  let svg = `<rect x="120" y="180" width="8" height="360" rx="4" fill="${theme.accent}"/>`;
  let cursor = 290;
  svg += textBlock({
    x: 170,
    y: cursor,
    lines: titleLines,
    fontSize: 40,
    lineHeight: 50,
    fill: theme.text,
    fontFamily: 'Georgia,serif',
    italic: true,
  });
  cursor += titleLines.length * 50 + 24;
  if (bodyLines.length > 0 && cursor < CONTENT_BOTTOM) {
    const visible = bodyLines.slice(
      0,
      Math.max(0, Math.floor((CONTENT_BOTTOM - cursor) / 36)),
    );
    if (visible.length > 0) {
      svg += textBlock({
        x: 170,
        y: cursor,
        lines: visible,
        fontSize: 26,
        lineHeight: 36,
        fill: theme.muted,
      });
      cursor += visible.length * 36 + 20;
    }
  }
  if (subtitleLines.length > 0 && cursor < CONTENT_BOTTOM) {
    svg += textBlock({
      x: 170,
      y: cursor,
      lines: subtitleLines.slice(0, 2),
      fontSize: 24,
      lineHeight: 32,
      fill: theme.accent,
    });
  }
  return svg;
}

function renderBullets(
  slide: DeckSlide,
  theme: Theme,
  twoColumn: boolean,
): string {
  const titleLines = fitLines(slide.title || 'Slide', 40, 2);
  const subtitleLines = slide.subtitle ? fitLines(slide.subtitle, 62, 2) : [];
  let svg = textBlock({
    x: 120,
    y: 168,
    lines: titleLines,
    fontSize: 50,
    lineHeight: 60,
    fill: theme.text,
    bold: true,
  });
  let cursor = 168 + titleLines.length * 60 + 8;
  if (subtitleLines.length > 0) {
    svg += textBlock({
      x: 120,
      y: cursor,
      lines: subtitleLines,
      fontSize: 26,
      lineHeight: 34,
      fill: theme.muted,
    });
    cursor += subtitleLines.length * 34 + 14;
  }
  svg += `<rect x="120" y="${cursor}" width="120" height="6" rx="3" fill="${theme.accent}"/>`;
  cursor += 48;

  const bullets = (slide.bullets ?? []).slice(0, twoColumn ? 6 : 5);
  if (twoColumn) {
    const mid = Math.ceil(bullets.length / 2);
    const left = bulletBlock({
      bullets: bullets.slice(0, mid),
      x: 130,
      y: cursor,
      maxChars: 27,
      fontSize: 25,
      lineHeight: 32,
      gap: 12,
      fill: theme.text,
      dotFill: theme.accent,
      maxBullets: 3,
      maxLinesPerBullet: 2,
      maxY: CONTENT_BOTTOM,
    });
    const right = bulletBlock({
      bullets: bullets.slice(mid),
      x: 680,
      y: cursor,
      maxChars: 27,
      fontSize: 25,
      lineHeight: 32,
      gap: 12,
      fill: theme.text,
      dotFill: theme.accent,
      maxBullets: 3,
      maxLinesPerBullet: 2,
      maxY: CONTENT_BOTTOM,
    });
    svg += left.svg + right.svg;
  } else {
    const block = bulletBlock({
      bullets,
      x: 130,
      y: cursor,
      maxChars: 58,
      fontSize: 26,
      lineHeight: 33,
      gap: 12,
      fill: theme.text,
      dotFill: theme.accent,
      maxBullets: 5,
      maxLinesPerBullet: 2,
      maxY: slide.body ? CONTENT_BOTTOM - 44 : CONTENT_BOTTOM,
    });
    svg += block.svg;
    cursor = block.nextY;
    if (slide.body && cursor < CONTENT_BOTTOM) {
      const bodyLines = fitLines(slide.body, 66, 2).slice(
        0,
        Math.max(0, Math.floor((CONTENT_BOTTOM - cursor) / 30)),
      );
      if (bodyLines.length > 0) {
        svg += textBlock({
          x: 120,
          y: cursor + 8,
          lines: bodyLines,
          fontSize: 22,
          lineHeight: 30,
          fill: theme.muted,
        });
      }
    }
  }
  return svg;
}

function renderLegacySlide(
  slide: DeckSlide,
  index: number,
  theme: Theme,
): string {
  const layout = slide.layout ?? 'title-bullets';
  if (layout === 'title' || layout === 'closing') {
    return renderTitleClosing(slide, theme);
  }
  if (layout === 'quote') {
    return renderQuote(slide, index, theme);
  }
  return renderBullets(slide, theme, layout === 'two-column');
}

// ---------------------------------------------------------------------------
// Structured scene renderer.
// ---------------------------------------------------------------------------

const ROLE_EYEBROW: Partial<Record<SlideScene['role'], string>> = {
  section: 'Section',
  comparison: 'Comparison',
  timeline: 'Timeline',
  process: 'Process',
  statistic: 'Key Figure',
  cards: 'Key Points',
  takeaways: 'Takeaways',
  closing: 'Closing',
};

const CENTERED_ROLES: ReadonlySet<string> = new Set([
  'title',
  'section',
  'closing',
]);

function isSlideDesign(value: Theme | SlideDesign): value is SlideDesign {
  return (
    typeof value === 'object' &&
    value !== null &&
    'primary' in value &&
    'surface' in value
  );
}

function isSceneSlide(value: DeckSlide | SlideScene): value is SlideScene {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('role' in value || 'elements' in value)
  );
}

function decorationSvg(design: SlideDesign): string {
  const primary = design.primary;
  const secondary = design.secondary;
  switch (design.decoration) {
    case 'geometric':
      return (
        `<circle cx="1170" cy="140" r="90" fill="${primary}" opacity="0.10"/>` +
        `<circle cx="1100" cy="620" r="55" fill="${secondary}" opacity="0.12"/>` +
        `<rect x="80" y="600" width="140" height="10" rx="5" fill="${primary}" opacity="0.25"/>`
      );
    case 'editorial':
      return (
        `<rect x="120" y="120" width="60" height="6" rx="3" fill="${primary}"/>` +
        `<rect x="120" y="640" width="1040" height="2" fill="${secondary}" opacity="0.35"/>`
      );
    case 'diagrammatic': {
      let dots = '';
      for (let x = 100; x <= 1180; x += 60) {
        dots += `<circle cx="${x}" cy="640" r="2.5" fill="${secondary}" opacity="0.4"/>`;
      }
      return (
        dots +
        `<rect x="1080" y="120" width="80" height="80" rx="8" fill="none" stroke="${primary}" stroke-width="2" opacity="0.35"/>` +
        `<circle cx="1120" cy="160" r="6" fill="${primary}" opacity="0.6"/>`
      );
    }
    case 'minimal':
    default:
      return `<rect x="120" y="640" width="72" height="6" rx="3" fill="${primary}" opacity="0.7"/>`;
  }
}

function shapeSvg(
  variant: ShapeVariant,
  emphasis: string | undefined,
  design: SlideDesign,
  x: number,
  y: number,
  width: number,
): { svg: string; height: number } {
  const color =
    emphasis === 'secondary'
      ? design.secondary
      : emphasis === 'muted'
        ? design.muted
        : design.primary;
  switch (variant) {
    case 'accent-bar':
      return {
        svg: `<rect x="${x}" y="${y}" width="120" height="6" rx="3" fill="${color}"/>`,
        height: 18,
      };
    case 'dots': {
      let dots = '';
      for (let i = 0; i < Math.min(12, Math.floor(width / 24)); i++) {
        dots += `<circle cx="${x + i * 24}" cy="${y}" r="5" fill="${color}" opacity="0.7"/>`;
      }
      return { svg: dots, height: 22 };
    }
    case 'ring':
      return {
        svg: `<circle cx="${x + 20}" cy="${y + 10}" r="16" fill="none" stroke="${color}" stroke-width="5"/>`,
        height: 44,
      };
    case 'grid': {
      let lines = '';
      for (let i = 0; i < 4; i++) {
        lines += `<rect x="${x}" y="${y + i * 10}" width="${Math.min(width, 220)}" height="3" rx="1.5" fill="${color}" opacity="${0.5 - i * 0.1}"/>`;
      }
      return { svg: lines, height: 52 };
    }
    case 'wave':
      return {
        svg: `<path d="M ${x} ${y + 12} Q ${x + 60} ${y - 8} ${x + 120} ${y + 12} T ${x + 240} ${y + 12}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round"/>`,
        height: 40,
      };
    default:
      return { svg: '', height: 0 };
  }
}

type ElementContext = {
  tokens: ReturnType<typeof designTokens>;
  design: SlideDesign;
  maxY: number;
};

function renderTextElement(
  text: string,
  style: { variant?: string; align?: string } | undefined,
  ctx: ElementContext,
  x: number,
  y: number,
  width: number,
): { svg: string; nextY: number } {
  const variant = style?.variant ?? 'body';
  const center = style?.align === 'center';
  const fontSize =
    variant === 'heading'
      ? ctx.tokens.titleSize - 12
      : variant === 'caption'
        ? 20
        : ctx.tokens.bodySize;
  const lineHeight = Math.round(fontSize * 1.32);
  const maxChars = Math.max(20, Math.floor(width / (fontSize * 0.52)));
  const lines = fitLines(text, maxChars, 4);
  const blockHeight = lines.length * lineHeight + ctx.tokens.gap;
  if (y + blockHeight - ctx.tokens.gap > ctx.maxY) {
    return { svg: '', nextY: y };
  }
  const svg = textBlock({
    x: center ? x + width / 2 : x,
    y,
    lines,
    fontSize,
    lineHeight,
    fill: variant === 'caption' ? ctx.design.muted : ctx.design.text,
    fontFamily:
      variant === 'heading' ? ctx.tokens.headingFont : ctx.tokens.bodyFont,
    bold: variant === 'heading',
    italic: variant === 'caption',
    anchor: center ? 'middle' : 'start',
  });
  return { svg, nextY: y + blockHeight };
}

function renderBulletListElement(
  items: string[],
  columns: number | undefined,
  ctx: ElementContext,
  x: number,
  y: number,
  width: number,
  center: boolean,
): { svg: string; nextY: number } {
  if (columns === 2 && !center) {
    const mid = Math.ceil(items.length / 2);
    const colWidth = Math.floor(width / 2);
    const left = bulletBlock({
      bullets: items.slice(0, mid),
      x: x + 10,
      y,
      maxChars: Math.max(16, Math.floor(colWidth / 14)),
      fontSize: ctx.tokens.bodySize,
      lineHeight: ctx.tokens.bodyLine,
      gap: ctx.tokens.gap,
      fill: ctx.design.text,
      dotFill: ctx.design.primary,
      maxBullets: 3,
      maxLinesPerBullet: 2,
      maxY: ctx.maxY,
    });
    const right = bulletBlock({
      bullets: items.slice(mid),
      x: x + colWidth + 10,
      y,
      maxChars: Math.max(16, Math.floor(colWidth / 14)),
      fontSize: ctx.tokens.bodySize,
      lineHeight: ctx.tokens.bodyLine,
      gap: ctx.tokens.gap,
      fill: ctx.design.text,
      dotFill: ctx.design.primary,
      maxBullets: 3,
      maxLinesPerBullet: 2,
      maxY: ctx.maxY,
    });
    return {
      svg: left.svg + right.svg,
      nextY: Math.max(left.nextY, right.nextY),
    };
  }
  const block = bulletBlock({
    bullets: items,
    x: center ? x + width / 2 : x + 10,
    y,
    maxChars: Math.max(24, Math.floor(width / 13)),
    fontSize: ctx.tokens.bodySize,
    lineHeight: ctx.tokens.bodyLine,
    gap: ctx.tokens.gap,
    fill: ctx.design.text,
    dotFill: ctx.design.primary,
    maxBullets: 5,
    maxLinesPerBullet: 2,
    maxY: ctx.maxY,
    anchor: center ? 'middle' : 'start',
  });
  return { svg: block.svg, nextY: block.nextY };
}

function renderCardGroupElement(
  cards: { title: string; body?: string }[],
  columns: number | undefined,
  ctx: ElementContext,
  x: number,
  y: number,
  width: number,
): { svg: string; nextY: number } {
  const cols = columns ?? (cards.length <= 2 ? 2 : 3);
  const visible = cards.slice(0, 6);
  const gap = 20;
  const cardWidth = Math.floor((width - gap * (cols - 1)) / cols);
  const rows = Math.ceil(visible.length / cols);
  const cardHeight = 168;
  const totalHeight = rows * cardHeight + (rows - 1) * gap;
  if (y + totalHeight > ctx.maxY) {
    // Truncate to the rows that fit.
    const fittingRows = Math.max(
      0,
      Math.floor((ctx.maxY - y + gap) / (cardHeight + gap)),
    );
    if (fittingRows === 0) return { svg: '', nextY: y };
    return renderCardGroupElement(
      visible.slice(0, fittingRows * cols),
      columns,
      ctx,
      x,
      y,
      width,
    );
  }
  let svg = '';
  visible.forEach((card, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = x + col * (cardWidth + gap);
    const cy = y + row * (cardHeight + gap);
    const titleLines = fitLines(
      card.title,
      Math.max(12, Math.floor(cardWidth / 13)),
      2,
    );
    const bodyLines = card.body
      ? fitLines(card.body, Math.max(14, Math.floor(cardWidth / 11)), 3)
      : [];
    svg += `<rect x="${cx}" y="${cy}" width="${cardWidth}" height="${cardHeight}" rx="${ctx.tokens.radius}" fill="${ctx.design.surface}" stroke="${ctx.design.primary}" stroke-opacity="0.35" stroke-width="2"/>`;
    svg += `<rect x="${cx}" y="${cy}" width="${cardWidth}" height="8" rx="4" fill="${ctx.design.primary}"/>`;
    svg += textBlock({
      x: cx + 20,
      y: cy + 48,
      lines: titleLines,
      fontSize: 24,
      lineHeight: 30,
      fill: ctx.design.text,
      fontFamily: ctx.tokens.headingFont,
      bold: true,
    });
    if (bodyLines.length > 0) {
      svg += textBlock({
        x: cx + 20,
        y: cy + 48 + titleLines.length * 30 + 10,
        lines: bodyLines,
        fontSize: 20,
        lineHeight: 27,
        fill: ctx.design.muted,
        fontFamily: ctx.tokens.bodyFont,
      });
    }
  });
  return { svg, nextY: y + totalHeight + ctx.tokens.gap };
}

function renderComparisonElement(
  left: { heading: string; points: string[] },
  right: { heading: string; points: string[] },
  ctx: ElementContext,
  x: number,
  y: number,
  width: number,
): { svg: string; nextY: number } {
  const gap = 32;
  const colWidth = Math.floor((width - gap) / 2);
  const renderColumn = (
    heading: string,
    points: string[],
    cx: number,
    accent: string,
  ): { svg: string; nextY: number } => {
    const headingLines = fitLines(
      heading,
      Math.max(10, Math.floor(colWidth / 14)),
      2,
    );
    let svg = `<rect x="${cx}" y="${y}" width="64" height="6" rx="3" fill="${accent}"/>`;
    svg += textBlock({
      x: cx,
      y: y + 34,
      lines: headingLines,
      fontSize: 26,
      lineHeight: 32,
      fill: ctx.design.text,
      fontFamily: ctx.tokens.headingFont,
      bold: true,
    });
    const cursor = y + 34 + headingLines.length * 32 + 8;
    const block = bulletBlock({
      bullets: points,
      x: cx + 10,
      y: cursor,
      maxChars: Math.max(14, Math.floor(colWidth / 14)),
      fontSize: 22,
      lineHeight: 29,
      gap: 10,
      fill: ctx.design.text,
      dotFill: accent,
      maxBullets: 4,
      maxLinesPerBullet: 2,
      maxY: ctx.maxY,
    });
    return { svg: svg + block.svg, nextY: block.nextY };
  };
  const leftRendered = renderColumn(
    left.heading,
    left.points.slice(0, 4),
    x,
    ctx.design.primary,
  );
  const rightRendered = renderColumn(
    right.heading,
    right.points.slice(0, 4),
    x + colWidth + gap,
    ctx.design.secondary,
  );
  const dividerX = x + colWidth + gap / 2;
  const divider = `<rect x="${dividerX}" y="${y}" width="2" height="${Math.max(60, Math.min(320, Math.max(leftRendered.nextY, rightRendered.nextY) - y))}" fill="${ctx.design.muted}" opacity="0.4"/>`;
  return {
    svg: leftRendered.svg + divider + rightRendered.svg,
    nextY: Math.max(leftRendered.nextY, rightRendered.nextY),
  };
}

function renderTimelineElement(
  steps: { title: string; body?: string }[],
  ctx: ElementContext,
  x: number,
  y: number,
  width: number,
): { svg: string; nextY: number } {
  const visible = steps.slice(0, 6);
  const n = visible.length;
  if (n === 0) return { svg: '', nextY: y };
  const lineY = y + 14;
  let svg = `<rect x="${x}" y="${lineY - 3}" width="${width}" height="6" rx="3" fill="${ctx.design.primary}" opacity="0.5"/>`;
  const slot = width / n;
  let maxBottom = lineY;
  visible.forEach((step, i) => {
    const cx = Math.round(x + slot * i + slot / 2);
    svg += `<circle cx="${cx}" cy="${lineY}" r="13" fill="${ctx.design.primary}"/>`;
    svg += `<circle cx="${cx}" cy="${lineY}" r="5" fill="${ctx.design.background}"/>`;
    const charBudget = Math.max(10, Math.floor(slot / 13));
    const titleLines = fitLines(step.title, charBudget, 2);
    const bodyLines = step.body ? fitLines(step.body, charBudget + 4, 2) : [];
    svg += textBlock({
      x: cx,
      y: lineY + 36,
      lines: titleLines,
      fontSize: 22,
      lineHeight: 28,
      fill: ctx.design.text,
      fontFamily: ctx.tokens.headingFont,
      bold: true,
      anchor: 'middle',
    });
    let cursor = lineY + 36 + titleLines.length * 28;
    if (bodyLines.length > 0) {
      svg += textBlock({
        x: cx,
        y: cursor + 6,
        lines: bodyLines,
        fontSize: 19,
        lineHeight: 25,
        fill: ctx.design.muted,
        fontFamily: ctx.tokens.bodyFont,
        anchor: 'middle',
      });
      cursor += 6 + bodyLines.length * 25;
    }
    maxBottom = Math.max(maxBottom, cursor);
  });
  if (maxBottom > ctx.maxY) {
    return { svg: '', nextY: y };
  }
  return { svg, nextY: maxBottom + ctx.tokens.gap };
}

function renderProcessElement(
  steps: { title: string; body?: string }[],
  ctx: ElementContext,
  x: number,
  y: number,
  width: number,
): { svg: string; nextY: number } {
  const visible = steps.slice(0, 6);
  const n = visible.length;
  if (n === 0) return { svg: '', nextY: y };
  const slot = width / n;
  let svg = '';
  let maxBottom = y;
  visible.forEach((step, i) => {
    const cx = Math.round(x + slot * i + slot / 2);
    const charBudget = Math.max(10, Math.floor(slot / 13));
    svg += `<circle cx="${cx}" cy="${y + 26}" r="26" fill="${ctx.design.surface}" stroke="${ctx.design.primary}" stroke-width="3"/>`;
    svg += textBlock({
      x: cx,
      y: y + 35,
      lines: [String(i + 1)],
      fontSize: 26,
      lineHeight: 30,
      fill: ctx.design.primary,
      fontFamily: ctx.tokens.headingFont,
      bold: true,
      anchor: 'middle',
    });
    if (i < n - 1) {
      const arrowX = Math.round(x + slot * (i + 1));
      svg += `<text x="${arrowX}" y="${y + 35}" text-anchor="middle" font-family="${escapeXml(ctx.tokens.bodyFont)}" font-size="24" fill="${ctx.design.muted}">›</text>`;
    }
    const titleLines = fitLines(step.title, charBudget, 2);
    svg += textBlock({
      x: cx,
      y: y + 78,
      lines: titleLines,
      fontSize: 22,
      lineHeight: 28,
      fill: ctx.design.text,
      fontFamily: ctx.tokens.headingFont,
      bold: true,
      anchor: 'middle',
    });
    let cursor = y + 78 + titleLines.length * 28;
    if (step.body) {
      const bodyLines = fitLines(step.body, charBudget + 4, 2);
      svg += textBlock({
        x: cx,
        y: cursor + 6,
        lines: bodyLines,
        fontSize: 19,
        lineHeight: 25,
        fill: ctx.design.muted,
        fontFamily: ctx.tokens.bodyFont,
        anchor: 'middle',
      });
      cursor += 6 + bodyLines.length * 25;
    }
    maxBottom = Math.max(maxBottom, cursor);
  });
  if (maxBottom > ctx.maxY) {
    return { svg: '', nextY: y };
  }
  return { svg, nextY: maxBottom + ctx.tokens.gap };
}

function renderStatisticElement(
  value: string,
  label: string,
  context: string | undefined,
  ctx: ElementContext,
  x: number,
  y: number,
  width: number,
): { svg: string; nextY: number } {
  const valueLines = fitLines(value, 14, 2);
  const labelLines = fitLines(label, 40, 2);
  const contextLines = context ? fitLines(context, 60, 2) : [];
  const height =
    valueLines.length * 104 +
    labelLines.length * 36 +
    contextLines.length * 30 +
    ctx.tokens.gap;
  if (y + height - ctx.tokens.gap > ctx.maxY) {
    return { svg: '', nextY: y };
  }
  const cx = x + width / 2;
  let svg = textBlock({
    x: cx,
    y,
    lines: valueLines,
    fontSize: 92,
    lineHeight: 104,
    fill: ctx.design.primary,
    fontFamily: ctx.tokens.headingFont,
    bold: true,
    anchor: 'middle',
  });
  let cursor = y + valueLines.length * 104 + 8;
  svg += textBlock({
    x: cx,
    y: cursor,
    lines: labelLines,
    fontSize: 28,
    lineHeight: 36,
    fill: ctx.design.text,
    fontFamily: ctx.tokens.headingFont,
    bold: true,
    anchor: 'middle',
  });
  cursor += labelLines.length * 36 + 8;
  if (contextLines.length > 0) {
    svg += textBlock({
      x: cx,
      y: cursor,
      lines: contextLines,
      fontSize: 22,
      lineHeight: 30,
      fill: ctx.design.muted,
      fontFamily: ctx.tokens.bodyFont,
      anchor: 'middle',
    });
    cursor += contextLines.length * 30;
  }
  return { svg, nextY: cursor + ctx.tokens.gap };
}

function renderQuoteElement(
  quote: string,
  attribution: string | undefined,
  ctx: ElementContext,
  x: number,
  y: number,
  width: number,
): { svg: string; nextY: number } {
  const quoteLines = fitLines(quote, Math.max(24, Math.floor(width / 16)), 4);
  const attrLines = attribution ? fitLines(attribution, 50, 1) : [];
  const height =
    quoteLines.length * 50 + attrLines.length * 32 + 24 + ctx.tokens.gap;
  if (y + height - ctx.tokens.gap > ctx.maxY) {
    return { svg: '', nextY: y };
  }
  let svg = `<rect x="${x}" y="${y}" width="8" height="${quoteLines.length * 50 + attrLines.length * 32 + 16}" rx="4" fill="${ctx.design.primary}"/>`;
  svg += textBlock({
    x: x + 36,
    y: y + 12,
    lines: quoteLines,
    fontSize: 38,
    lineHeight: 50,
    fill: ctx.design.text,
    fontFamily: 'Georgia,serif',
    italic: true,
  });
  let cursor = y + 12 + quoteLines.length * 50 + 12;
  if (attrLines.length > 0) {
    svg += textBlock({
      x: x + 36,
      y: cursor,
      lines: attrLines,
      fontSize: 24,
      lineHeight: 32,
      fill: ctx.design.primary,
      fontFamily: ctx.tokens.bodyFont,
    });
    cursor += attrLines.length * 32;
  }
  return { svg, nextY: cursor + ctx.tokens.gap };
}

function renderSceneElement(
  element: SlideElement,
  ctx: ElementContext,
  x: number,
  y: number,
  width: number,
  center: boolean,
): { svg: string; nextY: number } {
  switch (element.type) {
    case 'text':
      return renderTextElement(element.text, element.style, ctx, x, y, width);
    case 'bullet-list':
      return renderBulletListElement(
        element.items,
        element.style?.columns,
        ctx,
        x,
        y,
        width,
        center,
      );
    case 'card-group':
      return renderCardGroupElement(
        element.cards,
        element.columns,
        ctx,
        x,
        y,
        width,
      );
    case 'comparison':
      return renderComparisonElement(
        element.left,
        element.right,
        ctx,
        x,
        y,
        width,
      );
    case 'timeline':
      return renderTimelineElement(element.steps, ctx, x, y, width);
    case 'process':
      return renderProcessElement(element.steps, ctx, x, y, width);
    case 'statistic':
      return renderStatisticElement(
        element.value,
        element.label,
        element.context,
        ctx,
        x,
        y,
        width,
      );
    case 'quote':
      return renderQuoteElement(
        element.quote,
        element.attribution,
        ctx,
        x,
        y,
        width,
      );
    case 'shape': {
      const rendered = shapeSvg(
        element.variant,
        element.emphasis,
        ctx.design,
        x,
        y,
        width,
      );
      if (y + rendered.height > ctx.maxY) return { svg: '', nextY: y };
      return { svg: rendered.svg, nextY: y + rendered.height + 8 };
    }
    default:
      return { svg: '', nextY: y };
  }
}

function renderSceneSlide(
  scene: SlideScene,
  index: number,
  total: number,
  design: SlideDesign,
): string {
  void total;
  const tokens = designTokens(design);
  const ctx: ElementContext = { tokens, design, maxY: CONTENT_BOTTOM };
  const center = CENTERED_ROLES.has(scene.role);

  const titleLines = fitLines(
    scene.title || `Slide ${index + 1}`,
    center ? 30 : 44,
    2,
  );
  const subtitleLines = scene.subtitle
    ? fitLines(scene.subtitle, center ? 56 : 64, 2)
    : [];
  const eyebrow = ROLE_EYEBROW[scene.role];

  let cursor: number;
  let svg = '';

  if (center) {
    // Centered roles stack title first; elements flow below in a centered column.
    const titleHeight = titleLines.length * (tokens.titleSize + 14);
    cursor = scene.role === 'title' ? 250 : 210;
    if (eyebrow && scene.role !== 'title') {
      svg += textBlock({
        x: 640,
        y: cursor - titleHeight - 40,
        lines: [eyebrow.toUpperCase()],
        fontSize: 20,
        lineHeight: 26,
        fill: design.primary,
        fontFamily: tokens.bodyFont,
        bold: true,
        anchor: 'middle',
      });
    }
    const titleSize = scene.role === 'title' ? 64 : tokens.titleSize + 4;
    const titleLine = scene.role === 'title' ? 74 : tokens.titleSize + 14;
    svg += textBlock({
      x: 640,
      y: cursor,
      lines: titleLines,
      fontSize: titleSize,
      lineHeight: titleLine,
      fill: design.text,
      fontFamily: tokens.headingFont,
      bold: true,
      anchor: 'middle',
    });
    cursor += titleLines.length * titleLine + 14;
    if (subtitleLines.length > 0) {
      svg += textBlock({
        x: 640,
        y: cursor,
        lines: subtitleLines,
        fontSize: 27,
        lineHeight: 37,
        fill: design.muted,
        fontFamily: tokens.bodyFont,
        anchor: 'middle',
      });
      cursor += subtitleLines.length * 37 + 18;
    } else {
      cursor += 8;
    }
    const contentWidth = scene.role === 'title' ? 880 : 980;
    const contentX = Math.round(640 - contentWidth / 2);
    for (const element of scene.elements) {
      if (cursor >= CONTENT_BOTTOM) break;
      const rendered = renderSceneElement(
        element,
        ctx,
        contentX,
        cursor,
        contentWidth,
        true,
      );
      svg += rendered.svg;
      if (rendered.nextY === cursor && rendered.svg === '') break;
      cursor = rendered.nextY;
    }
    return svg;
  }

  // Left-aligned roles: eyebrow, title, subtitle, accent rule, then elements.
  cursor = 150;
  if (eyebrow) {
    svg += textBlock({
      x: 120,
      y: cursor,
      lines: [eyebrow.toUpperCase()],
      fontSize: 20,
      lineHeight: 26,
      fill: design.primary,
      fontFamily: tokens.bodyFont,
      bold: true,
    });
    cursor += 34;
  }
  svg += textBlock({
    x: 120,
    y: cursor,
    lines: titleLines,
    fontSize: tokens.titleSize,
    lineHeight: tokens.titleLine,
    fill: design.text,
    fontFamily: tokens.headingFont,
    bold: true,
  });
  cursor += titleLines.length * tokens.titleLine + 6;
  if (subtitleLines.length > 0) {
    svg += textBlock({
      x: 120,
      y: cursor,
      lines: subtitleLines,
      fontSize: 25,
      lineHeight: 33,
      fill: design.muted,
      fontFamily: tokens.bodyFont,
    });
    cursor += subtitleLines.length * 33 + 10;
  }
  svg += `<rect x="120" y="${cursor}" width="120" height="6" rx="3" fill="${design.primary}"/>`;
  cursor += 36;

  const contentWidth = 1040;
  for (const element of scene.elements) {
    if (cursor >= CONTENT_BOTTOM) break;
    const rendered = renderSceneElement(
      element,
      ctx,
      120,
      cursor,
      contentWidth,
      false,
    );
    svg += rendered.svg;
    if (rendered.nextY === cursor && rendered.svg === '') break;
    cursor = rendered.nextY;
  }
  return svg;
}

function designToLegacyTheme(design: SlideDesign): Theme {
  return {
    background: design.background,
    accent: design.primary,
    text: design.text,
    muted: design.muted,
  };
}

export function renderSlideSvg(
  slide: DeckSlide | SlideScene,
  index: number,
  total: number,
  theme: Theme | SlideDesign,
): string {
  const isScene = isSceneSlide(slide);
  let design: SlideDesign | null = null;
  let legacyTheme: Theme;
  if (isSlideDesign(theme)) {
    design = theme;
    legacyTheme = designToLegacyTheme(design);
  } else {
    legacyTheme = theme;
  }
  const plainTitle = truncate(
    (slide.title || `Slide ${index + 1}`).slice(0, 90) || `Slide ${index + 1}`,
    90,
  );
  const background = design?.background ?? legacyTheme.background;
  const accent = design?.primary ?? legacyTheme.accent;
  const muted = design?.muted ?? legacyTheme.muted;

  let contentSvg: string;
  if (isScene && design) {
    contentSvg = renderSceneSlide(slide, index, total, design);
  } else if (isScene) {
    // Scene without a design (direct unit-test calls): resolve a default
    // design from the legacy theme colors.
    const fallback: SlideDesign = {
      background: legacyTheme.background,
      surface: legacyTheme.background,
      primary: legacyTheme.accent,
      secondary: legacyTheme.accent,
      text: legacyTheme.text,
      muted: legacyTheme.muted,
      fontHeading: 'Inter',
      fontBody: 'Inter',
      radius: 'small',
      density: 'balanced',
      decoration: 'minimal',
    };
    contentSvg = renderSceneSlide(slide, index, total, fallback);
  } else {
    contentSvg = renderLegacySlide(slide, index, legacyTheme);
  }

  const decoration =
    design && !isScene ? '' : design ? decorationSvg(design) : '';
  void decoration;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escapeXml(plainTitle)}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${background}"/>
  <rect width="${WIDTH}" height="10" fill="${accent}"/>
  ${design ? decorationSvg(design) : ''}
  <text x="120" y="80" font-family="Inter,Arial,sans-serif" font-size="22" letter-spacing="3" fill="${muted}">SLIDE ${index + 1} / ${total}</text>
  ${contentSvg}
</svg>`;
}

export function renderSceneSvg(
  scene: SlideScene,
  index: number,
  total: number,
  design: SlideDesign,
): string {
  const plainTitle = truncate(scene.title || `Slide ${index + 1}`, 90);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escapeXml(plainTitle)}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${design.background}"/>
  <rect width="${WIDTH}" height="10" fill="${design.primary}"/>
  ${decorationSvg(design)}
  <text x="120" y="80" font-family="${escapeXml(fontFamilyFor(design.fontBody, 'body'))}" font-size="22" letter-spacing="3" fill="${design.muted}">SLIDE ${index + 1} / ${total}</text>
  ${renderSceneSlide(scene, index, total, design)}
</svg>`;
}

function toDeck(content: unknown): SlideDeck {
  if (
    content &&
    typeof content === 'object' &&
    'design' in content &&
    'slides' in content &&
    Array.isArray((content as { slides: unknown }).slides) &&
    (content as { slides: unknown[] }).slides.length > 0 &&
    ((): boolean => {
      const first = (content as { slides: unknown[] }).slides[0] as Record<
        string,
        unknown
      > | null;
      return (
        !!first &&
        typeof first === 'object' &&
        ('role' in first || 'elements' in first)
      );
    })()
  ) {
    // Already a resolved deck; still pass through the resolver for safety so
    // partially-hand-edited content degrades instead of crashing rendering.
    return resolveSlideDeck(content);
  }
  return resolveSlideDeck(content);
}

export function buildSlidePreviews(content: unknown): {
  slideId: string;
  svg: string;
}[] {
  if (!content || typeof content !== 'object') return [];
  const deck = toDeck(content);
  if (!Array.isArray(deck.slides)) return [];
  return deck.slides.map((scene, index) => ({
    slideId: scene.id,
    svg: renderSceneSvg(scene, index, deck.slides.length, deck.design),
  }));
}

export function withSlidePreviews<T extends Record<string, unknown>>(
  validated: T,
): T {
  const deck = toDeck(validated);
  const previews = deck.slides.map((scene, index) => ({
    slideId: scene.id,
    svg: renderSceneSvg(scene, index, deck.slides.length, deck.design),
  }));
  return {
    ...(validated as object),
    design: deck.design,
    slides: deck.slides,
    previews,
  } as unknown as T;
}
