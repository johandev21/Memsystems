import type { SlideElementType, SlidesContentType, SlidesSlideType } from "../shapes/slides";

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function elementText(element: SlideElementType): string[] {
  switch (element.type) {
    case "text":
      return element.text ? [element.text] : [];
    case "bullet-list":
      return element.items ?? [];
    case "card-group":
      return (element.cards ?? []).flatMap((card) =>
        card.body ? [`${card.title}: ${card.body}`] : [card.title],
      );
    case "comparison": {
      const lines: string[] = [];
      if (element.left) {
        lines.push(`${element.left.heading}:`);
        lines.push(...element.left.points.map((point) => `- ${point}`));
      }
      if (element.right) {
        lines.push(`${element.right.heading}:`);
        lines.push(...element.right.points.map((point) => `- ${point}`));
      }
      return lines;
    }
    case "timeline":
    case "process":
      return (element.steps ?? []).map((step) =>
        step.body ? `${step.title}: ${step.body}` : step.title,
      );
    case "statistic": {
      const lines = [`${element.value ?? ""} — ${element.label ?? ""}`];
      if (element.context) lines.push(element.context);
      return lines;
    }
    case "quote":
      return element.quote
        ? [`"${element.quote}"${element.attribution ? ` — ${element.attribution}` : ""}`]
        : [];
    case "shape":
      return [];
    default:
      return [];
  }
}

export function slideBodyLines(slide: SlidesSlideType): string[] {
  const lines: string[] = [];
  for (const bullet of slide.bullets ?? []) lines.push(`• ${bullet}`);
  if (slide.body) lines.push(slide.body);
  for (const element of slide.elements ?? []) lines.push(...elementText(element));
  return lines;
}

export function buildSlidePreviews(content: SlidesContentType): Map<string, string> {
  const map = new Map<string, string>();
  for (const preview of content.previews ?? []) {
    map.set(preview.slideId, preview.svg);
  }
  return map;
}
