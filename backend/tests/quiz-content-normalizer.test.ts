import { describe, expect, it } from 'vitest';
import {
  generateTitle,
  normalizeQuizContent,
  sanitizeExplanation,
} from '../src/modules/study-materials/content-normalizer';
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

  it('sanitizes Spanish explanation prefixes without leaving residual "o"', () => {
    expect(sanitizeExplanation('Correcto: Esta opción es correcta.')).toBe(
      'Esta opción es correcta.',
    );
    expect(
      sanitizeExplanation('Incorrecto: Esa limitación describe IA reactiva.'),
    ).toBe('Esa limitación describe IA reactiva.');
    expect(sanitizeExplanation('o: esa limitación describe IA reactiva')).toBe(
      'esa limitación describe IA reactiva',
    );
    expect(sanitizeExplanation('o. esa limitación describe IA reactiva')).toBe(
      'esa limitación describe IA reactiva',
    );
  });

  it('recognizes Spanish explanation indicators during normalization and cleans explanations', () => {
    const content = normalizeQuizContent({
      title: 'Quiz en Español',
      questions: [
        {
          id: 'q1',
          prompt: '¿Cuál es correcta?',
          options: [
            { text: 'Primera', explanation: 'Incorrecto: no es verdad.' },
            {
              text: 'Segunda',
              explanation: 'Correcto: es la definición exacta.',
            },
          ],
        },
      ],
    });

    expect(content.questions[0].correctOptionId).toBe('q-0-o-1');
    expect(content.questions[0].options[0].explanation).toBe('no es verdad.');
    expect(content.questions[0].options[1].explanation).toBe(
      'es la definición exacta.',
    );
  });
});

describe('generateTitle Bloom Objective naming', () => {
  it('preserves natural Bloom Objective titles in Title Case', () => {
    expect(generateTitle('quiz', { title: 'Mastering Socratic Ethics' })).toBe(
      'Mastering Socratic Ethics',
    );
    expect(
      generateTitle('simple_flashcard', { title: 'Recalling Key Organelles' }),
    ).toBe('Recalling Key Organelles');
    expect(
      generateTitle('roadmap', {
        title: 'Navigating Modern European History',
      }),
    ).toBe('Navigating Modern European History');
  });

  it('strips accidental type suffixes', () => {
    expect(
      generateTitle('quiz', { title: 'Mastering Socratic Ethics-quiz' }),
    ).toBe('Mastering Socratic Ethics');
    expect(
      generateTitle('quiz', { title: 'Mastering Socratic Ethics (Quiz)' }),
    ).toBe('Mastering Socratic Ethics');
    expect(
      generateTitle('slides', {
        title: 'Exploring Nietzsche Philosophy-slides',
      }),
    ).toBe('Exploring Nietzsche Philosophy');
  });

  it('converts raw kebab-case or snake_case titles to Title Case', () => {
    expect(
      generateTitle('case_study', { title: 'clinic-triage-case-study' }),
    ).toBe('Clinic Triage');
    expect(
      generateTitle('mind_map', { title: 'operating_systems_mind_map' }),
    ).toBe('Operating Systems');
  });

  it('caps long titles to 50 characters', () => {
    const longTitle =
      'Mastering the Comprehensive Foundations of Advanced Differential Calculus';
    const result = generateTitle('quiz', { title: longTitle });
    expect(result.length).toBeLessThanOrEqual(50);
    expect(result).toBe('Mastering the Comprehensive Foundations of Advance');
  });

  it('provides default Bloom Objective title when title is empty or missing', () => {
    expect(generateTitle('quiz', {})).toBe('Mastering Quiz Concepts');
    expect(generateTitle('simple_flashcard', { title: '   ' })).toBe(
      'Recalling Flashcard Concepts',
    );
    expect(generateTitle('mind_map', null)).toBe('Mapping Core Concepts');
  });
});
