import { bulletBlock, fitLines, textBlock } from './text-layout';
import type { ElementContext } from './element-context';

export function renderCardGroupElement(
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

export function renderComparisonElement(
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
