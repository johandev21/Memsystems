import { designTokens } from './text-layout';
import type { SlideDesign } from '../slides-design.types';

export type ElementContext = {
  tokens: ReturnType<typeof designTokens>;
  design: SlideDesign;
  maxY: number;
};

export type ElementRender = { svg: string; nextY: number };
