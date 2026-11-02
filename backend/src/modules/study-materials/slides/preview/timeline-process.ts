import { escapeXml, fitLines, textBlock } from './text-layout';
import type { ElementContext } from './element-context';

export function renderTimelineElement(
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

export function renderProcessElement(
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
