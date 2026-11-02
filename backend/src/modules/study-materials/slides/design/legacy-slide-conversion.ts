import type {
  LegacySlidesSlide,
  SlideElement,
  SlideRole,
  SlideScene,
} from '../slides-design.types';
import { clampText, MAX_ELEMENTS_PER_SLIDE } from './design-values';

export function legacySlideToScene(
  slide: LegacySlidesSlide,
  index: number,
): SlideScene {
  const id = slide.id && slide.id.trim() ? slide.id : `slide-${index + 1}`;
  const title = clampText(
    (slide.title || `Slide ${index + 1}`).trim() || `Slide ${index + 1}`,
    200,
  );
  const subtitle = slide.subtitle?.trim()
    ? clampText(slide.subtitle.trim(), 500)
    : undefined;
  const speakerNotes = slide.notes?.trim()
    ? clampText(slide.notes.trim(), 2000)
    : undefined;
  const bullets = (slide.bullets ?? [])
    .map((bullet) => bullet.trim())
    .filter((bullet) => bullet.length > 0)
    .slice(0, 6)
    .map((bullet) => clampText(bullet, 500));
  const body = slide.body?.trim()
    ? clampText(slide.body.trim(), 2000)
    : undefined;

  const roleForLayout = (layout: LegacySlidesSlide['layout']): SlideRole => {
    switch (layout) {
      case 'title':
        return 'title';
      case 'quote':
        return 'quote';
      case 'closing':
        return 'closing';
      case 'two-column':
        return 'content';
      case 'title-bullets':
      default:
        return 'content';
    }
  };

  const twoColumn = slide.layout === 'two-column';
  const elements: SlideElement[] = [];

  if (slide.layout === 'quote') {
    elements.push({
      type: 'quote',
      quote: clampText(body || bullets[0] || title, 1000),
      ...(subtitle ? { attribution: subtitle } : {}),
    });
    if (bullets.length > 1) {
      elements.push({ type: 'bullet-list', items: bullets.slice(1) });
    } else if (bullets.length === 1 && body) {
      elements.push({ type: 'bullet-list', items: bullets });
    }
  } else {
    if (bullets.length > 0) {
      elements.push({
        type: 'bullet-list',
        items: bullets,
        ...(twoColumn ? { style: { columns: 2 as const } } : {}),
      });
    }
    if (body) {
      elements.push({
        type: 'text',
        text: body,
        style: { variant: 'body' as const },
      });
    }
    if (
      elements.length === 0 &&
      subtitle &&
      roleForLayout(slide.layout) === 'content'
    ) {
      elements.push({
        type: 'text',
        text: subtitle,
        style: { variant: 'body' as const },
      });
    }
  }

  return {
    id,
    role: roleForLayout(slide.layout),
    title,
    ...(subtitle ? { subtitle } : {}),
    ...(speakerNotes ? { speakerNotes } : {}),
    elements: elements.slice(0, MAX_ELEMENTS_PER_SLIDE),
  };
}
