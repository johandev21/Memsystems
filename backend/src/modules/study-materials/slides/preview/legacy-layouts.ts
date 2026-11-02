import { bulletBlock, fitLines, textBlock } from './text-layout';
import {
  CONTENT_BOTTOM,
  type DeckSlide,
  type LegacyPreviewTheme,
} from './preview.types';

type Theme = LegacyPreviewTheme;

export function renderTitleClosing(slide: DeckSlide, theme: Theme): string {
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

export function renderQuote(
  slide: DeckSlide,
  index: number,
  theme: Theme,
): string {
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

export function renderBullets(
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

export function renderLegacySlide(
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
