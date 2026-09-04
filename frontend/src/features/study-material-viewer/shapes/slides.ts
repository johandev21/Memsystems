import { z } from "zod";

export const SlideDesignPreset = z.enum([
  "dark",
  "light",
  "editorial",
  "academic",
  "technical",
  "warm",
]);

export type SlideDesignPresetType = z.infer<typeof SlideDesignPreset>;

export const SlideDesign = z.object({
  preset: SlideDesignPreset.optional(),
  background: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  surface: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  primary: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  secondary: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  text: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  muted: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  fontHeading: z.string().optional(),
  fontBody: z.string().optional(),
  radius: z.enum(["none", "small", "large", "pill"]).optional(),
  density: z.enum(["airy", "balanced", "dense"]).optional(),
  decoration: z.enum(["minimal", "geometric", "editorial", "diagrammatic"]).optional(),
});

export type SlideDesignType = z.infer<typeof SlideDesign>;

export const SlideElement = z.object({
  type: z.enum([
    "text",
    "bullet-list",
    "card-group",
    "comparison",
    "timeline",
    "process",
    "statistic",
    "quote",
    "shape",
  ]),
  text: z.string().optional(),
  items: z.array(z.string()).optional(),
  cards: z
    .array(z.object({ title: z.string(), body: z.string().optional() }))
    .optional(),
  columns: z.number().optional(),
  left: z
    .object({ heading: z.string(), points: z.array(z.string()) })
    .optional(),
  right: z
    .object({ heading: z.string(), points: z.array(z.string()) })
    .optional(),
  steps: z
    .array(z.object({ title: z.string(), body: z.string().optional() }))
    .optional(),
  value: z.string().optional(),
  label: z.string().optional(),
  context: z.string().optional(),
  quote: z.string().optional(),
  attribution: z.string().optional(),
  variant: z.string().optional(),
  style: z.record(z.string(), z.unknown()).optional(),
});

export type SlideElementType = z.infer<typeof SlideElement>;

/** A slide scene; legacy prose fields stay optional so old decks render. */
export const SlidesSlide = z.object({
  id: z.string(),
  role: z
    .enum([
      "title",
      "section",
      "content",
      "comparison",
      "timeline",
      "process",
      "statistic",
      "quote",
      "cards",
      "takeaways",
      "closing",
    ])
    .optional(),
  layout: z.enum(["title", "title-bullets", "two-column", "quote", "closing"]).optional(),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(500).optional(),
  bullets: z.array(z.string().min(1).max(500)).max(6).optional(),
  body: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
  speakerNotes: z.string().max(2000).optional(),
  elements: z.array(SlideElement).max(6).optional(),
});

export const SlidesPreview = z.object({
  slideId: z.string(),
  svg: z.string().min(1),
});

export const SlidesTheme = z.object({
  background: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  accent: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  text: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  muted: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});

export const SlidesContent = z.object({
  schemaVersion: z.literal(2).optional(),
  title: z.string().max(200).optional(),
  design: SlideDesign.optional(),
  theme: SlidesTheme.optional(),
  slides: z.array(SlidesSlide).min(1).max(20),
  previews: z.array(SlidesPreview).max(20).optional(),
});

export type SlidesContentType = z.infer<typeof SlidesContent>;
export type SlidesSlideType = z.infer<typeof SlidesSlide>;
