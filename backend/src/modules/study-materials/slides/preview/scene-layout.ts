import { CONTENT_BOTTOM } from './preview.types';
import { designTokens, fitLines, textBlock } from './text-layout';
import type { ElementContext } from './element-context';
import { renderSceneElement } from './element-renderer';
import type { SlideDesign, SlideScene } from '../slides-design.types';

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

export function renderSceneSlide(
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
