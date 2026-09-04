import { z } from 'zod';
import {
  FALLBACK_FONT,
  SLIDE_ELEMENT_TYPES,
  SLIDE_ROLES,
  SUPPORTED_FONTS,
} from './slides-design.types';

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const SlideDesignPresetSchema = z.enum([
  'dark',
  'light',
  'editorial',
  'academic',
  'technical',
  'warm',
]);

export const SupportedFontSchema = z.enum([
  'Inter',
  'Arial',
  'Helvetica',
  'Georgia',
  'Verdana',
  'Times New Roman',
]);

export const SlideDesignSchema = z.object({
  preset: SlideDesignPresetSchema.optional(),
  background: hexColor,
  surface: hexColor,
  primary: hexColor,
  secondary: hexColor,
  text: hexColor,
  muted: hexColor,
  fontHeading: SupportedFontSchema.default('Inter' as never).catch(
    FALLBACK_FONT,
  ),
  fontBody: SupportedFontSchema.default('Inter' as never).catch(FALLBACK_FONT),
  radius: z
    .enum(['none', 'small', 'large', 'pill'])
    .default('small')
    .catch('small' as never),
  density: z
    .enum(['airy', 'balanced', 'dense'])
    .default('balanced')
    .catch('balanced' as never),
  decoration: z
    .enum(['minimal', 'geometric', 'editorial', 'diagrammatic'])
    .default('minimal')
    .catch('minimal' as never),
});

const positionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  w: z.number().finite().positive(),
  h: z.number().finite().positive(),
});

const textElementSchema = z.object({
  type: z.literal('text'),
  text: z.string().min(1).max(2000),
  style: z
    .object({
      variant: z.enum(['heading', 'body', 'caption']).optional(),
      align: z.enum(['left', 'center']).optional(),
    })
    .optional(),
  position: positionSchema.optional(),
});

const bulletListElementSchema = z.object({
  type: z.literal('bullet-list'),
  items: z.array(z.string().min(1).max(500)).min(1).max(6),
  style: z
    .object({ columns: z.union([z.literal(1), z.literal(2)]).optional() })
    .optional(),
  position: positionSchema.optional(),
});

const cardElementSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(500).optional(),
});

const cardGroupElementSchema = z.object({
  type: z.literal('card-group'),
  cards: z.array(cardElementSchema).min(1).max(6),
  columns: z.union([z.literal(2), z.literal(3)]).optional(),
});

const comparisonColumnSchema = z.object({
  heading: z.string().min(1).max(200),
  points: z.array(z.string().min(1).max(500)).min(1).max(6),
});

const comparisonElementSchema = z.object({
  type: z.literal('comparison'),
  left: comparisonColumnSchema,
  right: comparisonColumnSchema,
});

const timelineStepSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(500).optional(),
});

const timelineElementSchema = z.object({
  type: z.literal('timeline'),
  steps: z.array(timelineStepSchema).min(2).max(6),
});

const processStepSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(500).optional(),
});

const processElementSchema = z.object({
  type: z.literal('process'),
  steps: z.array(processStepSchema).min(2).max(6),
});

const statisticElementSchema = z.object({
  type: z.literal('statistic'),
  value: z.string().min(1).max(60),
  label: z.string().min(1).max(200),
  context: z.string().max(500).optional(),
});

const quoteElementSchema = z.object({
  type: z.literal('quote'),
  quote: z.string().min(1).max(1000),
  attribution: z.string().max(200).optional(),
});

const shapeElementSchema = z.object({
  type: z.literal('shape'),
  variant: z.enum(['accent-bar', 'dots', 'ring', 'grid', 'wave']),
  emphasis: z.enum(['primary', 'secondary', 'muted']).optional(),
});

export const SlideElementSchema = z.discriminatedUnion('type', [
  textElementSchema,
  bulletListElementSchema,
  cardGroupElementSchema,
  comparisonElementSchema,
  timelineElementSchema,
  processElementSchema,
  statisticElementSchema,
  quoteElementSchema,
  shapeElementSchema,
]);

export const SlideSceneSchema = z.object({
  id: z.string().min(1).max(200),
  role: z
    .enum(SLIDE_ROLES as unknown as [string, ...string[]])
    .default('content')
    .catch('content'),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(500).optional(),
  speakerNotes: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
  elements: z.array(SlideElementSchema).max(6).default([]),
});

export const SlideDeckSchema = z.object({
  schemaVersion: z.literal(2).default(2),
  title: z.string().max(200).default('slides'),
  design: SlideDesignSchema,
  slides: z.array(SlideSceneSchema).min(1).max(20),
  previews: z
    .array(
      z.object({ slideId: z.string(), svg: z.string().min(1).max(200000) }),
    )
    .max(20)
    .optional(),
});

export type SlideDeckInput = z.input<typeof SlideDeckSchema>;
export type SlideDeckOutput = z.output<typeof SlideDeckSchema>;

export function isStructuredSlidesContent(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.schemaVersion === 2) return true;
  if (record.design && typeof record.design === 'object') return true;
  const slides = record.slides;
  if (!Array.isArray(slides) || slides.length === 0) return false;
  const first: unknown = slides[0];
  if (typeof first !== 'object' || first === null) return false;
  const scene = first as Record<string, unknown>;
  if ('role' in scene && typeof scene.role === 'string') return true;
  if ('elements' in scene && Array.isArray(scene.elements)) return true;
  return false;
}

export { FALLBACK_FONT, SLIDE_ELEMENT_TYPES, SLIDE_ROLES, SUPPORTED_FONTS };
