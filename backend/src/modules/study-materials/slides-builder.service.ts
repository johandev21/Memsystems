import { Injectable } from '@nestjs/common';
import PptxGenJS from 'pptxgenjs';
import { resolveSlideDeck } from './slides-design-resolver';
import type {
  SlideDeck,
  SlideDesign,
  SlideElement,
  SlideScene,
} from './slides-design.types';

const DEFAULT_THEME = {
  background: '0F172A',
  accent: '38BDF8',
  text: 'F8FAFC',
  muted: '94A3B8',
};

function hex(input: string | undefined, fallback: string): string {
  if (typeof input === 'string' && /^#[0-9A-Fa-f]{6}$/.test(input)) {
    return input.replace('#', '');
  }
  return fallback;
}

function pptxFont(supported: string | undefined): string {
  // pptxgenjs fontFace must reference a font available on the viewer's
  // machine; the resolver already whitelists to these families.
  switch (supported) {
    case 'Georgia':
      return 'Georgia';
    case 'Times New Roman':
      return 'Times New Roman';
    case 'Helvetica':
      return 'Helvetica';
    case 'Verdana':
      return 'Verdana';
    case 'Inter':
      return 'Arial';
    case 'Arial':
    default:
      return 'Arial';
  }
}

type DeckTheme = {
  background: string;
  primary: string;
  secondary: string;
  surface: string;
  text: string;
  muted: string;
  fontHeading: string;
  fontBody: string;
};

function themeFromDesign(design: SlideDesign): DeckTheme {
  return {
    background: hex(design.background, DEFAULT_THEME.background),
    primary: hex(design.primary, DEFAULT_THEME.accent),
    secondary: hex(design.secondary, DEFAULT_THEME.accent),
    surface: hex(design.surface, DEFAULT_THEME.background),
    text: hex(design.text, DEFAULT_THEME.text),
    muted: hex(design.muted, DEFAULT_THEME.muted),
    fontHeading: pptxFont(design.fontHeading),
    fontBody: pptxFont(design.fontBody),
  };
}

const CENTERED_ROLES: ReadonlySet<string> = new Set([
  'title',
  'section',
  'closing',
]);

// pptxgenjs slide type (loose structural typing to avoid version coupling).

// Slide type derived from the library so helpers stay typed without
// coupling to a specific pptxgenjs version's exported type names.
type PptxSlide = ReturnType<InstanceType<typeof PptxGenJS>['addSlide']>;

function addChrome(
  pptSlide: PptxSlide,
  theme: DeckTheme,
  index: number,
  total: number,
): void {
  pptSlide.bkgd = theme.background;
  pptSlide.addShape('rect', {
    x: 0,
    y: 0,
    w: '100%',
    h: 0.08,
    fill: { color: theme.primary },
    line: { color: theme.primary },
  });
  pptSlide.addText(`SLIDE ${index + 1} / ${total}`, {
    x: 0.5,
    y: 0.25,
    w: 12.33,
    h: 0.3,
    fontSize: 9,
    color: theme.muted,
    fontFace: theme.fontBody,
  });
}

function addTitleBlock(
  pptSlide: PptxSlide,
  theme: DeckTheme,
  scene: SlideScene,
  y: number,
  center: boolean,
): number {
  pptSlide.addText(scene.title || 'Slide', {
    x: center ? 0.5 : 0.5,
    y,
    w: 12.33,
    h: 0.9,
    align: center ? 'center' : 'left',
    fontSize: center ? 36 : 28,
    bold: true,
    color: theme.text,
    fontFace: theme.fontHeading,
  });
  let cursor = y + 0.95;
  if (scene.subtitle) {
    pptSlide.addText(scene.subtitle, {
      x: 0.5,
      y: cursor,
      w: 12.33,
      h: 0.55,
      align: center ? 'center' : 'left',
      fontSize: 16,
      color: theme.muted,
      fontFace: theme.fontBody,
    });
    cursor += 0.6;
  }
  if (!center) {
    pptSlide.addShape('rect', {
      x: 0.5,
      y: cursor,
      w: 1.0,
      h: 0.06,
      fill: { color: theme.primary },
      line: { color: theme.primary },
    });
    cursor += 0.25;
  }
  return cursor;
}

function bulletParagraphs(items: string[]) {
  return items.map((item) => ({ text: item, options: { bullet: true } }));
}

