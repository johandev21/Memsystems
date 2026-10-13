import type { GenerationCitation } from './generation-citations';

export type SlideDesignPreset =
  'dark' | 'light' | 'editorial' | 'academic' | 'technical' | 'warm';

export type LegacySlidesThemeName = 'dark' | 'light' | 'accent';

export type SupportedFont =
  'Inter' | 'Arial' | 'Helvetica' | 'Georgia' | 'Verdana' | 'Times New Roman';

export const SUPPORTED_FONTS: readonly SupportedFont[] = [
  'Inter',
  'Arial',
  'Helvetica',
  'Georgia',
  'Verdana',
  'Times New Roman',
] as const;

export const FALLBACK_FONT: SupportedFont = 'Arial';

export type SlideDesign = {
  preset?: SlideDesignPreset;
  background: string;
  surface: string;
  primary: string;
  secondary: string;
  text: string;
  muted: string;
  fontHeading: SupportedFont;
  fontBody: SupportedFont;
  radius: 'none' | 'small' | 'large' | 'pill';
  density: 'airy' | 'balanced' | 'dense';
  decoration: 'minimal' | 'geometric' | 'editorial' | 'diagrammatic';
};

export type SlideRole =
  | 'title'
  | 'section'
  | 'content'
  | 'comparison'
  | 'timeline'
  | 'process'
  | 'statistic'
  | 'quote'
  | 'cards'
  | 'takeaways'
  | 'closing';

export const SLIDE_ROLES: readonly SlideRole[] = [
  'title',
  'section',
  'content',
  'comparison',
  'timeline',
  'process',
  'statistic',
  'quote',
  'cards',
  'takeaways',
  'closing',
] as const;

export type TextElementStyle = {
  variant?: 'heading' | 'body' | 'caption';
  align?: 'left' | 'center';
};

export type CardElement = {
  title: string;
  body?: string;
};

export type ComparisonColumn = {
  heading: string;
  points: string[];
};

export type TimelineStep = {
  title: string;
  body?: string;
};

export type ProcessStep = {
  title: string;
  body?: string;
};

export type ShapeVariant = 'accent-bar' | 'dots' | 'ring' | 'grid' | 'wave';

export type Position = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type SlideElement =
  | {
      type: 'text';
      text: string;
      style?: TextElementStyle;
      position?: Position;
    }
  | {
      type: 'bullet-list';
      items: string[];
      style?: { columns?: 1 | 2 };
      position?: Position;
    }
  | { type: 'card-group'; cards: CardElement[]; columns?: 2 | 3 }
  | { type: 'comparison'; left: ComparisonColumn; right: ComparisonColumn }
  | { type: 'timeline'; steps: TimelineStep[] }
  | { type: 'process'; steps: ProcessStep[] }
  | { type: 'statistic'; value: string; label: string; context?: string }
  | { type: 'quote'; quote: string; attribution?: string }
  | {
      type: 'shape';
      variant: ShapeVariant;
      emphasis?: 'primary' | 'secondary' | 'muted';
    };

export const SLIDE_ELEMENT_TYPES: readonly SlideElement['type'][] = [
  'text',
  'bullet-list',
  'card-group',
  'comparison',
  'timeline',
  'process',
  'statistic',
  'quote',
  'shape',
] as const;

export type SlideScene = {
  id: string;
  role: SlideRole;
  title: string;
  subtitle?: string;
  speakerNotes?: string;
  notes?: string;
  elements: SlideElement[];
};

export type SlideDeck = {
  schemaVersion: 2;
  title: string;
  design: SlideDesign;
  slides: SlideScene[];
  previews?: { slideId: string; svg: string }[];
  generalKnowledgeSupplement?: string;
  citations?: GenerationCitation[];
};

export type LegacySlidesSlide = {
  id: string;
  layout: 'title' | 'title-bullets' | 'two-column' | 'quote' | 'closing';
  title: string;
  subtitle?: string;
  bullets: string[];
  body?: string;
  notes?: string;
};

export type LegacySlidesContent = {
  title?: string;
  theme?: {
    background?: string;
    accent?: string;
    text?: string;
    muted?: string;
  };
  slides: LegacySlidesSlide[];
  previews?: { slideId: string; svg: string }[];
};
