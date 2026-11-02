import { citationsField, isRecord, stringify, toArray } from './value-readers';

export type NormalizedQuizOption = {
  id: string;
  text: string;
  explanation: string;
};
export type NormalizedQuizQuestion = {
  id: string;
  prompt: string;
  options: NormalizedQuizOption[];
  correctOptionId: string;
};
export type NormalizedQuizContent = {
  title?: string;
  questions: NormalizedQuizQuestion[];
  citations: unknown[];
};

export function sanitizeExplanation(explanation: string): string {
  if (!explanation) return '';
  let cleaned = explanation
    .replace(
      /^(correct[oa]?s?|incorrect[oa]?s?|verdad(?:er[oa])?|fals[oa]|not quite|right answer|wrong answer|o)\s*([.:!\s-])\s*/i,
      '',
    )
    .trim();
  cleaned = cleaned
    .replace(
      /^(correct[oa]?s?|incorrect[oa]?s?|verdad(?:er[oa])?|fals[oa]|not quite|right answer|wrong answer)[.:!\s-]*/i,
      '',
    )
    .trim();
  return cleaned || explanation;
}

export function normalizeQuizContent(content: unknown): NormalizedQuizContent {
  let questions: unknown[];
  if (Array.isArray(content)) {
    questions = toArray(content);
  } else if (isRecord(content) && Array.isArray(content.questions)) {
    questions = toArray(content.questions);
  } else if (isRecord(content)) {
    const arrayKey = Object.keys(content).find((k) =>
      Array.isArray(content[k]),
    );
    questions = arrayKey ? toArray(content[arrayKey]) : [content];
  } else {
    questions = [content];
  }

  const normalizedQuestions = questions.map(
    (q, index): NormalizedQuizQuestion => {
      if (!isRecord(q)) {
        return {
          id: `q-${index}`,
          prompt: String(q),
          options: [
            { id: `q-${index}-o-0`, text: 'Option A', explanation: '' },
            { id: `q-${index}-o-1`, text: 'Option B', explanation: '' },
          ],
          correctOptionId: `q-${index}-o-0`,
        };
      }

      const prompt = q.prompt ?? q.question ?? q.text ?? q.title ?? 'Question';
      const rawOptions = q.options ?? q.choices ?? q.answers ?? [];
      const options: unknown[] = toArray(rawOptions);

      const normalizedOptions = options.map(
        (opt, optionIndex): NormalizedQuizOption => {
          if (typeof opt === 'string') {
            return {
              id: `q-${index}-o-${optionIndex}`,
              text: opt,
              explanation: 'Correct answer choice',
            };
          }
          const optRecord = isRecord(opt) ? opt : {};
          return {
            id: stringify(optRecord.id ?? `q-${index}-o-${optionIndex}`),
            text: stringify(
              optRecord.text ?? optRecord.choice ?? optRecord.value ?? 'Option',
            ),
            explanation: stringify(
              optRecord.explanation ?? optRecord.reason ?? 'Explanation',
            ),
          };
        },
      );

      while (normalizedOptions.length < 2) {
        normalizedOptions.push({
          id: `q-${index}-o-${normalizedOptions.length}`,
          text: `Option ${String.fromCharCode(65 + normalizedOptions.length)}`,
          explanation: 'Placeholder option',
        });
      }

      if (normalizedOptions.length > 6) {
        normalizedOptions.length = 6;
      }

      let correctOptionId: string | undefined;
      const rawCorrectId = q.correctOptionId ?? q.correct_option_id;
      if (typeof rawCorrectId === 'string') {
        const matchingOption = normalizedOptions.find(
          (opt) => opt.id === rawCorrectId,
        );
        if (matchingOption) {
          correctOptionId = matchingOption.id;
        }
      }

      let correctOptionIndex = -1;
      const rawCorrect =
        q.correctOptionIndex ??
        q.correct_option_index ??
        q.correctIndex ??
        q.correctAnswer ??
        q.correct_answer ??
        q.answer;

      if (!correctOptionId && typeof rawCorrect === 'number') {
        correctOptionIndex = rawCorrect;
      } else if (!correctOptionId && typeof rawCorrect === 'string') {
        const trimmed = rawCorrect.trim();
        if (/^[a-fA-F]$/.test(trimmed)) {
          correctOptionIndex = trimmed.toUpperCase().charCodeAt(0) - 65;
        } else if (/^option\s*([a-fA-F])$/i.test(trimmed)) {
          const letter = trimmed.match(/^option\s*([a-fA-F])$/i)![1];
          correctOptionIndex = letter.toUpperCase().charCodeAt(0) - 65;
        } else if (/^\d+$/.test(trimmed)) {
          correctOptionIndex = parseInt(trimmed, 10);
        } else {
          const idx = normalizedOptions.findIndex(
            (opt) => opt.text.trim().toLowerCase() === trimmed.toLowerCase(),
          );
          if (idx >= 0) {
            correctOptionIndex = idx;
          }
        }
      }

      if (
        !correctOptionId &&
        (correctOptionIndex < 0 ||
          correctOptionIndex >= normalizedOptions.length)
      ) {
        const explicitCorrectIdx = normalizedOptions.findIndex((opt) =>
          /^(correct[oa]?s?|verdad(?:er[oa])?|right)/i.test(
            opt.explanation.trim(),
          ),
        );
        if (explicitCorrectIdx >= 0) {
          correctOptionIndex = explicitCorrectIdx;
        }
      }

      if (
        !correctOptionId &&
        correctOptionIndex >= 0 &&
        correctOptionIndex < normalizedOptions.length
      ) {
        const currentOpt = normalizedOptions[correctOptionIndex];
        if (
          /^(incorrect[oa]?s?|fals[oa]|not quite)/i.test(
            currentOpt.explanation.trim(),
          )
        ) {
          const realCorrectIdx = normalizedOptions.findIndex((opt) =>
            /^(correct[oa]?s?|verdad(?:er[oa])?|right)/i.test(
              opt.explanation.trim(),
            ),
          );
          if (realCorrectIdx >= 0) {
            correctOptionIndex = realCorrectIdx;
          }
        }
      }

      if (
        !correctOptionId &&
        (correctOptionIndex < 0 ||
          correctOptionIndex >= normalizedOptions.length)
      ) {
        correctOptionIndex = Math.floor(
          Math.random() * normalizedOptions.length,
        );
      }

      if (!correctOptionId) {
        correctOptionId = normalizedOptions[correctOptionIndex].id;
      }

      const sanitizedOptions = normalizedOptions.map((opt) => ({
        ...opt,
        explanation: sanitizeExplanation(opt.explanation),
      }));

      return {
        id: typeof q.id === 'string' ? q.id : `q-${index}`,
        prompt: stringify(prompt),
        options: sanitizedOptions,
        correctOptionId,
      };
    },
  );

  return {
    title:
      isRecord(content) && content.title ? stringify(content.title) : undefined,
    questions: normalizedQuestions,
    citations: citationsField(content),
  };
}