function addElement(
  pptSlide: PptxSlide,
  theme: DeckTheme,
  element: SlideElement,
  cursor: { y: number },
  fullWidth: boolean,
): void {
  const W = 12.33;
  const X = 0.5;
  switch (element.type) {
    case 'text': {
      const variant = element.style?.variant ?? 'body';
      pptSlide.addText(element.text, {
        x: X,
        y: cursor.y,
        w: W,
        h: 0.8,
        align: element.style?.align === 'center' ? 'center' : 'left',
        fontSize: variant === 'heading' ? 20 : variant === 'caption' ? 12 : 15,
        italic: variant === 'caption',
        color: variant === 'caption' ? theme.muted : theme.text,
        fontFace: variant === 'heading' ? theme.fontHeading : theme.fontBody,
      });
      cursor.y += 0.9;
      break;
    }
    case 'bullet-list': {
      const items = element.items.slice(0, 6);
      if (element.style?.columns === 2) {
        const mid = Math.ceil(items.length / 2);
        pptSlide.addText(bulletParagraphs(items.slice(0, mid)), {
          x: X,
          y: cursor.y,
          w: 5.9,
          h: 3.0,
          fontSize: 14,
          color: theme.text,
          fontFace: theme.fontBody,
        });
        pptSlide.addText(bulletParagraphs(items.slice(mid)), {
          x: 6.9,
          y: cursor.y,
          w: 5.9,
          h: 3.0,
          fontSize: 14,
          color: theme.text,
          fontFace: theme.fontBody,
        });
        cursor.y += 2.4;
      } else {
        pptSlide.addText(bulletParagraphs(items), {
          x: X,
          y: cursor.y,
          w: W,
          h: 3.0,
          fontSize: 15,
          color: theme.text,
          fontFace: theme.fontBody,
        });
        cursor.y += Math.min(3.0, 0.45 * items.length + 0.6);
      }
      break;
    }
    case 'card-group': {
      const cards = element.cards.slice(0, 6);
      const cols = element.columns ?? (cards.length <= 2 ? 2 : 3);
      const gap = 0.25;
      const cardW = (W - gap * (cols - 1)) / cols;
      cards.forEach((card, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = X + col * (cardW + gap);
        const cy = cursor.y + row * 1.9;
        pptSlide.addShape('roundRect', {
          x: cx,
          y: cy,
          w: cardW,
          h: 1.65,
          fill: { color: theme.surface },
          line: { color: theme.primary, width: 1.5 },
        });
        pptSlide.addText(card.title, {
          x: cx + 0.2,
          y: cy + 0.15,
          w: cardW - 0.4,
          h: 0.5,
          fontSize: 14,
          bold: true,
          color: theme.text,
          fontFace: theme.fontHeading,
        });
        if (card.body) {
          pptSlide.addText(card.body, {
            x: cx + 0.2,
            y: cy + 0.65,
            w: cardW - 0.4,
            h: 0.85,
            fontSize: 11,
            color: theme.muted,
            fontFace: theme.fontBody,
          });
        }
      });
      cursor.y += Math.ceil(cards.length / cols) * 1.9 + 0.2;
      break;
    }
    case 'comparison': {
      const renderColumn = (
        heading: string,
        points: string[],
        cx: number,
        cw: number,
        accent: string,
      ) => {
        pptSlide.addShape('rect', {
          x: cx,
          y: cursor.y,
          w: 0.9,
          h: 0.06,
          fill: { color: accent },
          line: { color: accent },
        });
        pptSlide.addText(heading, {
          x: cx,
          y: cursor.y + 0.12,
          w: cw,
          h: 0.5,
          fontSize: 15,
          bold: true,
          color: theme.text,
          fontFace: theme.fontHeading,
        });
        pptSlide.addText(bulletParagraphs(points.slice(0, 4)), {
          x: cx,
          y: cursor.y + 0.65,
          w: cw,
          h: 2.2,
          fontSize: 13,
          color: theme.text,
          fontFace: theme.fontBody,
        });
      };
      renderColumn(
        element.left.heading,
        element.left.points,
        X,
        5.9,
        theme.primary,
      );
      renderColumn(
        element.right.heading,
        element.right.points,
        6.9,
        5.9,
        theme.secondary,
      );
      cursor.y += 3.0;
      break;
    }
    case 'timeline':
    case 'process': {
      // Native editable shapes: one rounded box per step with a number badge.
      const steps = element.steps.slice(0, 6);
      const cols = steps.length <= 3 ? steps.length : 3;
      const gap = 0.25;
      const cardW = (W - gap * (cols - 1)) / cols;
      steps.forEach((step, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = X + col * (cardW + gap);
        const cy = cursor.y + row * 1.9;
        pptSlide.addShape('roundRect', {
          x: cx,
          y: cy,
          w: cardW,
          h: 1.65,
          fill: { color: theme.surface },
          line: { color: theme.primary, width: 1.5 },
        });
        pptSlide.addText(
          element.type === 'process' ? `${i + 1}. ${step.title}` : step.title,
          {
            x: cx + 0.2,
            y: cy + 0.15,
            w: cardW - 0.4,
            h: 0.5,
            fontSize: 13,
            bold: true,
            color: theme.text,
            fontFace: theme.fontHeading,
          },
        );
        if (step.body) {
          pptSlide.addText(step.body, {
            x: cx + 0.2,
            y: cy + 0.65,
            w: cardW - 0.4,
            h: 0.85,
            fontSize: 11,
            color: theme.muted,
            fontFace: theme.fontBody,
          });
        }
      });
      cursor.y += Math.ceil(steps.length / cols) * 1.9 + 0.2;
      break;
    }
    case 'statistic': {
      pptSlide.addText(element.value, {
        x: X,
        y: cursor.y,
        w: W,
        h: 1.1,
        align: 'center',
        fontSize: 54,
        bold: true,
        color: theme.primary,
        fontFace: theme.fontHeading,
      });
      cursor.y += 1.15;
      pptSlide.addText(element.label, {
        x: X,
        y: cursor.y,
        w: W,
        h: 0.5,
        align: 'center',
        fontSize: 18,
        bold: true,
        color: theme.text,
        fontFace: theme.fontHeading,
      });
      cursor.y += 0.55;
      if (element.context) {
        pptSlide.addText(element.context, {
          x: 2.5,
          y: cursor.y,
          w: 8.33,
          h: 0.7,
          align: 'center',
          fontSize: 13,
          color: theme.muted,
          fontFace: theme.fontBody,
        });
        cursor.y += 0.75;
      }
      break;
    }
    case 'quote': {
      pptSlide.addShape('rect', {
        x: X,
        y: cursor.y,
        w: 0.08,
        h: 2.6,
        fill: { color: theme.primary },
        line: { color: theme.primary },
      });
      pptSlide.addText(element.quote, {
        x: X + 0.4,
        y: cursor.y,
        w: W - 0.5,
        h: 1.7,
        fontSize: 24,
        italic: true,
        color: theme.text,
        fontFace: 'Georgia',
      });
      cursor.y += 1.8;
      if (element.attribution) {
        pptSlide.addText(element.attribution, {
          x: X + 0.4,
          y: cursor.y,
          w: W - 0.5,
          h: 0.5,
          fontSize: 14,
          color: theme.primary,
          fontFace: theme.fontBody,
        });
        cursor.y += 0.55;
      }
      break;
    }
    case 'shape': {
      // Decorative only: a small native accent bar (editable, harmless).
      pptSlide.addShape('rect', {
        x: fullWidth ? X : X,
        y: cursor.y,
        w: 1.0,
        h: 0.06,
        fill: { color: theme.primary },
        line: { color: theme.primary },
      });
      cursor.y += 0.2;
      break;
    }
    default:
      break;
  }
}

