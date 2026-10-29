import { describe, expect, it, vi } from 'vitest';
import { Output, streamText } from 'ai';
import { z } from 'zod';
import { StreamHandler } from '../../src/modules/study-materials/generation/stream-handler';
import {
  generationRequests,
  studyMaterialAudio,
  studyMaterials,
} from '../../src/database/schema';

vi.mock('ai', () => ({
  streamText: vi.fn(),
  Output: { object: vi.fn() },
  parsePartialJson: vi.fn(),
}));

const audio = Buffer.alloc(48);
audio.write('RIFF', 0, 'ascii');
audio.writeUInt32LE(40, 4);
audio.write('WAVEfmt ', 8, 'ascii');
audio.writeUInt32LE(16, 16);
audio.writeUInt16LE(1, 20);
audio.writeUInt16LE(1, 22);
audio.writeUInt32LE(24_000, 24);
audio.writeUInt32LE(48_000, 28);
audio.writeUInt16LE(2, 32);
audio.writeUInt16LE(16, 34);
audio.write('data', 36, 'ascii');
audio.writeUInt32LE(4, 40);
const sectionTexts = [
  `${Array(70).fill('grounded').join(' ')} [ref:R1]`,
  Array(70).fill('connected').join(' '),
  Array(70).fill('synthesis').join(' '),
];

function setup(synthesize: ReturnType<typeof vi.fn>) {
  const inserted: Record<string, unknown>[] = [];
  const tx = {
    select: () => ({
      from: () => ({
        where: () => ({ for: async () => [{ status: 'streaming' }] }),
      }),
    }),
    insert: () => ({
      values: (value: Record<string, unknown>) => {
        inserted.push(value);
        return {
          returning: async () => [{ id: 'material-1' }],
          then: (resolve: (value: unknown) => void) => resolve(undefined),
        };
      },
    }),
  };
  const db = {
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(tx),
  };
  const ai = {
    getProviderForModel: async () => ({ createModel: () => ({}) }),
    getGatewayRequestOptions: () => ({}),
  };
  const handler = new StreamHandler(
    db as never,
    ai as never,
    { synthesizeSections: synthesize } as never,
  );
  return { handler, inserted };
}

function setupReplacement(synthesize: ReturnType<typeof vi.fn>) {
  const existing = {
    id: 'material-1',
    notebookId: 'notebook-1',
    kind: 'audio_overview',
    deletedAt: null,
    folderId: 'folder-1',
  };
  const materialSets: Record<string, unknown>[] = [];
  const audioSets: Record<string, unknown>[] = [];
  const tx = {
    select: () => ({
      from: (table: unknown) => ({
        where: () =>
          table === studyMaterialAudio
            ? Promise.resolve([{ id: existing.id }])
            : {
                for: async () =>
                  table === generationRequests
                    ? [{ status: 'streaming' }]
                    : [existing],
              },
      }),
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => {
        (table === studyMaterials ? materialSets : audioSets).push(values);
        return {
          where: () =>
            table === studyMaterials
              ? { returning: async () => [{ ...existing, ...values }] }
              : Promise.resolve(undefined),
        };
      },
    }),
    insert: () => {
      throw new Error('Replacement should update existing rows');
    },
  };
  const db = {
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(tx),
  };
  const ai = {
    getProviderForModel: async () => ({ createModel: () => ({}) }),
    getGatewayRequestOptions: () => ({}),
  };
  return {
    handler: new StreamHandler(
      db as never,
      ai as never,
      { synthesizeSections: synthesize } as never,
    ),
    materialSets,
    audioSets,
    existing,
  };
}

function modelOutput() {
  vi.mocked(streamText).mockReturnValue({
    partialOutputStream: (async function* () {
      yield {
        title: 'Learning',
        sections: [
          { heading: 'Opening', text: sectionTexts[0] },
          { heading: 'Connection', text: sectionTexts[1] },
          { heading: 'Wrap-up', text: sectionTexts[2] },
        ],
      };
    })(),
    output: Promise.resolve({
      title: 'Learning',
      sections: [
        { heading: 'Opening', text: sectionTexts[0] },
        { heading: 'Connection', text: sectionTexts[1] },
        { heading: 'Wrap-up', text: sectionTexts[2] },
      ],
    }),
  } as never);
}

async function read(stream: ReadableStream<Uint8Array>) {
  return new Response(stream).text();
}

