import type { DocumentSection } from './document.types';
import { normalizeProse } from './document-normalization';

interface SectionAccumulator {
  headingPath: string[];
  blocks: string[];
}

const FENCE_OPEN_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const FENCE_CLOSE_RE = /^ {0,3}(`+|~+)[ \t]*$/;

export function sectionsFromMarkdown(markdown: string): DocumentSection[] {
  const lines = markdown.split('\n');
  const sections: SectionAccumulator[] = [];
  let current: SectionAccumulator = { headingPath: [], blocks: [] };
  let fence: { marker: string; length: number } | undefined;

  const finalize = (): void => {
    if (current.blocks.length > 0) {
      sections.push(current);
      current = { headingPath: [], blocks: [] };
    }
  };

  for (const line of lines) {
    if (fence) {
      const closeMatch = line.match(FENCE_CLOSE_RE);
      if (
        closeMatch &&
        closeMatch[1][0] === fence.marker &&
        closeMatch[1].length >= fence.length
      ) {
        fence = undefined;
      }
      current.blocks.push(line);
      continue;
    }
    const openMatch = line.match(FENCE_OPEN_RE);
    if (openMatch && !(openMatch[1][0] === '`' && openMatch[2].includes('`'))) {
      fence = { marker: openMatch[1][0], length: openMatch[1].length };
      current.blocks.push(line);
      continue;
    }
    const match = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (match) {
      const level = match[1].length;
      const headingPath = [
        ...current.headingPath.slice(0, level - 1),
        match[2].trim(),
      ];
      finalize();
      current = { headingPath, blocks: [line] };
      continue;
    }
    if (line.trim() || current.blocks.length > 0) {
      current.blocks.push(line);
    }
  }
  finalize();

  return sections.map((section, index) => ({
    headingPath: section.headingPath,
    content: normalizeProse(section.blocks.join('\n')),
    ordinal: index,
  }));
}
