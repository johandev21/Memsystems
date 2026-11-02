import type { SlideDesign } from '../slides-design.types';

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export function wrapWords(text: string, maxChars: number): string[] {
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

export function fitLines(
  text: string,
  maxChars: number,
  maxLines: number,
): string[] {
  const wrapped = wrapWords(text, maxChars);
  if (wrapped.length <= maxLines) return wrapped;
  const lines = wrapped.slice(0, maxLines);
  lines[maxLines - 1] = `${truncate(lines[maxLines - 1], maxChars)}`;
  return lines;
}

export function fontFamilyFor(
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

export function designTokens(design: SlideDesign) {
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

export function textBlock(options: {
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

export function bulletBlock(options: {
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
