import { bulletBlock, fitLines, textBlock } from './text-layout';
import type { ElementContext } from './element-context';

export function renderTextElement(
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

export function renderBulletListElement(
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

export function renderQuoteElement(
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
