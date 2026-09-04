import { z } from "zod";
import type { StudyMaterialKind } from "@/features/study-material-viewer";

export type { StudyMaterialKind };

const cuid = z.string().min(1).max(64);

const QuizOptionInput = z.object({
  id: cuid,
  text: z.string().min(0).max(2000),
  explanation: z.string().min(0).max(2000),
});

const QuizQuestionInput = z.object({
  id: cuid,
  prompt: z.string().min(0).max(2000),
  options: z.array(QuizOptionInput).min(2).max(6),
  correctOptionId: cuid,
  hint: z.string().optional(),
  topic: z.string().optional(),
});

export const QuizEditorContent = z.object({
  questions: z.array(QuizQuestionInput).min(1).max(50),
});
export type QuizEditorContentType = z.infer<typeof QuizEditorContent>;

export const FlashcardEditorContent = z.preprocess(
  (val) => {
    if (val && typeof val === "object" && "front" in val && "back" in val) {
      return {
        cards: [{ front: val.front, back: val.back }],
      };
    }
    return val;
  },
  z.object({
    cards: z
      .array(
        z.object({
          front: z.string().min(0).max(10000),
          back: z.string().min(0).max(10000),
        }),
      )
      .min(1)
      .max(100),
  }),
);
export type FlashcardEditorContentType = z.infer<typeof FlashcardEditorContent>;

const RoadmapTopicInput = z.object({
  id: cuid,
  title: z.string().min(0).max(200),
  description: z.string().max(5000).optional(),
  estimatedMinutes: z.number().int().min(0).optional(),
  order: z.number().int().min(0),
});

const RoadmapPhaseInput = z.object({
  id: cuid,
  title: z.string().min(0).max(200),
  description: z.string().max(5000).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  order: z.number().int().min(0),
  topics: z.array(RoadmapTopicInput).max(100),
});

export const RoadmapEditorContent = z.object({
  description: z.string().max(5000).optional(),
  phases: z.array(RoadmapPhaseInput).min(1).max(20),
});
export type RoadmapEditorContentType = z.infer<typeof RoadmapEditorContent>;

const SlidesSlideInput = z.object({
  id: cuid,
  layout: z.enum(["title", "title-bullets", "two-column", "quote", "closing"]).optional(),
  title: z.string().min(0).max(200),
  subtitle: z.string().max(500).optional(),
  bullets: z.array(z.string().max(500)).max(6).optional(),
  body: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
});

export const SlidesEditorContent = z.object({
  theme: z
    .object({
      background: z.string().optional(),
      accent: z.string().optional(),
      text: z.string().optional(),
      muted: z.string().optional(),
    })
    .optional(),
  slides: z.array(SlidesSlideInput).min(1).max(20),
});
export type SlidesEditorContentType = z.infer<typeof SlidesEditorContent>;

export function createEmptyStudyMaterial(kind: StudyMaterialKind): unknown {
  switch (kind) {
    case "quiz": {
      const optionAId = makeId();
      const optionBId = makeId();
      return {
        questions: [
          {
            id: makeId(),
            prompt: "Question 1",
            options: [
              { id: optionAId, text: "Option A", explanation: "Explanation A" },
              { id: optionBId, text: "Option B", explanation: "Explanation B" },
            ],
            correctOptionId: optionAId,
          },
        ],
      };
    }
    case "simple_flashcard":
      return { cards: [{ front: "Front", back: "Back" }] };
    case "roadmap":
      return {
        phases: [
          {
            id: makeId(),
            title: "Phase 1",
            description: "",
            order: 0,
            topics: [
              {
                id: makeId(),
                title: "Topic 1",
                description: "",
                order: 0,
              },
            ],
          },
        ],
      };
    case "mind_map":
      throw new Error(`createEmptyStudyMaterial is not implemented for kind "${kind}"`);
    case "slides":
      return {
        slides: [
          {
            id: makeId(),
            layout: "title",
            title: "Untitled Deck",
            subtitle: "",
            bullets: [],
          },
        ],
      };
  }
}

let counter = 0;
function makeId(): string {
  counter += 1;
  return `draft-${Date.now().toString(36)}-${counter.toString(36)}`;
}
