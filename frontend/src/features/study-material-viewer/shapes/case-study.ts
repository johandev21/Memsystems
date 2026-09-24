import { z } from "zod";

export const CaseStudyOptions = z.object({
  // 0 = auto.
  questionCount: z.number().int().min(0).max(10).default(0),
  focus: z.string().max(2000).default(""),
  comparePerspectives: z.enum(["auto", "single", "compare"]).default("auto"),
});
export type CaseStudyGenerationOptions = z.infer<typeof CaseStudyOptions>;

export const CaseStudyConceptApplication = z.object({
  concept: z.string().min(1).max(500),
  application: z.string().min(1).max(4000),
  sourceIds: z.array(z.string().min(1).max(100)).max(100).default([]),
});

export const CaseStudyAlternativePerspective = z.object({
  viewpoint: z.string().min(1).max(500),
  reasoning: z.string().min(1).max(4000),
  sourceIds: z.array(z.string().min(1).max(100)).max(100).default([]),
});

export const CaseStudyQuestion = z.object({
  id: z.string().min(1).max(100),
  prompt: z.string().min(1).max(5000),
  hint: z.string().max(2000).default(""),
});

export const CaseStudyAnalysis = z.object({
  questionId: z.string().min(1).max(100),
  reasoning: z.string().min(1).max(12000),
  keyPoints: z.array(z.string().min(1).max(2000)).max(10).default([]),
  conceptApplications: z.array(CaseStudyConceptApplication).max(10).default([]),
  assumptions: z.array(z.string().min(1).max(2000)).max(10).default([]),
  tradeoffs: z.array(z.string().min(1).max(2000)).max(10).default([]),
  alternativePerspectives: z.array(CaseStudyAlternativePerspective).max(10).default([]),
  checklist: z.array(z.string().min(1).max(1000)).max(10).default([]),
  sourceIds: z.array(z.string().min(1).max(100)).max(100).default([]),
});

export const CaseStudyScenario = z.object({
  title: z.string().min(1).max(200).default("Scenario"),
  setting: z.string().min(1).max(5000),
  narrative: z.string().min(1).max(15000),
  isFictional: z.boolean().default(true),
});

export const CaseStudyContent = z.object({
  title: z.string().min(1).max(200),
  learningObjectives: z.array(z.string().min(1).max(1000)).min(1).max(20),
  scenario: CaseStudyScenario,
  facts: z.array(z.string().min(1).max(2000)).max(20).default([]),
  questions: z.array(CaseStudyQuestion).min(1).max(10),
  analyses: z.array(CaseStudyAnalysis).max(10).default([]),
  conceptsFocus: z.string().max(2000).default(""),
  sourceIds: z.array(z.string().min(1).max(100)).max(100).default([]),
});

export type CaseStudyQuestionType = z.infer<typeof CaseStudyQuestion>;
export type CaseStudyAnalysisType = z.infer<typeof CaseStudyAnalysis>;
export type CaseStudyContentType = z.infer<typeof CaseStudyContent>;
