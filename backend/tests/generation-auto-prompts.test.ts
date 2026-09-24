import { describe, expect, it } from 'vitest';
import { getPromptTemplate } from '../src/modules/study-materials/prompts';
import type { StudyMaterialKind } from '../src/modules/study-materials/shapes';

type PromptOptions = Parameters<
  ReturnType<typeof getPromptTemplate>['user']
>[2];

const brief = 'Focus on the light-dependent reactions.';
const source = 'Photosynthesis converts light into chemical energy.';

function promptFor(kind: StudyMaterialKind, options: PromptOptions): string {
  return getPromptTemplate(kind).user(brief, source, options);
}

const autoCases: Array<{ kind: StudyMaterialKind; options: PromptOptions }> = [
  { kind: 'quiz', options: { questionCount: 0, difficulty: 'auto' } },
  {
    kind: 'simple_flashcard',
    options: { questionCount: 0, difficulty: 'auto', cardStyle: 'auto' },
  },
  {
    kind: 'roadmap',
    options: { roadmapOptions: { phaseCount: 0, detailLevel: 'auto' } },
  },
  {
    kind: 'mind_map',
    options: {
      mindMapOptions: {
        nodeCount: 0,
        structure: 'radial',
        colorGroups: 'auto',
        crossLinks: false,
        detailLevel: 'auto',
      },
    },
  },
  {
    kind: 'study_guide',
    options: { studyGuideOptions: { format: 'auto', sectionCount: 0 } },
  },
  {
    kind: 'practice_problems',
    options: {
      practiceProblemsOptions: { problemCount: 0, difficulty: 'auto' },
    },
  },
  {
    kind: 'case_study',
    options: {
      caseStudyOptions: {
        questionCount: 0,
        focus: '',
        comparePerspectives: 'auto',
      },
    },
  },
  {
    kind: 'slides',
    options: {
      slidesOptions: { slideCount: 0, theme: 'auto', detailLevel: 'auto' },
    },
  },
];

