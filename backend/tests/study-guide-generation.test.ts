import { beforeEach, describe, expect, it, vi } from 'vitest';
import { streamText } from 'ai';
import { StreamHandler } from '../src/modules/study-materials/stream-handler';
import { StudyMaterialService } from '../src/modules/study-materials/study-material.service';
import type { RetrievedChunk } from '../src/modules/ai/retrieval.service';

vi.mock('ai', () => ({
  streamText: vi.fn(),
  Output: { object: vi.fn() },
  parsePartialJson: vi.fn(),
}));

const sourceChunk: RetrievedChunk = {
  chunkId: 'chunk-1',
  chunkIndex: 0,
  sourceId: 'source-1',
  title: 'Ethics',
  content: 'Source: "Ethics"\nPractice develops habits.',
  score: 0.6,
  url: null,
  kind: 'text',
  sourceVersionId: null,
  locator: null,
};

const content = {
  title: 'virtue-study-guide',
  overview: 'Learn about virtue.',
  learningObjectives: ['Explain virtue.'],
  sections: [
    {
      id: 'virtue',
      title: 'Virtue',
      explanation: 'Practice develops habits [ref:R1].',
      keyConcepts: ['Habit'],
      examples: [],
      sourceIds: ['source-1'],
    },
  ],
};

function setup() {
  let saved: Record<string, unknown> | undefined;
  const database = {
    insert: vi.fn(() => ({
      values: (value: Record<string, unknown>) => ({
        returning: async () => {
          saved = { ...value, id: 'material-1' };
          return [saved];
        },
      }),
    })),
    select: () => ({
      from: () => ({ where: async () => (saved ? [saved] : []) }),
    }),
  };
  const aiService = {
    getProviderForModel: async () => ({
      listModels: () => [
        { id: 'test-model', capabilities: { structuredOutput: true } },
      ],
      createModel: () => ({}),
    }),
    getGatewayRequestOptions: () => ({}),
  };
  const handler = new StreamHandler(database as never, aiService as never);
  const materials = new StudyMaterialService(
    database as never,
    { assertNotebookOwner: vi.fn() } as never,
  );
  return { handler, materials, database };
}

async function drain(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  let text = '';
  while (true) {
    const result = await reader.read();
    if (result.done) return text;
    text += new TextDecoder().decode(result.value);
  }
}

describe('study guide generation boundary', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(['native', 'fallback'])(
    'generates, saves, and reopens a revision sheet through %s output',
    async (mode) => {
      const { handler, materials } = setup();
      const response = {
        partialOutputStream: (async function* () {
          yield content;
        })(),
        output: Promise.resolve(content),
      };
      if (mode === 'native')
        vi.mocked(streamText).mockReturnValue(response as never);
      else
        vi.mocked(streamText)
          .mockImplementationOnce(() => {
            throw new Error('Native unavailable');
          })
          .mockReturnValue({
            textStream: (async function* () {
              yield JSON.stringify(content);
            })(),
          } as never);
      const onDone = vi.fn();
      const onError = vi.fn();
      const { stream } = handler.createStream(
        'notebook-1',
        {
          kind: 'study_guide',
          brief: 'Virtue',
          model: 'test-model',
          studyGuideOptions: { format: 'revision', sectionCount: 1 },
        },
        {
          sources: [
            {
              id: 'source-1',
              title: 'Ethics',
              kind: 'text',
              url: null,
              chunks: [sourceChunk],
            },
          ],
          evidence: [{ ...sourceChunk, citationKey: 'R1', rank: 1 }],
        },
        'request-1',
        onDone,
        onError,
      );
      expect(await drain(stream)).toContain('"materialId":"material-1"');
      const reopened = await materials.get('material-1');
      expect(reopened).toMatchObject({
        kind: 'study_guide',
        content: {
          format: 'revision',
          sourceIds: ['source-1'],
          sections: [{ sourceIds: ['source-1'] }],
          citations: [
            expect.objectContaining({
              citationKey: 'R1',
              sourceId: 'source-1',
              chunkId: 'chunk-1',
              chunkIndex: 0,
            }),
          ],
        },
        options: { format: 'revision', sectionCount: 1 },
      });
      const prompt = vi.mocked(streamText).mock.calls[0][0].prompt as string;
      expect(prompt).toContain('Source ID: source-1');
      expect(prompt).toContain('[Evidence R1]');
      expect(prompt).toContain('Practice develops habits.');
      const instructions = vi.mocked(streamText).mock.calls[0][0]
        .instructions as string;
      expect(instructions).toContain('[ref:R1]');
      expect(onDone).toHaveBeenCalledWith({ materialId: 'material-1' });
      expect(onError).not.toHaveBeenCalled();
    },
  );

  it('drops citation markers that do not resolve to retrieved evidence', async () => {
    const { handler, materials } = setup();
    const invented = {
      ...content,
      sections: [
        {
          ...content.sections[0],
          explanation: 'Practice develops habits [ref:R9].',
        },
      ],
    };
    vi.mocked(streamText).mockReturnValue({
      partialOutputStream: (async function* () {
        yield invented;
      })(),
      output: Promise.resolve(invented),
    } as never);

    const { stream } = handler.createStream(
      'notebook-1',
      {
        kind: 'study_guide',
        brief: 'Virtue',
        model: 'test-model',
        studyGuideOptions: { format: 'revision', sectionCount: 1 },
      },
      {
        sources: [
          {
            id: 'source-1',
            title: 'Ethics',
            kind: 'text',
            url: null,
            chunks: [sourceChunk],
          },
        ],
        evidence: [{ ...sourceChunk, citationKey: 'R1', rank: 1 }],
      },
      'request-1',
      vi.fn(),
      vi.fn(),
    );
    await drain(stream);

    const reopened = await materials.get('material-1');
    expect(reopened.content).toMatchObject({ citations: [] });
  });

  it('does not ask for citations when the generation is ungrounded', async () => {
    const { handler } = setup();
    vi.mocked(streamText).mockReturnValue({
      partialOutputStream: (async function* () {
        yield {
          ...content,
          sections: [{ ...content.sections[0], sourceIds: [] }],
        };
      })(),
      output: Promise.resolve({
        ...content,
        sections: [{ ...content.sections[0], sourceIds: [] }],
      }),
    } as never);

    const { stream } = handler.createStream(
      'notebook-1',
      {
        kind: 'study_guide',
        brief: 'Virtue',
        model: 'test-model',
        studyGuideOptions: { format: 'revision', sectionCount: 1 },
      },
      { sources: [], evidence: [] },
      'request-1',
      vi.fn(),
      vi.fn(),
    );
    await drain(stream);

    const instructions = vi.mocked(streamText).mock.calls[0][0]
      .instructions as string;
    expect(instructions).not.toContain('[ref:R1]');
  });

  it('fails recoverably without saving invalid native or fallback output', async () => {
    const { handler, database } = setup();
    vi.mocked(streamText)
      .mockReturnValueOnce({
        partialOutputStream: (async function* () {
          yield {};
        })(),
        output: Promise.resolve({}),
      } as never)
      .mockReturnValueOnce({
        textStream: (async function* () {
          yield '{}';
        })(),
      } as never);
    const onError = vi.fn();
    const { stream } = handler.createStream(
      'notebook',
      { kind: 'study_guide', brief: 'Virtue', model: 'test-model' },
      { sources: [], evidence: [] },
      'request',
      vi.fn(),
      onError,
    );
    await expect(drain(stream)).rejects.toThrow();
    expect(database.insert).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
  });
});
