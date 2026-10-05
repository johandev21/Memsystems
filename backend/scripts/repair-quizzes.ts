import dotenv from 'dotenv';
import { eq } from 'drizzle-orm';
import { createDatabaseConnection } from '../src/database/connection';
import { studyMaterials } from '../src/database/schema';
import { sanitizeExplanation } from '../src/modules/study-materials/content-normalizer';
import {
  shuffleQuizOptions,
  type QuizContent,
} from '../src/modules/study-materials/shapes';
import type { z } from 'zod';

dotenv.config({ path: '.env' });

async function main() {
  const { db, pool } = createDatabaseConnection();
  try {
    const quizzes = await db
      .select()
      .from(studyMaterials)
      .where(eq(studyMaterials.kind, 'quiz'));

    console.log(`Found ${quizzes.length} quizzes to repair.`);

    for (const quiz of quizzes) {
      const content = quiz.content as z.infer<typeof QuizContent>;
      if (!content || !Array.isArray(content.questions)) continue;

      const cleanedContent = {
        ...content,
        questions: content.questions.map((q) => ({
          ...q,
          options: q.options.map((opt) => ({
            ...opt,
            explanation: sanitizeExplanation(opt.explanation),
          })),
        })),
      };

      const shuffledContent = shuffleQuizOptions(cleanedContent);

      await db
        .update(studyMaterials)
        .set({ content: shuffledContent })
        .where(eq(studyMaterials.id, quiz.id));

      console.log(`Repaired and shuffled quiz ${quiz.id} ("${quiz.title}")`);
    }
    console.log('Quiz repair completed successfully.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
