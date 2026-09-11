import { describe, expect, it, vi } from 'vitest';
import { GenerationService } from '../src/modules/study-materials/generation.service';
import type { StartGenerationInput } from '../src/modules/study-materials/generation-request-manager';

function setup() {
  const db = {
    select: vi.fn(() => ({
      from: () => ({
        where: async () => [],
      }),
    })),
  };
  const notebooksService = {
    assertNotebookOwner: vi.fn(async () => undefined),
  };
  const connectionService = {
    requireConnected: vi.fn(async () => undefined),
  };
  const requestManager = {
    get: vi.fn(async () => undefined),
    create: vi.fn(async () => 'request-1'),
    cancel: vi.fn(async () => undefined),
  };
  const streamHandler = {
    createStream: vi.fn(() => ({ stream: new ReadableStream() })),
  };
  const service = new GenerationService(
    db as never,
    notebooksService as never,
    connectionService as never,
    requestManager as never,
    streamHandler as never,
  );
  return { service };
}

const baseInput: StartGenerationInput = {
  kind: 'study_guide',
  brief: '',
  sourceIds: [],
};

describe('GenerationService message keys', () => {
  it('keys unavailable study guide sources', async () => {
    const { service } = setup();

    await expect(
      service.generate('notebook-1', { ...baseInput, sourceIds: ['source-1'] }),
    ).rejects.toMatchObject({
      messageKey: 'errors.generation.sourcesUnavailable',
      code: 'bad_request',
    });
  });

  it('keys the study guide brief requirement', async () => {
    const { service } = setup();

    await expect(
      service.generate('notebook-1', baseInput),
    ).rejects.toMatchObject({
      messageKey: 'errors.generation.sourceOrBrief.studyGuide',
      code: 'bad_request',
    });
  });

  it('keys the practice problem count with params', async () => {
    const { service } = setup();

    await expect(
      service.generate('notebook-1', {
        ...baseInput,
        kind: 'practice_problems',
        brief: 'Cell biology',
        questionCount: 31,
      }),
    ).rejects.toMatchObject({
      messageKey: 'errors.generation.problemCount',
      code: 'bad_request',
      params: { min: 1, max: 30 },
    });
  });

  it('keys the practice problems brief requirement', async () => {
    const { service } = setup();

    await expect(
      service.generate('notebook-1', {
        ...baseInput,
        kind: 'practice_problems',
      }),
    ).rejects.toMatchObject({
      messageKey: 'errors.generation.sourceOrBrief.practiceProblems',
      code: 'bad_request',
    });
  });

  it('keys the case study question count with params', async () => {
    const { service } = setup();

    await expect(
      service.generate('notebook-1', {
        ...baseInput,
        kind: 'case_study',
        brief: 'A case',
        questionCount: 11,
      }),
    ).rejects.toMatchObject({
      messageKey: 'errors.generation.questionCount',
      code: 'bad_request',
      params: { min: 1, max: 10 },
    });
  });

  it('keys a missing generation request', async () => {
    const { service } = setup();

    await expect(service.cancel('missing-request')).rejects.toMatchObject({
      messageKey: 'errors.generation.requestNotFound',
      code: 'not_found',
    });
  });
});
