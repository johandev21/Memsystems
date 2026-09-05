import { beforeEach, describe, expect, it, vi } from 'vitest';
import { streamText } from 'ai';
import { StreamHandler } from '../src/modules/study-materials/stream-handler';
import { StudyMaterialService } from '../src/modules/study-materials/study-material.service';

vi.mock('ai', () => ({
  streamText: vi.fn(),
  Output: { object: vi.fn() },
  parsePartialJson: vi.fn(),
}));

const content = {
  title: 'virtue-study-guide',
  overview: 'Learn about virtue.',
  learningObjectives: ['Explain virtue.'],
  sections: [
    {
      id: 'virtue',
      title: 'Virtue',
      explanation: 'Practice develops habits.',
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
        'user-1',
        'notebook-1',
        {
          kind: 'study_guide',
          brief: 'Virtue',
          model: 'test-model',
          studyGuideOptions: { format: 'revision', sectionCount: 1 },
        },
        [
          {
            id: 'source-1',
            title: 'Ethics',
            rawText: 'Practice develops habits.',
          },
        ],
        'request-1',
        onDone,
        onError,
      );
      expect(await drain(stream)).toContain('"materialId":"material-1"');
      const reopened = await materials.get('user-1', 'material-1');
      expect(reopened).toMatchObject({
        kind: 'study_guide',
        content: {
          format: 'revision',
          sourceIds: ['source-1'],
          sections: [{ sourceIds: ['source-1'] }],
        },
        options: { format: 'revision', sectionCount: 1 },
      });
      expect(vi.mocked(streamText).mock.calls[0][0].prompt).toContain(
        'Source ID: source-1',
      );
      expect(onDone).toHaveBeenCalledWith({ materialId: 'material-1' });
      expect(onError).not.toHaveBeenCalled();
    },
  );

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
      'user',
      'notebook',
      { kind: 'study_guide', brief: 'Virtue', model: 'test-model' },
      [],
      'request',
      vi.fn(),
      onError,
    );
    await expect(drain(stream)).rejects.toThrow();
    expect(database.insert).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
  });
});
