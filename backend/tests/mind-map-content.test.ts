import { describe, expect, it } from 'vitest';
import { normalizeMindMapContent } from '../src/modules/study-materials/content-normalizer';
import { getPromptTemplate } from '../src/modules/study-materials/prompts';
import { validateContent } from '../src/modules/study-materials/shapes';

describe('mind map content normalization', () => {
  it('fills presentation fields omitted by JSON fallback models', () => {
    const normalized = normalizeMindMapContent({
      title: 'operating-systems-mind-map',
      rootId: 'root',
      nodes: [
        { id: 'root', label: 'Operating Systems' },
        { id: 'processes', label: 'Processes' },
      ],
      edges: [{ source: 'root', target: 'processes' }],
    });

    expect(() => validateContent('mind_map', normalized)).not.toThrow();
  });

  it('gives JSON fallback models the exact mind map field contract', () => {
    const instructions = getPromptTemplate('mind_map').instructions;

    expect(instructions).toContain('"rootId"');
    expect(instructions).toContain('"sourceId"');
    expect(instructions).toContain('"targetId"');
    expect(instructions).toContain('"position"');
  });
});
