import { describe, expect, it } from 'vitest';
import {
  attachGenerationCitations,
  extractGenerationCitations,
} from '../src/modules/study-materials/generation-citations';
import { validateContent } from '../src/modules/study-materials/shapes';
import { normalizeContent } from '../src/modules/study-materials/content-normalizer';
import type { RetrievedChunk } from '../src/modules/ai/retrieval.service';

const chunk: RetrievedChunk = {
  chunkId: 'chunk-1',
  chunkIndex: 0,
  sourceId: 'source-1',
  title: 'Lecture Notes',
  content: 'Mitochondria generate most of the chemical energy.',
  score: 0.7,
  url: 'https://example.test/notes',
  kind: 'text',
  sourceVersionId: 'version-1',
  locator: { pageNumber: 3 },
  sectionPath: [],
};

const evidence = [{ ...chunk, citationKey: 'R1', rank: 1 }];

describe('extractGenerationCitations', () => {
  it('resolves evidence markers emitted in generated content', () => {
    const citations = extractGenerationCitations(
      {
        title: 'guide',
        sections: [{ explanation: 'Energy comes from mitochondria [ref:R1].' }],
      },
      evidence,
    );

    expect(citations).toHaveLength(1);
    expect(citations[0]).toMatchObject({
      citationKey: 'R1',
      sourceId: 'source-1',
      chunkId: 'chunk-1',
      chunkIndex: 0,
      sourceVersionId: 'version-1',
      number: 1,
      title: 'Lecture Notes',
      url: 'https://example.test/notes',
      locator: { pageNumber: 3 },
    });
    expect(citations[0].quote).toContain('Mitochondria');
  });

  it('drops invented keys and keeps the real ones', () => {
    const citations = extractGenerationCitations(
      'Claim [ref:R1] and an invented claim [ref:R42].',
      evidence,
    );

    expect(citations.map((citation) => citation.citationKey)).toEqual(['R1']);
  });

  it('returns nothing when there is no evidence to cite', () => {
    expect(extractGenerationCitations('Claim [ref:R1].', [])).toEqual([]);
  });

  it('numbers citations by first appearance, not by evidence order', () => {
    const second = {
      ...chunk,
      chunkId: 'chunk-2',
      chunkIndex: 1,
      citationKey: 'R2',
      rank: 2,
    };
    const citations = extractGenerationCitations(
      'Second first [ref:R2], then first [ref:R1].',
      [evidence[0], second],
    );

    expect(citations.map((citation) => citation.citationKey)).toEqual([
      'R2',
      'R1',
    ]);
    expect(citations.map((citation) => citation.number)).toEqual([1, 2]);
  });
});

describe('attachGenerationCitations', () => {
  it('writes the verified citations onto the stored content', () => {
    const stored = attachGenerationCitations(
      { title: 'guide' } as Record<string, unknown>,
      extractGenerationCitations('Claim [ref:R1].', evidence),
    );

    expect(stored.citations).toHaveLength(1);
    expect(stored.citations[0].chunkId).toBe('chunk-1');
  });
});

describe('content schemas keep citations', () => {
  it('retains citations through quiz validation and normalization', () => {
    const content = {
      title: 'Quiz',
      questions: [
        {
          id: 'q1',
          prompt: 'Where does the energy come from?',
          options: [
            { id: 'a', text: 'Mitochondria', explanation: 'Correct.' },
            { id: 'b', text: 'Nucleus', explanation: 'Incorrect.' },
          ],
          correctOptionId: 'a',
        },
      ],
      citations: [],
    };
    const citations = extractGenerationCitations(
      {
        ...content,
        questions: [
          {
            ...content.questions[0],
            prompt: 'Where does the energy come from [ref:R1]?',
          },
        ],
      },
      evidence,
    );
    const stored = attachGenerationCitations(content, citations);

    const validated = validateContent('quiz', stored) as {
      citations: { chunkId: string | null }[];
    };
    expect(validated.citations).toHaveLength(1);
    expect(validated.citations[0].chunkId).toBe('chunk-1');

    const normalized = normalizeContent('quiz', validated) as {
      citations: unknown[];
    };
    expect(normalized.citations).toHaveLength(1);
  });

  it('retains citations through study guide validation', () => {
    const stored = attachGenerationCitations(
      {
        title: 'guide',
        overview: 'Overview',
        learningObjectives: ['Understand energy'],
        sections: [
          {
            id: 's1',
            title: 'Energy',
            explanation: 'Mitochondria [ref:R1].',
            keyConcepts: ['ATP'],
            examples: [],
            sourceIds: ['source-1'],
          },
        ],
        sourceIds: ['source-1'],
      },
      extractGenerationCitations('Mitochondria [ref:R1].', evidence),
    );

    const validated = validateContent('study_guide', stored) as {
      citations: { chunkId: string | null }[];
    };
    expect(validated.citations).toHaveLength(1);
    expect(validated.citations[0].chunkId).toBe('chunk-1');
  });

  it('retains citations through slides resolution', () => {
    const stored = attachGenerationCitations(
      {
        schemaVersion: 2,
        title: 'deck',
        design: {
          background: '#0F172A',
          surface: '#1E293B',
          primary: '#38BDF8',
          secondary: '#818CF8',
          text: '#F8FAFC',
          muted: '#94A3B8',
        },
        slides: [{ id: 's1', role: 'content', title: 'Intro', elements: [] }],
      },
      extractGenerationCitations('Mitochondria [ref:R1].', evidence),
    );

    const validated = validateContent('slides', stored) as {
      citations: { chunkId: string | null }[];
    };
    expect(validated.citations).toHaveLength(1);
    expect(validated.citations[0].chunkId).toBe('chunk-1');
  });

  it('retains citations through flashcard validation and normalization', () => {
    const stored = attachGenerationCitations(
      {
        title: 'Cards',
        cards: [{ front: 'Energy source [ref:R1]?', back: 'Mitochondria' }],
      },
      extractGenerationCitations('Energy source [ref:R1]?', evidence),
    );

    const validated = validateContent('simple_flashcard', stored) as {
      citations: unknown[];
    };
    expect(validated.citations).toHaveLength(1);
    const normalized = normalizeContent('simple_flashcard', validated) as {
      citations: unknown[];
    };
    expect(normalized.citations).toHaveLength(1);
  });
});
