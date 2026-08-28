import { z } from "zod";

export const RoadmapTopic = z.object({
  id: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  estimatedMinutes: z.number().int().min(0).optional(),
  order: z.number().int().min(0),
});

export const RoadmapPhase = z.object({
  id: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  order: z.number().int().min(0),
  topics: z.array(RoadmapTopic).max(100),
});

export const RoadmapContent = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  phases: z.array(RoadmapPhase).min(1).max(20),
});

export type RoadmapContentType = z.infer<typeof RoadmapContent>;
