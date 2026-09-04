import { describe, expect, it } from 'vitest';
import {
  designForPreset,
  presetForThemeName,
  resolveDesign,
  resolveSlideDeck,
} from '../src/modules/study-materials/slides-design-resolver';
import {
  renderSceneSvg,
  renderSlideSvg,
} from '../src/modules/study-materials/slides-preview';
import { SlidesBuilderService } from '../src/modules/study-materials/slides-builder.service';
import type { SlideDesign } from '../src/modules/study-materials/slides-design.types';

type DesignPreset =
  'dark' | 'light' | 'editorial' | 'academic' | 'technical' | 'warm';

const design = (preset: DesignPreset = 'dark'): SlideDesign => ({
  ...designForPreset(preset),
});

function sceneSvg(
  role: string,
  elements: unknown[],
  preset: DesignPreset = 'dark',
) {
  return renderSceneSvg(
    {
      id: 's1',
      role: role as never,
      title: 'Title',
      elements: elements as never[],
    },
    0,
    1,
    design(preset),
  );
}

describe('structured slide design', () => {
  it('resolves every named preset into complete design tokens', () => {
    for (const preset of [
      'dark',
      'light',
      'editorial',
      'academic',
      'technical',
      'warm',
    ] as const) {
      const resolved = resolveDesign({ preset });
      expect(resolved.background).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(resolved.surface).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(resolved.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(resolved.secondary).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(resolved.text).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(resolved.muted).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(resolved.preset).toBe(preset);
    }
  });

  it('maps legacy theme names onto presets', () => {
    expect(presetForThemeName('dark')).toBe('dark');
    expect(presetForThemeName('light')).toBe('light');
    expect(presetForThemeName('accent')).toBe('warm');
    expect(presetForThemeName(undefined)).toBe('dark');
    expect(resolveDesign({ theme: 'accent' }).preset).toBe('warm');
  });

  it('falls back on invalid colors and fonts', () => {
    const resolved = resolveDesign({
      preset: 'dark',
      background: 'not-a-color',
      primary: '#GGGGGG',
      fontHeading: 'Comic Sans',
      fontBody: 'Papyrus',
      radius: 'huge',
      density: 'spacious',
    });
    expect(resolved.background).toBe(designForPreset('dark').background);
    expect(resolved.primary).toBe(designForPreset('dark').primary);
    expect(resolved.fontHeading).toBe('Arial');
    expect(resolved.fontBody).toBe('Arial');
    expect(resolved.radius).toBe('small');
    expect(resolved.density).toBe('balanced');
  });

  it('repairs unreadable text/background contrast', () => {
    const resolved = resolveDesign({
      preset: 'dark',
      background: '#0F172A',
      text: '#0F172A',
      muted: '#0F172A',
    });
    expect(resolved.text).not.toBe('#0F172A');
    expect(resolved.muted).not.toBe('#0F172A');
  });

  it('converts legacy prose slides into scenes', () => {
    const deck = resolveSlideDeck({
      title: 'deck',
      theme: {
        background: '#FFFFFF',
        accent: '#0EA5E9',
        text: '#0F172A',
        muted: '#64748B',
      },
      slides: [
        { id: 's1', layout: 'title', title: 'Opening', subtitle: 'Sub' },
        {
          id: 's2',
          layout: 'two-column',
          title: 'Ideas',
          bullets: ['A', 'B', 'C', 'D'],
        },
        {
          id: 's3',
          layout: 'quote',
          title: 'Wisdom',
          body: 'A real quote',
          subtitle: 'Author',
        },
      ],
    });
    expect(deck.schemaVersion).toBe(2);
    expect(deck.slides[0].role).toBe('title');
    expect(deck.slides[1].role).toBe('content');
    expect(deck.slides[1].elements[0].type).toBe('bullet-list');
    expect(deck.slides[2].role).toBe('closing');
    expect(deck.slides[2].elements[0].type).toBe('quote');
  });

  it('falls back for missing/invalid roles and drops unknown elements', () => {
    const deck = resolveSlideDeck({
      title: 'deck',
      design: { preset: 'light' },
      slides: [
        {
          id: 's1',
          role: 'nonsense',
          title: 'First',
          elements: [
            { type: 'text', text: 'Kept' },
            { type: 'hologram', text: 'Dropped' },
            { type: 'text', text: '' },
          ],
        },
        { id: 's2', title: 'Second', elements: [] },
      ],
    });
    expect(deck.slides[0].role).toBe('title');
    expect(deck.slides[0].elements).toHaveLength(1);
    expect(deck.slides[1].role).toBe('closing');
  });

  it('enforces element count, text length, and slide limits', () => {
    const deck = resolveSlideDeck({
      title: 'deck',
      design: { preset: 'dark' },
      slides: Array.from({ length: 25 }, (_, i) => ({
        id: `s${i}`,
        role: 'content',
        title: `Slide ${i}`,
        elements: Array.from({ length: 8 }, () => ({
          type: 'text',
          text: 'x'.repeat(5000),
        })),
      })),
    });
    expect(deck.slides.length).toBeLessThanOrEqual(20);
    for (const slide of deck.slides) {
      expect(slide.elements.length).toBeLessThanOrEqual(6);
      for (const element of slide.elements) {
        if (element.type === 'text') {
          expect(element.text.length).toBeLessThanOrEqual(2000);
        }
      }
    }
  });

  it('enforces deck role sequence rules deterministically', () => {
    const input = {
      title: 'deck',
      design: { preset: 'dark' },
      slides: [
        {
          id: 's1',
          role: 'content',
          title: 'One',
          elements: [{ type: 'text', text: 'a' }],
        },
        {
          id: 's2',
          role: 'content',
          title: 'Two',
          elements: [{ type: 'text', text: 'b' }],
        },
        {
          id: 's3',
          role: 'content',
          title: 'Three',
          elements: [{ type: 'text', text: 'c' }],
        },
        {
          id: 's4',
          role: 'content',
          title: 'Four',
          elements: [{ type: 'text', text: 'd' }],
        },
      ],
    };
    const first = resolveSlideDeck(input);
    const second = resolveSlideDeck(input);
    expect(first).toEqual(second);
    expect(first.slides[0].role).toBe('title');
    expect(
      first.slides.filter((slide) => slide.role === 'content').length,
    ).toBeLessThanOrEqual(3);
    expect(['closing', 'takeaways']).toContain(
      first.slides[first.slides.length - 1].role,
    );
  });

  it('renders every supported element type without clipping', () => {
    const elements: unknown[] = [
      { type: 'text', text: 'Hello world' },
      { type: 'bullet-list', items: ['One', 'Two'] },
      {
        type: 'card-group',
        cards: [{ title: 'A', body: 'Body A' }, { title: 'B' }],
      },
      {
        type: 'comparison',
        left: { heading: 'Left', points: ['L1'] },
        right: { heading: 'Right', points: ['R1'] },
      },
      { type: 'timeline', steps: [{ title: 'S1' }, { title: 'S2' }] },
      { type: 'process', steps: [{ title: 'P1' }, { title: 'P2' }] },
      {
        type: 'statistic',
        value: '42%',
        label: 'Coverage',
        context: 'Measured',
      },
      { type: 'quote', quote: 'Stay curious', attribution: 'Author' },
      { type: 'shape', variant: 'dots' },
    ];
    for (const element of elements) {
      const svg = sceneSvg('content', [element]);
      expect(svg).toContain('<svg');
      for (const match of svg.matchAll(/\bx="(\d+)"/g)) {
        expect(Number(match[1])).toBeLessThanOrEqual(1280);
      }
      for (const match of svg.matchAll(/\by="(\d+)"/g)) {
        expect(Number(match[1])).toBeLessThanOrEqual(720);
      }
    }
  });

  it('renders every supported role', () => {
    const byRole: Record<string, unknown[]> = {
      title: [{ type: 'text', text: 'Welcome' }],
      section: [{ type: 'text', text: 'Part two' }],
      content: [{ type: 'bullet-list', items: ['A'] }],
      comparison: [
        {
          type: 'comparison',
          left: { heading: 'L', points: ['a'] },
          right: { heading: 'R', points: ['b'] },
        },
      ],
      timeline: [{ type: 'timeline', steps: [{ title: 'A' }, { title: 'B' }] }],
      process: [{ type: 'process', steps: [{ title: 'A' }, { title: 'B' }] }],
      statistic: [{ type: 'statistic', value: '99%', label: 'Uptime' }],
      quote: [{ type: 'quote', quote: 'Be kind' }],
      cards: [{ type: 'card-group', cards: [{ title: 'A' }] }],
      takeaways: [{ type: 'bullet-list', items: ['Take one'] }],
      closing: [{ type: 'text', text: 'Thanks' }],
    };
    for (const [role, elements] of Object.entries(byRole)) {
      expect(sceneSvg(role, elements)).toContain('<svg');
    }
  });

  it('escapes XML in AI-provided strings', () => {
    const svg = sceneSvg('content', [
      { type: 'text', text: '<script>alert("x") & \'friends\'</script>' },
    ]);
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain('&amp;');
  });

  it('produces well-formed SVG attributes for the academic preset (Times New Roman)', () => {
    // Regression: the quoted "Times New Roman" stack used to break the
    // font-family attribute, so academic previews failed to load as images.
    const svg = sceneSvg(
      'comparison',
      [
        {
          type: 'comparison',
          left: { heading: 'L', points: ['a'] },
          right: { heading: 'R', points: ['b'] },
        },
      ],
      'academic',
    );
    expect(svg).toContain('Times New Roman');
    expect(svg).not.toContain('font-family=""');
    for (const match of svg.matchAll(/font-family="([^"]*)"/g)) {
      expect(match[1]).not.toContain('"');
    }
    // No empty/broken attributes anywhere in the document.
    expect(svg).not.toContain('=""');
  });

  it('truncates overflowing decks instead of spilling past the viewBox', () => {
    const svg = renderSlideSvg(
      {
        id: 's1',
        role: 'content',
        title: 'Dense',
        elements: [
          {
            type: 'bullet-list',
            items: ['a'.repeat(400), 'b'.repeat(400), 'c'.repeat(400)],
          },
          { type: 'text', text: 'd'.repeat(1900) },
          { type: 'text', text: 'e'.repeat(1900) },
        ],
      } as never,
      0,
      1,
      design('dark'),
    );
    for (const match of svg.matchAll(/\by="(\d+)"/g)) {
      expect(Number(match[1])).toBeLessThanOrEqual(720);
    }
  });

  it('builds editable PPTX for comparison, timeline, and statistic scenes', async () => {
    const builder = new SlidesBuilderService();
    const buffer = await builder.buildPptxBuffer(
      resolveSlideDeck({
        title: 'variety-deck',
        design: { preset: 'technical' },
        slides: [
          {
            id: 's1',
            role: 'title',
            title: 'Opening',
            elements: [{ type: 'text', text: 'Hi' }],
          },
          {
            id: 's2',
            role: 'comparison',
            title: 'Versus',
            elements: [
              {
                type: 'comparison',
                left: { heading: 'A', points: ['one'] },
                right: { heading: 'B', points: ['two'] },
              },
            ],
          },
          {
            id: 's3',
            role: 'timeline',
            title: 'History',
            elements: [
              {
                type: 'timeline',
                steps: [{ title: '1900' }, { title: '2000' }],
              },
            ],
          },
          {
            id: 's4',
            role: 'statistic',
            title: 'Impact',
            elements: [{ type: 'statistic', value: '10x', label: 'Growth' }],
          },
          { id: 's5', role: 'closing', title: 'Thanks', elements: [] },
        ],
      }),
    );
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(2000);
    expect(buffer.subarray(0, 2).toString('ascii')).toBe('PK');
  });
});
