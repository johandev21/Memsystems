import { fitLines, textBlock } from './text-layout';
import type { ElementContext } from './element-context';
import type { ShapeVariant, SlideDesign } from '../slides-design.types';

export function shapeSvg(
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

export function renderStatisticElement(
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
