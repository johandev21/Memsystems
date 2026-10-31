import { describe, expect, it } from 'vitest';
import {
  AudioOverviewContent,
  assertAudioOverviewScriptLength,
  validateContent,
} from '../../src/modules/study-materials/content/shapes';
import { getPromptTemplate } from '../../src/modules/study-materials/generation/prompts';

describe('audio overview content', () => {
  it('validates transcript and preserves citations and optional metadata', () => {
    const content = {
      title: 'Cellular respiration',
      transcript: 'A short source-grounded overview.',
      citations: [],
      metadata: { language: 'en' },
    };

    expect(validateContent('audio_overview', content)).toEqual(content);
  });

  it('accepts sectioned scripts for longer overviews and legacy transcripts', () => {
    const longScript = {
      title: 'Long overview',
      transcript: 'x'.repeat(5000),
      sections: [{ heading: 'Opening', text: 'x'.repeat(2000), citations: [] }],
      citations: [],
    };

    expect(validateContent('audio_overview', longScript)).toEqual(longScript);
    expect(
      validateContent('audio_overview', {
        title: 'Legacy',
        transcript: 'A saved MVP transcript.',
        citations: [],
      }),
    ).toMatchObject({ transcript: 'A saved MVP transcript.' });
  });

  it('preserves generated dialogue turns while accepting legacy sections without them', () => {
    const turns = [
      { speaker: 'host' as const, text: 'What connects these ideas?' },
      {
        speaker: 'guest' as const,
        text: 'The shared mechanism is energy transfer.',
      },
    ];
    expect(
      validateContent('audio_overview', {
        title: 'Dialogue',
        sections: [
          {
            heading: 'Connection',
            text: turns.map((turn) => turn.text).join(' '),
            turns,
          },
        ],
        citations: [],
      }),
    ).toMatchObject({ sections: [{ turns }] });
    expect(
      validateContent('audio_overview', {
        title: 'Legacy section',
        sections: [{ heading: 'Opening', text: 'A legacy section.' }],
        citations: [],
      }),
    ).toMatchObject({ sections: [{ text: 'A legacy section.' }] });
  });

  it('counts canonical spoken turns once, rather than counting a duplicate section text view', () => {
    const text = Array(210).fill('spoken').join(' ');
    const content = AudioOverviewContent.parse({
      title: 'Dialogue',
      transcript: 'duplicate view should not count',
      sections: [
        {
          heading: 'Main',
          text,
          turns: [
            { speaker: 'host', text: Array(105).fill('spoken').join(' ') },
            { speaker: 'guest', text: Array(105).fill('spoken').join(' ') },
          ],
        },
      ],
      citations: [],
    });
    expect(() =>
      assertAudioOverviewScriptLength(content, 'short'),
    ).not.toThrow();
  });

  it('steers format, length, and audience independently in the generation prompt', () => {
    const prompt = getPromptTemplate('audio_overview').user;
    const briefing = prompt('', 'Evidence', {
      audioOverviewOptions: {
        format: 'briefing',
        length: 'short',
        audience: 'new_to_topic',
      },
    });
    const deepDive = prompt('', 'Evidence', {
      audioOverviewOptions: {
        format: 'deep_dive',
        length: 'extended',
        audience: 'advanced',
      },
    });

    expect(briefing).toContain('2–3 minutes');
    expect(getPromptTemplate('audio_overview').instructions).toContain(
      'two-speaker',
    );
    expect(getPromptTemplate('audio_overview').instructions).toContain('host');
    expect(briefing).toContain('new to the topic');
    expect(deepDive).toContain('10–12 minutes');
    expect(deepDive).toContain('unpack concepts');
    expect(deepDive).toContain('strong foundations');
  });

  it('enforces the selected script word and character budgets', () => {
    const script = (text: string) => ({
      title: 'Bounded script',
      transcript: text,
      citations: [],
    });

    expect(() =>
      assertAudioOverviewScriptLength(
        AudioOverviewContent.parse(script(Array(210).fill('word').join(' '))),
        'short',
      ),
    ).not.toThrow();
    expect(() =>
      assertAudioOverviewScriptLength(
        AudioOverviewContent.parse(script(Array(1_200).fill('word').join(' '))),
        'extended',
      ),
    ).not.toThrow();
    expect(() =>
      assertAudioOverviewScriptLength(
        AudioOverviewContent.parse(script('too short')),
        'short',
      ),
    ).toThrow('must contain 200–450 words');
    expect(() =>
      assertAudioOverviewScriptLength(
        AudioOverviewContent.parse(script('x'.repeat(15_001))),
        'extended',
      ),
    ).toThrow('15,000 characters');
  });
});
