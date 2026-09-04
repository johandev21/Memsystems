import { describe, expect, it } from 'vitest';
import {
  generateTitle,
  normalizeContent,
  normalizeSlidesContent,
} from '../src/modules/study-materials/content-normalizer';
import {
  SlidesContent,
  validateContent,
} from '../src/modules/study-materials/shapes';
import {
  buildSlidePreviews,
  renderSlideSvg,
  withSlidePreviews,
} from '../src/modules/study-materials/slides-preview';
import { SlidesBuilderService } from '../src/modules/study-materials/slides-builder.service';

describe('slides content', () => {
  it('normalizes raw slides with ids, layouts, and bullet caps', () => {
    const normalized = normalizeSlidesContent({
      title: 'Nietzsche Core Ideas',
      slides: [
        { title: 'Opening', bullets: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] },
        { id: 'custom', layout: 'bogus', title: 'Second' },
      ],
    });

    expect(normalized.slides).toHaveLength(2);
    expect(normalized.slides[0].id).toBe('slide-1');
    expect(normalized.slides[0].layout).toBe('title');
    expect(normalized.slides[0].bullets).toHaveLength(6);
    expect(normalized.slides[1].id).toBe('custom');
    expect(normalized.slides[1].layout).toBe('title-bullets');
  });

  it('validates through the kind registry and generates a -slides title', () => {
    const normalized = normalizeContent('slides', {
      title: 'Nietzsche Core Ideas',
      slides: [{ id: 's1', title: 'Opening', bullets: ['One'] }],
    });
    const validated = validateContent('slides', normalized) as {
      slides: unknown[];
    };
    expect(validated.slides).toHaveLength(1);
    expect(generateTitle('slides', normalized)).toBe(
      'nietzsche-core-ideas-slides',
    );
    expect(() => SlidesContent.parse({ title: 'x', slides: [] })).toThrow();
  });

  it('builds one SVG preview per slide in deck order', () => {
    const validated = validateContent('slides', {
      title: 'nietzsche-core-ideas-slides',
      slides: [
        { id: 's1', layout: 'title', title: 'Opening' },
        { id: 's2', layout: 'quote', title: 'Quote', body: 'Body' },
      ],
    });
    const withPreviews = withSlidePreviews(
      validated as Record<string, unknown>,
    ) as unknown as { previews: { slideId: string; svg: string }[] };
    expect(withPreviews.previews).toHaveLength(2);
    expect(withPreviews.previews.map((p) => p.slideId)).toEqual(['s1', 's2']);
    expect(buildSlidePreviews(validated)[0].svg).toContain('<svg');
  });

  it('wraps long closing body text into multiple lines within the viewBox', () => {
    const body =
      'Southern Europe before their authoritative Berlin edition in 1831–1836. His framework of logic, teleology, and virtue ethics shaped centuries of thought across many schools and traditions.';
    const svg = renderSlideSvg(
      {
        id: 's8',
        layout: 'closing',
        title: 'A Legacy Twenty Centuries Long',
        body,
      },
      7,
      8,
      {
        background: '#0F172A',
        accent: '#38BDF8',
        text: '#F8FAFC',
        muted: '#94A3B8',
      },
    );
    // Wrapped: the full body must not appear as one clipped line
    expect(svg).toContain('<tspan');
    expect(svg).not.toContain(body.slice(0, 100));
    expect(svg).toContain('width="1280"');
    expect(svg).toContain('height="720"');
    // Every positioned element stays inside the 1280-wide viewBox
    for (const match of svg.matchAll(/\bx="(\d+)"/g)) {
      expect(Number(match[1])).toBeLessThanOrEqual(1280);
    }
    for (const match of svg.matchAll(/\by="(\d+)"/g)) {
      expect(Number(match[1])).toBeLessThanOrEqual(720);
    }
  });

  it('wraps long bullets on content slides instead of overflowing', () => {
    const bullet =
      'A towering figure of ancient Greek philosophy, Aristotle transformed nearly every field he touched from logic and biology to ethics and politics.';
    const svg = renderSlideSvg(
      { id: 's2', layout: 'title-bullets', title: 'Ideas', bullets: [bullet] },
      1,
      8,
      {
        background: '#0F172A',
        accent: '#38BDF8',
        text: '#F8FAFC',
        muted: '#94A3B8',
      },
    );
    expect(svg).toContain('<tspan');
    expect(svg).not.toContain(bullet.slice(0, 80));
  });

  it('builds an editable pptx buffer from deck JSON (no previews inside)', async () => {
    const builder = new SlidesBuilderService();
    const buffer = await builder.buildPptxBuffer({
      title: 'nietzsche-core-ideas-slides',
      theme: {
        background: '#0F172A',
        accent: '#38BDF8',
        text: '#F8FAFC',
        muted: '#94A3B8',
      },
      slides: [
        {
          id: 's1',
          layout: 'title',
          title: 'Opening',
          subtitle: 'Subtitle',
          bullets: [],
          body: '',
          notes: 'Speaker notes',
        },
        {
          id: 's2',
          layout: 'title-bullets',
          title: 'Ideas',
          subtitle: '',
          bullets: ['First', 'Second'],
          body: '',
          notes: '',
        },
      ],
    });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
    // OOXML zip signature: editable pptx, not a flattened image
    expect(buffer.subarray(0, 2).toString('ascii')).toBe('PK');
  });
});
