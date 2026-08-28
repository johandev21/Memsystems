import { z } from "zod";

export const QuizQuestionOption = z.object({
  id: z.string(),
  text: z.string().min(1).max(2000),
  explanation: z.string().min(1).max(2000),
});

export const QuizQuestion = z.object({
  id: z.string(),
  prompt: z.string().min(1).max(2000),
  options: z.array(QuizQuestionOption).min(2).max(6),
  correctOptionId: z.string(),
  hint: z.string().optional(),
  topic: z.string().optional(),
});

export const QuizContent = z.object({
  title: z.string().max(200).optional(),
  questions: z.array(QuizQuestion).min(1).max(50),
});

export type QuizContentType = z.infer<typeof QuizContent>;

interface QuizOption {
  id: string;
  text: string;
  explanation: string;
}

interface QuizQuestionData {
  options: QuizOption[];
  correctOptionId: string;
  [key: string]: unknown;
}

interface QuizContentData {
  questions: QuizQuestionData[];
}

export function shuffleQuizOptions(content: QuizContentData) {
  const shuffled: QuizContentData = {
    ...content,
    questions: content.questions.map((q) => {
      const pairs = [...q.options];
      for (let i = pairs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
      }
      return {
        ...q,
        options: pairs,
      };
    }),
  };
  return shuffled;
}
