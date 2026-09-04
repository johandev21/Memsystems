import { z } from "zod";

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

export const SlidesSlide = z.object({
  id: z.string(),
  layout: z.enum(["title", "title-bullets", "two-column", "quote", "closing"]).optional(),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(500).optional(),
  bullets: z.array(z.string().min(1).max(500)).max(6).optional(),
  body: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
});

export const SlidesPreview = z.object({
  slideId: z.string(),
  svg: z.string().min(1),
});

export const SlidesContent = z.object({
  title: z.string().max(200).optional(),
  theme: SlidesTheme.optional(),
  slides: z.array(SlidesSlide).min(1).max(20),
  previews: z.array(SlidesPreview).max(20).optional(),
});

export type SlidesContentType = z.infer<typeof SlidesContent>;
export type SlidesSlideType = z.infer<typeof SlidesSlide>;
