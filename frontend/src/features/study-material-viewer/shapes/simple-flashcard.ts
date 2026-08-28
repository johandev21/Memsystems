import { z } from "zod";

export const SimpleFlashcardContent = z.preprocess(
  (val) => {
    if (val && typeof val === "object" && "front" in val && "back" in val) {
      return {
        cards: [{ front: val.front, back: val.back }],
      };
    }
    return val;
  },
  z.object({
    title: z.string().max(200).optional(),
    cards: z
      .array(
        z.object({
          front: z.string().min(1).max(10000),
          back: z.string().min(1).max(10000),
        }),
      )
      .min(1)
      .max(100),
  }),
);

export type SimpleFlashcardContentType = z.infer<typeof SimpleFlashcardContent>;
