import { JSDOM } from 'jsdom';
import type { DocumentSection } from './document.types';
import { normalizeProse, stripProvenCitations } from './document-normalization';

const HEADING_LEVELS: Record<string, number> = {
  H1: 1,
  H2: 2,
  H3: 3,
  H4: 4,
  H5: 5,
  H6: 6,
};

const TEXT_NODE = 3;

function inlineText(el: Element): string {
  let out = '';
  const walk = (node: Node): void => {
    if (node.nodeType === TEXT_NODE) {
      out += node.textContent ?? '';
      return;
    }
    const element = node as Element;
    if (element.tagName === 'BR') {
      out += '\n';
      return;
    }
    if (element.tagName === 'PRE' || element.tagName === 'CODE') {
      out += `\u0000${element.textContent ?? ''}\u0000`;
      return;
    }
    for (const child of element.childNodes) walk(child);
  };
  walk(el);
  return out
    .split('\u0000')
    .map((segment, index) => {
      const trimmed = segment.trim();
      if (index % 2 !== 0) return trimmed;
      return trimmed.replace(/[ \t\r\n]+/g, ' ');
    })
    .filter((segment) => segment.length > 0)
    .join(' ');
}

function containsHeading(el: Element): boolean {
  return el.querySelector('h1, h2, h3, h4, h5, h6') !== null;
}

function headingLevel(el: Element): number {
  return HEADING_LEVELS[el.tagName] ?? 0;
}

interface SectionAccumulator {
  headingPath: string[];
  blocks: string[];
}

export function sectionsFromHtml(articleHtml: string): DocumentSection[] {
  const dom = new JSDOM(articleHtml);
  const root = dom.window.document.body;

  const blocks: { headingPath: string[]; text: string }[] = [];
  let path: string[] = [];

  const collect = (container: Element): void => {
    for (const child of Array.from(container.children)) {
      const level = headingLevel(child);
      if (level > 0) {
        const headingText = inlineText(child);
        if (headingText) {
          while (path.length >= level) path.pop();
          path = [...path, headingText];
          blocks.push({ headingPath: path, text: headingText });
        }
        continue;
      }
      if (containsHeading(child)) {
        collect(child);
        continue;
      }
      const text = inlineText(child);
      if (text) blocks.push({ headingPath: path, text });
    }
  };
  collect(root);

  const sections: SectionAccumulator[] = [];
  let current: SectionAccumulator = { headingPath: [], blocks: [] };
  const finalize = (): void => {
    if (current.blocks.length > 0) {
      sections.push(current);
      current = { headingPath: [], blocks: [] };
    }
  };

  for (const block of blocks) {
    if (
      block.headingPath.length > 0 &&
      block.text === block.headingPath.at(-1)
    ) {
      finalize();
      current = { headingPath: block.headingPath, blocks: [] };
    } else {
      current.blocks.push(block.text);
    }
  }
  finalize();

  return sections.map((section, index) => ({
    headingPath: section.headingPath,
    content: normalizeProse(stripProvenCitations(section.blocks.join('\n\n'))),
    ordinal: index,
  }));
}