@Injectable()
export class SlidesBuilderService {
  async buildPptxBuffer(content: unknown): Promise<Buffer> {
    const deck: SlideDeck = resolveSlideDeck(content);
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'memsystems';
    pptx.title = deck.title || 'Slides';

    const theme = themeFromDesign(deck.design);

    deck.slides.forEach((scene, index) => {
      const pptSlide = pptx.addSlide();
      addChrome(pptSlide, theme, index, deck.slides.length);
      const center = CENTERED_ROLES.has(scene.role);
      const cursorY = addTitleBlock(
        pptSlide,
        theme,
        scene,
        center ? 2.0 : 0.7,
        center,
      );
      const cursor = { y: Math.min(cursorY, 5.6) };
      for (const element of scene.elements) {
        if (cursor.y > 6.4) break;
        addElement(pptSlide, theme, element, cursor, true);
      }
      const notes = scene.speakerNotes ?? scene.notes;
      if (notes) {
        pptSlide.addNotes(notes);
      }
    });

    const output = (await pptx.write({
      outputType: 'nodebuffer',
    })) as unknown;
    if (Buffer.isBuffer(output)) return output;
    if (output instanceof Uint8Array) return Buffer.from(output);
    if (typeof output === 'string') return Buffer.from(output, 'base64');
    return Buffer.from(output as ArrayBuffer);
  }
}
