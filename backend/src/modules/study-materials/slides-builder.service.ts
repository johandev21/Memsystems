import { Injectable } from '@nestjs/common';
import PptxGenJS from 'pptxgenjs';

type SlidesTheme = {
  background?: string;
  accent?: string;
  text?: string;
  muted?: string;
};

type SlidesSlide = {
  id: string;
  layout?: 'title' | 'title-bullets' | 'two-column' | 'quote' | 'closing';
  title: string;
  subtitle?: string;
  bullets?: string[];
  body?: string;
  notes?: string;
};

type SlidesDeck = {
  title: string;
  theme?: SlidesTheme;
  slides: SlidesSlide[];
};

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

@Injectable()
export class SlidesBuilderService {
  async buildPptxBuffer(content: unknown): Promise<Buffer> {
    const deck = content as SlidesDeck;
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'memsystems';
    pptx.title = deck.title || 'Slides';

    const theme = {
      background: hex(deck.theme?.background, DEFAULT_THEME.background),
      accent: hex(deck.theme?.accent, DEFAULT_THEME.accent),
      text: hex(deck.theme?.text, DEFAULT_THEME.text),
      muted: hex(deck.theme?.muted, DEFAULT_THEME.muted),
    };

    deck.slides.forEach((slide, index) => {
      const pptSlide = pptx.addSlide();
      pptSlide.bkgd = theme.background;

      // Accent top bar (native shape, editable)
      pptSlide.addShape('rect', {
        x: 0,
        y: 0,
        w: '100%',
        h: 0.08,
        fill: { color: theme.accent },
        line: { color: theme.accent },
      });

      // Slide counter (native text, editable)
      pptSlide.addText(`SLIDE ${index + 1} / ${deck.slides.length}`, {
        x: 0.5,
        y: 0.25,
        w: 12.33,
        h: 0.3,
        fontSize: 9,
        color: theme.muted,
        fontFace: 'Arial',
      });

      const layout = slide.layout ?? 'title-bullets';
      const title = slide.title || `Slide ${index + 1}`;
      const subtitle = slide.subtitle ?? '';
      const bullets = (slide.bullets ?? []).slice(0, 6);
      const body = slide.body ?? '';

      if (layout === 'title' || layout === 'closing') {
        pptSlide.addText(title, {
          x: 0.5,
          y: 2.2,
          w: 12.33,
          h: 1.2,
          align: 'center',
          fontSize: 36,
          bold: true,
          color: theme.text,
          fontFace: 'Arial',
        });
        if (subtitle) {
          pptSlide.addText(subtitle, {
            x: 0.5,
            y: 3.4,
            w: 12.33,
            h: 0.8,
            align: 'center',
            fontSize: 18,
            color: theme.muted,
            fontFace: 'Arial',
          });
        }
        if (bullets.length > 0) {
          pptSlide.addText(
            bullets.map((b) => ({ text: b, options: { bullet: true } })),
            {
              x: 3.5,
              y: 4.3,
              w: 6.33,
              h: 2.2,
              fontSize: 16,
              color: theme.text,
              fontFace: 'Arial',
            },
          );
        } else if (body) {
          pptSlide.addText(body, {
            x: 2.5,
            y: 4.3,
            w: 8.33,
            h: 1.5,
            align: 'center',
            fontSize: 16,
            color: theme.text,
            fontFace: 'Arial',
          });
        }
      } else if (layout === 'quote') {
        pptSlide.addShape('rect', {
          x: 0.5,
          y: 1.2,
          w: 0.08,
          h: 4.5,
          fill: { color: theme.accent },
          line: { color: theme.accent },
        });
        pptSlide.addText(title, {
          x: 0.9,
          y: 1.8,
          w: 11.5,
          h: 1.5,
          fontSize: 28,
          italic: true,
          color: theme.text,
          fontFace: 'Georgia',
        });
        if (body) {
          pptSlide.addText(body, {
            x: 0.9,
            y: 3.4,
            w: 11.5,
            h: 1.2,
            fontSize: 16,
            color: theme.muted,
            fontFace: 'Arial',
          });
        }
        if (subtitle) {
          pptSlide.addText(subtitle, {
            x: 0.9,
            y: 4.6,
            w: 11.5,
            h: 0.6,
            fontSize: 14,
            color: theme.accent,
            fontFace: 'Arial',
          });
        }
      } else if (layout === 'two-column') {
        pptSlide.addText(title, {
          x: 0.5,
          y: 0.7,
          w: 12.33,
          h: 0.8,
          fontSize: 28,
          bold: true,
          color: theme.text,
          fontFace: 'Arial',
        });
        if (subtitle) {
          pptSlide.addText(subtitle, {
            x: 0.5,
            y: 1.45,
            w: 12.33,
            h: 0.5,
            fontSize: 16,
            color: theme.muted,
            fontFace: 'Arial',
          });
        }
        pptSlide.addShape('rect', {
          x: 0.5,
          y: 2.05,
          w: 1.0,
          h: 0.06,
          fill: { color: theme.accent },
          line: { color: theme.accent },
        });
        const mid = Math.ceil(bullets.length / 2);
        const left = bullets.slice(0, mid);
        const right = bullets.slice(mid);
        if (left.length > 0) {
          pptSlide.addText(
            left.map((b) => ({ text: b, options: { bullet: true } })),
            {
              x: 0.5,
              y: 2.4,
              w: 5.9,
              h: 3.5,
              fontSize: 15,
              color: theme.text,
              fontFace: 'Arial',
            },
          );
        }
        if (right.length > 0) {
          pptSlide.addText(
            right.map((b) => ({ text: b, options: { bullet: true } })),
            {
              x: 6.9,
              y: 2.4,
              w: 5.9,
              h: 3.5,
              fontSize: 15,
              color: theme.text,
              fontFace: 'Arial',
            },
          );
        }
      } else {
        pptSlide.addText(title, {
          x: 0.5,
          y: 0.7,
          w: 12.33,
          h: 0.8,
          fontSize: 28,
          bold: true,
          color: theme.text,
          fontFace: 'Arial',
        });
        if (subtitle) {
          pptSlide.addText(subtitle, {
            x: 0.5,
            y: 1.45,
            w: 12.33,
            h: 0.5,
            fontSize: 16,
            color: theme.muted,
            fontFace: 'Arial',
          });
        }
        pptSlide.addShape('rect', {
          x: 0.5,
          y: 2.05,
          w: 1.0,
          h: 0.06,
          fill: { color: theme.accent },
          line: { color: theme.accent },
        });
        if (bullets.length > 0) {
          pptSlide.addText(
            bullets.map((b) => ({ text: b, options: { bullet: true } })),
            {
              x: 0.5,
              y: 2.4,
              w: 12.33,
              h: 3.2,
              fontSize: 16,
              color: theme.text,
              fontFace: 'Arial',
            },
          );
        }
        if (body) {
          pptSlide.addText(body, {
            x: 0.5,
            y: 5.9,
            w: 12.33,
            h: 0.8,
            fontSize: 13,
            color: theme.muted,
            fontFace: 'Arial',
          });
        }
      }

      if (slide.notes) {
        pptSlide.addNotes(slide.notes);
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
