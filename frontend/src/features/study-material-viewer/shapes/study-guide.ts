import { z } from "zod";

export const StudyGuideOptions = z.object({
  format: z.enum(["detailed", "revision", "auto"]).default("auto"),
  // 0 = auto.
  sectionCount: z.number().int().min(0).max(12).default(0),
});
export type StudyGuideGenerationOptions = z.infer<typeof StudyGuideOptions>;

export const StudyGuideSection = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  explanation: z.string().min(1).max(12000),
  keyConcepts: z.array(z.string().min(1).max(2000)).min(1).max(20),
  examples: z.array(z.string().min(1).max(4000)).max(5),
  misconceptions: z.array(z.string().min(1).max(2000)).max(10).default([]),
  takeaways: z.array(z.string().min(1).max(2000)).max(10).default([]),
  sourceIds: z.array(z.string().min(1).max(100)).max(100).default([]),
});

export const StudyGuideContent = z.object({
  title: z.string().min(1).max(200),
  overview: z.string().min(1).max(5000),
  learningObjectives: z.array(z.string().min(1).max(1000)).min(1).max(20),
  format: z.enum(["detailed", "revision"]).default("detailed"),
  sourceIds: z.array(z.string().min(1).max(100)).max(100).default([]),
  sections: z.array(StudyGuideSection).min(1).max(12),
});

export type StudyGuideContentType = z.infer<typeof StudyGuideContent>;
