import { z } from "zod";

export const PracticeProblemWorkedStep = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  explanation: z.string().min(1).max(12000),
  sourceIds: z.array(z.string().min(1).max(100)).max(100).default([]),
});

export const PracticeProblem = z.object({
  id: z.string().min(1).max(100),
  prompt: z.string().min(1).max(5000),
  givens: z.array(z.string().min(1).max(2000)).max(10).default([]),
  constraints: z.array(z.string().min(1).max(2000)).max(10).default([]),
  hints: z.array(z.string().min(1).max(2000)).max(5).default([]),
  steps: z.array(PracticeProblemWorkedStep).min(1).max(12),
  answer: z.string().min(1).max(12000),
  checklist: z.array(z.string().min(1).max(1000)).max(10).default([]),
  acceptableAlternatives: z.array(z.string().min(1).max(2000)).max(10).default([]),
  sourceIds: z.array(z.string().min(1).max(100)).max(100).default([]),
});

export const PracticeProblemsContent = z.object({
  title: z.string().min(1).max(200),
  overview: z.string().max(5000).default(""),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  sourceIds: z.array(z.string().min(1).max(100)).max(100).default([]),
  problems: z.array(PracticeProblem).min(1).max(30),
});

export const ProblemEvaluationSchema = z.object({
  status: z.enum(["correct", "partially_correct", "needs_improvement"]),
  feedback: z.string(),
  strengths: z.array(z.string()).default([]),
  missingPoints: z.array(z.string()).default([]),
});

export type PracticeProblemStepType = z.infer<typeof PracticeProblemWorkedStep>;
export type PracticeProblemType = z.infer<typeof PracticeProblem>;
export type PracticeProblemsContentType = z.infer<typeof PracticeProblemsContent>;
export type PracticeProblemsDifficulty = "easy" | "medium" | "hard";
export type ProblemEvaluationResult = z.infer<typeof ProblemEvaluationSchema>;
