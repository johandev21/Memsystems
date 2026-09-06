import { describe, expect, it } from 'vitest';
import {
  extractJson,
  parseJsonLenient,
  repairJsonText,
} from '../src/modules/study-materials/content-normalizer';

describe('extractJson', () => {
  it('extracts a fenced json block past leading prose', () => {
    const raw = 'Here is your quiz:\n```json\n{"title": "Q"}\n```';
    expect(extractJson(raw)).toBe('{"title": "Q"}');
  });

  it('prefers the fenced block containing JSON when several exist', () => {
    const raw = '```\njust a note\n```\n```json\n{"title": "Q"}\n```';
    expect(extractJson(raw)).toBe('{"title": "Q"}');
  });

  it('unwraps <structured_output> tags with and without a closing tag', () => {
    expect(
      extractJson('<structured_output>\n{"title": "Q"}\n</structured_output>'),
    ).toBe('{"title": "Q"}');
    expect(extractJson('<structured_output>\n{"title": "Q"}')).toBe(
      '{"title": "Q"}',
    );
  });

  it('strips leading prose and trailing prose after the last brace', () => {
    const raw = 'Sure! Here you go:\n{"title": "Q"}\nHope this helps!';
    expect(extractJson(raw)).toBe('{"title": "Q"}');
  });

  it('does not truncate an in-progress partial (streaming chunks)', () => {
    const partial = '{"title": "Foo", "questions": [{"id": "p2-';
    expect(extractJson(partial)).toBe(partial);
    const nestedPartial = '{"a": {"x": 1}, "b": "hel';
    expect(extractJson(nestedPartial)).toBe(nestedPartial);
  });
});

describe('repairJsonText', () => {
  it('converts single-quoted strings to double-quoted', () => {
    const raw = `{"questions": [{"id": 'p2-s8', "t": "x"}]}`;
    const parsed = JSON.parse(repairJsonText(raw)) as {
      questions: { id: string }[];
    };
    expect(parsed.questions[0].id).toBe('p2-s8');
  });

  it('removes trailing commas', () => {
    expect(JSON.parse(repairJsonText('{"a": 1,}'))).toEqual({ a: 1 });
    expect(JSON.parse(repairJsonText('{"a": [1, 2,],}'))).toEqual({
      a: [1, 2],
    });
  });

  it('leaves apostrophes inside double-quoted strings untouched', () => {
    const raw = `{"text": "it's fine"}`;
    expect(repairJsonText(raw)).toBe(raw);
    expect((JSON.parse(repairJsonText(raw)) as { text: string }).text).toBe(
      "it's fine",
    );
  });
});

describe('parseJsonLenient', () => {
  it('parses the single-quote failure seen from glm flash models', () => {
    const raw = `Here you go:\n\`\`\`json\n{"title": "T", "questions": [{"id": 'p2-s8', "prompt": "Q?",}]}\n\`\`\`\nDone!`;
    const parsed = parseJsonLenient(raw) as {
      questions: { id: string }[];
    };
    expect(parsed.questions[0].id).toBe('p2-s8');
  });

  it('throws with a truncated preview when unrepairable', () => {
    expect(() => parseJsonLenient('not json at all {{{')).toThrow(/Preview:/);
  });
});