describe('auto generation prompts', () => {
  it('keeps count wording auto when a count of 0 is sent', () => {
    for (const { kind, options } of autoCases) {
      const prompt = promptFor(kind, options);
      expect(prompt, `${kind} auto prompt`).not.toMatch(/EXACTLY\s+0/i);
      expect(prompt, `${kind} auto prompt`).not.toMatch(
        /(create|generate)\s+0\s+(slides|questions|problems|sections|phases|nodes|flashcards)/i,
      );
    }
  });

  it('anchors every auto choice in the source material and instructions', () => {
    for (const { kind, options } of autoCases) {
      expect(promptFor(kind, options), `${kind} auto prompt`).toContain(
        'source material and instructions',
      );
    }
  });

  it('quiz: auto count suggests 4-20 and auto difficulty asks the model to choose', () => {
    const prompt = promptFor('quiz', {
      questionCount: 0,
      difficulty: 'auto',
    });
    expect(prompt).toContain('Decide how many questions');
    expect(prompt).toContain('4-20');
    expect(prompt).toContain('Choose the difficulty level');
  });

  it('flashcards: auto count suggests 5-25, auto difficulty and card style ask the model to choose', () => {
    const prompt = promptFor('simple_flashcard', {
      questionCount: 0,
      difficulty: 'auto',
      cardStyle: 'auto',
    });
    expect(prompt).toContain('Decide how many flashcards');
    expect(prompt).toContain('5-25');
    expect(prompt).toContain('Choose the difficulty level');
    expect(prompt).toContain('Choose the card format');
  });

  it('roadmap: auto phase count and detail level ask the model to choose', () => {
    const prompt = promptFor('roadmap', {
      roadmapOptions: { phaseCount: 0, detailLevel: 'auto' },
    });
    expect(prompt).toContain('Decide how many phases');
    expect(prompt).toContain('Choose the detail level');
  });

  it('mind map: auto node count, color groups, and detail level ask the model to choose', () => {
    const prompt = promptFor('mind_map', {
      mindMapOptions: {
        nodeCount: 0,
        structure: 'radial',
        colorGroups: 'auto',
        crossLinks: false,
        detailLevel: 'auto',
      },
    });
    expect(prompt).toContain('Decide how many nodes');
    expect(prompt).toContain('Decide whether color grouping clarifies');
    expect(prompt).toContain('Choose the detail level');
  });

  it('mind map: explicit color grouping still instructs distinct colors', () => {
    const prompt = promptFor('mind_map', {
      mindMapOptions: {
        nodeCount: 12,
        structure: 'radial',
        colorGroups: true,
        crossLinks: false,
        detailLevel: 'detailed',
      },
    });
    expect(prompt).toContain('Use distinct colors to group related nodes');
    expect(prompt).not.toContain('Decide whether color grouping clarifies');
  });

  it('study guide: auto format asks the model to set the top-level format and count suggests 3-12', () => {
    const prompt = promptFor('study_guide', {
      studyGuideOptions: { format: 'auto', sectionCount: 0 },
    });
    expect(prompt).toContain('Choose the format');
    expect(prompt).toContain('"detailed"');
    expect(prompt).toContain('"revision"');
    expect(prompt).toContain('top-level "format"');
    expect(prompt).toContain('Decide how many sections');
    expect(prompt).toContain('3-12');
  });

  it('practice problems: auto count suggests 3-12 and auto difficulty asks the model to choose', () => {
    const prompt = promptFor('practice_problems', {
      practiceProblemsOptions: { problemCount: 0, difficulty: 'auto' },
    });
    expect(prompt).toContain('Decide how many problems');
    expect(prompt).toContain('3-12');
    expect(prompt).toContain('Choose the difficulty level');
  });

  it('case study: auto count suggests 3-6 and auto perspectives ask whether contrast adds value', () => {
    const prompt = promptFor('case_study', {
      caseStudyOptions: {
        questionCount: 0,
        focus: '',
        comparePerspectives: 'auto',
      },
    });
    expect(prompt).toContain('Decide how many discussion questions');
    expect(prompt).toContain('3-6');
    expect(prompt).toContain(
      'Decide whether contrasting perspectives add value',
    );
    expect(prompt).toContain('never manufacture opposing views');
  });

  it('case study: single focuses the analysis and compare asks for supported contrast', () => {
    const single = promptFor('case_study', {
      caseStudyOptions: {
        questionCount: 3,
        focus: '',
        comparePerspectives: 'single',
      },
    });
    expect(single).toContain('one focused analysis');
    expect(single).toContain('never manufacture opposing views');

    const compare = promptFor('case_study', {
      caseStudyOptions: {
        questionCount: 3,
        focus: '',
        comparePerspectives: 'compare',
      },
    });
    expect(compare).toContain('Compare contrasting perspectives');
    expect(compare).toContain('never manufacture opposing views');
  });

  it('slides: auto count suggests 6-12, auto theme picks a preset, auto detail asks the model to choose', () => {
    const prompt = promptFor('slides', {
      slidesOptions: { slideCount: 0, theme: 'auto', detailLevel: 'auto' },
    });
    expect(prompt).toContain('Decide how many slides');
    expect(prompt).toContain('6-12');
    expect(prompt).toContain('choose the design preset');
    expect(prompt).toContain('Choose the detail level');
    expect(prompt).not.toContain('use the "auto" design preset');
  });

  it('slides: explicit theme and count keep the exact instructions', () => {
    const prompt = promptFor('slides', {
      slidesOptions: {
        slideCount: 10,
        theme: 'academic',
        detailLevel: 'detailed',
      },
    });
    expect(prompt).toContain('Create EXACTLY 10 slides.');
    expect(prompt).toContain('use the "academic" design preset');
    expect(prompt).toContain('Include substantive bullets');
  });

  it('explicit counts and difficulties still produce exact instructions', () => {
    const quiz = promptFor('quiz', {
      questionCount: 12,
      difficulty: 'hard',
    });
    expect(quiz).toContain('Generate EXACTLY 12 questions.');
    expect(quiz).toContain('Target difficulty level: hard');

    const practice = promptFor('practice_problems', {
      practiceProblemsOptions: { problemCount: 5, difficulty: 'easy' },
    });
    expect(practice).toContain('Create EXACTLY 5 problems.');
    expect(practice).toContain('Target difficulty: easy');
  });
});