describe('audio overview generation', () => {
  it('synthesizes spoken text without reference markers and saves audio before completion', async () => {
    modelOutput();
    const synthesize = vi.fn(async () => audio);
    const { handler, inserted } = setup(synthesize);
    const citationChunk = {
      chunkId: 'chunk-1',
      chunkIndex: 0,
      sourceId: 'source-1',
      title: 'Biology notes',
      content: 'Cellular respiration releases usable energy.',
      score: 0.7,
      url: null,
      kind: 'text',
      sourceVersionId: null,
      locator: null,
      sectionPath: [],
    };
    const done = vi.fn();
    const { stream } = handler.createStream(
      'notebook-1',
      {
        kind: 'audio_overview',
        brief: '',
        model: 'test',
        language: 'en',
        sourceIds: ['source-1'],
        audioOverviewOptions: {
          format: 'briefing',
          length: 'short',
          audience: 'some_background',
        },
      },
      {
        sources: [
          {
            id: 'source-1',
            title: 'Biology notes',
            kind: 'text',
            url: null,
            chunks: [citationChunk],
            promptChunks: [citationChunk],
          },
        ],
        evidence: [{ ...citationChunk, citationKey: 'R1', rank: 1 }],
      },
      'request-1',
      done,
      vi.fn(),
    );
    const output = await read(stream);
    expect(output).toContain('"materialId":"material-1"');
    expect(
      output
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line).stage)
        .filter(Boolean),
    ).toEqual(['writing_script', 'synthesizing_audio']);
    expect(synthesize).toHaveBeenCalledWith(
      [
        { text: `Opening. ${sectionTexts[0].replace(' [ref:R1]', '')}` },
        { text: `Connection. ${sectionTexts[1]}` },
        { text: `Wrap-up. ${sectionTexts[2]}` },
      ],
      'en',
      undefined,
    );
    expect(inserted).toHaveLength(2);
    expect(inserted[0].content).toMatchObject({
      transcript: expect.not.stringContaining('[ref:R1]'),
      sections: [
        {
          text: expect.not.stringContaining('[ref:R1]'),
          citations: [{ sourceId: 'source-1' }],
        },
        { citations: [] },
        { citations: [] },
      ],
      citations: [{ sourceId: 'source-1' }],
    });
    expect(inserted[1]).toMatchObject({
      studyMaterialId: 'material-1',
      audio,
      contentType: 'audio/wav',
    });
    expect(inserted[0].options).toMatchObject({
      kind: 'audio_overview',
      format: 'briefing',
      length: 'short',
      audience: 'some_background',
      sourceIds: ['source-1'],
    });
    expect(done).toHaveBeenCalledOnce();
    const outputSchema = vi.mocked(Output.object).mock.lastCall?.[0]?.schema;
    expect(outputSchema).toBeDefined();
    const jsonSchema = z.toJSONSchema(outputSchema as z.ZodType);
    expect(Object.keys(jsonSchema.properties ?? {})).toEqual([
      'title',
      'sections',
    ]);
  });

  it('does not retry script generation or save material when synthesis fails', async () => {
    vi.mocked(streamText).mockClear();
    modelOutput();
    const { handler, inserted } = setup(
      vi.fn(async () => {
        throw new Error('Kokoro unavailable');
      }),
    );
    const onError = vi.fn();
    const { stream } = handler.createStream(
      'notebook-1',
      {
        kind: 'audio_overview',
        brief: '',
        model: 'test',
        audioOverviewOptions: {
          format: 'briefing',
          length: 'short',
          audience: 'some_background',
        },
      },
      { sources: [], evidence: [] },
      'request-1',
      vi.fn(),
      onError,
    );
    await expect(read(stream)).rejects.toThrow('Kokoro unavailable');
    expect(streamText).toHaveBeenCalledTimes(1);
    expect(inserted).toHaveLength(0);
    expect(onError).toHaveBeenCalledOnce();
  });

  it('does not persist audio if generation is cancelled during synthesis', async () => {
    modelOutput();
    const abort = new AbortController();
    const { handler, inserted } = setup(
      vi.fn(async () => {
        abort.abort();
        return Buffer.from('audio');
      }),
    );
    const done = vi.fn();
    const { stream } = handler.createStream(
      'notebook-1',
      {
        kind: 'audio_overview',
        brief: '',
        model: 'test',
        audioOverviewOptions: {
          format: 'briefing',
          length: 'short',
          audience: 'some_background',
        },
      },
      { sources: [], evidence: [] },
      'request-1',
      done,
      vi.fn(),
      abort.signal,
    );
    expect(await read(stream)).not.toContain('"done":true');
    expect(inserted).toHaveLength(0);
    expect(done).not.toHaveBeenCalled();
  });

  it('replaces script and audio together while preserving the material ID and folder', async () => {
    modelOutput();
    const synthesize = vi.fn(async () => audio);
    const { handler, materialSets, audioSets, existing } =
      setupReplacement(synthesize);
    const { stream } = handler.createStream(
      'notebook-1',
      {
        kind: 'audio_overview',
        brief: 'Focus on energy transfer',
        model: 'test',
        replaceMaterialId: existing.id,
        audioOverviewOptions: {
          format: 'deep_dive',
          length: 'short',
          audience: 'advanced',
        },
      },
      { sources: [], evidence: [] },
      'request-1',
      vi.fn(),
      vi.fn(),
    );

    expect(await read(stream)).toContain('"materialId":"material-1"');
    expect(materialSets).toHaveLength(1);
    expect(materialSets[0]).toMatchObject({
      title: 'Learning',
      options: expect.objectContaining({ brief: 'Focus on energy transfer' }),
    });
    expect(materialSets[0]).not.toHaveProperty('folderId');
    expect(audioSets).toEqual([{ audio, contentType: 'audio/wav' }]);
  });

  it('leaves the existing material and audio unchanged when replacement synthesis fails', async () => {
    modelOutput();
    const { handler, materialSets, audioSets, existing } = setupReplacement(
      vi.fn(async () => {
        throw new Error('Kokoro unavailable');
      }),
    );
    const { stream } = handler.createStream(
      'notebook-1',
      {
        kind: 'audio_overview',
        brief: 'Focus on energy transfer',
        model: 'test',
        replaceMaterialId: existing.id,
        audioOverviewOptions: {
          format: 'briefing',
          length: 'short',
          audience: 'some_background',
        },
      },
      { sources: [], evidence: [] },
      'request-1',
      vi.fn(),
      vi.fn(),
    );

    await expect(read(stream)).rejects.toThrow('Kokoro unavailable');
    expect(materialSets).toHaveLength(0);
    expect(audioSets).toHaveLength(0);
  });
});
