const WIDTH = 1280;
const HEIGHT = 720;

const DEFAULT_THEME = {
  background: '#0F172A',
  accent: '#38BDF8',
  text: '#F8FAFC',
  muted: '#94A3B8',
};

// Bottom edge of the usable content region. Everything text-related must be
// laid out above this so nothing spills past the viewBox and gets clipped by
// the <img> viewport in the frontend.
const CONTENT_BOTTOM = 656;

type SlideTheme = {
  background?: string;
  accent?: string;
  text?: string;
  muted?: string;
};

type DeckSlide = {
  id: string;
  layout?: string;
  title: string;
  subtitle?: string;
  bullets?: string[];
  body?: string;
};

type DeckContent = {
  theme?: SlideTheme;
  slides: DeckSlide[];
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

function themeFor(content: DeckContent) {
  return {
    background: content.theme?.background ?? DEFAULT_THEME.background,
    accent: content.theme?.accent ?? DEFAULT_THEME.accent,
    text: content.theme?.text ?? DEFAULT_THEME.text,
    muted: content.theme?.muted ?? DEFAULT_THEME.muted,
  };
}

type Theme = ReturnType<typeof themeFor>;

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
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${fontFamily}" font-size="${fontSize}"${bold ? ' font-weight="700"' : ''}${italic ? ' font-style="italic"' : ''} fill="${fill}">${tspans}</text>`;
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

export function renderSlideSvg(
  slide: DeckSlide,
  index: number,
  total: number,
  theme: ReturnType<typeof themeFor>,
): string {
  const layout = slide.layout ?? 'title-bullets';
  const plainTitle = truncate(slide.title || `Slide ${index + 1}`, 90);

  let contentSvg = '';
  if (layout === 'title' || layout === 'closing') {
    contentSvg = renderTitleClosing(slide, theme);
  } else if (layout === 'quote') {
    contentSvg = renderQuote(slide, index, theme);
  } else {
    contentSvg = renderBullets(slide, theme, layout === 'two-column');
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escapeXml(plainTitle)}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${theme.background}"/>
  <rect width="${WIDTH}" height="10" fill="${theme.accent}"/>
  <text x="120" y="80" font-family="Inter,Arial,sans-serif" font-size="22" letter-spacing="3" fill="${theme.muted}">SLIDE ${index + 1} / ${total}</text>
  ${contentSvg}
</svg>`;
}

export function buildSlidePreviews(content: unknown): {
  slideId: string;
  svg: string;
}[] {
  if (!content || typeof content !== 'object') return [];
  const deck = content as DeckContent;
  if (!Array.isArray(deck.slides)) return [];
  const theme = themeFor(deck);
  return deck.slides.map((slide, index) => {
    const record = slide as Record<string, unknown>;
    const rawId = record.id;
    const rawTitle = record.title;
    const id =
      typeof rawId === 'string' && rawId ? rawId : `slide-${index + 1}`;
    const title = typeof rawTitle === 'string' ? rawTitle : '';
    return {
      slideId: id,
      svg: renderSlideSvg(
        {
          id,
          layout: record.layout as string | undefined,
          title,
          subtitle: record.subtitle as string | undefined,
          bullets: record.bullets as string[] | undefined,
          body: record.body as string | undefined,
        },
        index,
        deck.slides.length,
        theme,
      ),
    };
  });
}

export function withSlidePreviews<T extends Record<string, unknown>>(
  validated: T,
): T {
  const previews = buildSlidePreviews(validated);
  return { ...validated, previews };
}
