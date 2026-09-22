import { describe, expect, it } from 'vitest';
import { normalizeQuizContent } from '../src/modules/study-materials/content-normalizer';
import { shuffleQuizOptions } from '../src/modules/study-materials/shapes';

describe('quiz answer identity', () => {
  it('converts legacy indexes to stable option IDs', () => {
    const content = normalizeQuizContent({
      title: 'Quiz',
      questions: [
        {
          id: 'question-1',
          prompt: 'Which option is correct?',
          options: [
            { text: 'Wrong', explanation: 'Incorrect.' },
            { text: 'Right', explanation: 'Correct.' },
          ],
          correctOptionIndex: 1,
        },
      ],
    });

    expect(content.questions[0].correctOptionId).toBe('q-0-o-1');
    expect(
      content.questions[0].options.find(
        (option: { id: string }) =>
          option.id === content.questions[0].correctOptionId,
      )?.text,
    ).toBe('Right');
  });

  it('keeps the correct option ID attached when options are shuffled', () => {
    const content = {
      title: 'Quiz',
      questions: [
        {
          id: 'question-1',
          prompt: 'Which option is correct?',
          options: [
            { id: 'wrong', text: 'Wrong', explanation: 'Incorrect.' },
            { id: 'right', text: 'Right', explanation: 'Correct.' },
          ],
          correctOptionId: 'right',
          hint: '',
          topic: '',
        },
      ],
      citations: [],
    };

    const shuffled = shuffleQuizOptions(content);
    const question = shuffled.questions[0];

    expect(question.correctOptionId).toBe('right');
    expect(question.options.find((option) => option.id === 'right')?.text).toBe(
      'Right',
    );
  });
});
