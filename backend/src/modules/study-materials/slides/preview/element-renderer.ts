import type { ElementContext } from './element-context';
import {
  renderCardGroupElement,
  renderComparisonElement,
} from './cards-comparison';
import {
  renderProcessElement,
  renderTimelineElement,
} from './timeline-process';
import { renderStatisticElement, shapeSvg } from './statistic-shape';
import {
  renderBulletListElement,
  renderQuoteElement,
  renderTextElement,
} from './text-list-quote';
import type { SlideElement } from '../slides-design.types';

export function renderSceneElement(
  element: SlideElement,
  ctx: ElementContext,
  x: number,
  y: number,
  width: number,
  center: boolean,
): { svg: string; nextY: number } {
  switch (element.type) {
    case 'text':
      return renderTextElement(element.text, element.style, ctx, x, y, width);
    case 'bullet-list':
      return renderBulletListElement(
        element.items,
        element.style?.columns,
        ctx,
        x,
        y,
        width,
        center,
      );
    case 'card-group':
      return renderCardGroupElement(
        element.cards,
        element.columns,
        ctx,
        x,
        y,
        width,
      );
    case 'comparison':
      return renderComparisonElement(
        element.left,
        element.right,
        ctx,
        x,
        y,
        width,
      );
    case 'timeline':
      return renderTimelineElement(element.steps, ctx, x, y, width);
    case 'process':
      return renderProcessElement(element.steps, ctx, x, y, width);
    case 'statistic':
      return renderStatisticElement(
        element.value,
        element.label,
        element.context,
        ctx,
        x,
        y,
        width,
      );
    case 'quote':
      return renderQuoteElement(
        element.quote,
        element.attribution,
        ctx,
        x,
        y,
        width,
      );
    case 'shape': {
      const rendered = shapeSvg(
        element.variant,
        element.emphasis,
        ctx.design,
        x,
        y,
        width,
      );
      if (y + rendered.height > ctx.maxY) return { svg: '', nextY: y };
      return { svg: rendered.svg, nextY: y + rendered.height + 8 };
    }
    default:
      return { svg: '', nextY: y };
  }
}
