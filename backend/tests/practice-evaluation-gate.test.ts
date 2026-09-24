import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateText } from 'ai';
import { CapabilityUnsupportedError } from '../src/common/errors/domain-error';
import { StudyMaterialService } from '../src/modules/study-materials/study-material.service';

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return { ...actual, generateText: vi.fn() };
});

const mockGenerateText = vi.mocked(generateText);

const practiceContent = {
  title: 'Newton Laws',
  overview: '',
  difficulty: 'medium' as const,
  sourceIds: [],
  problems: [
    {
      id: 'p1',
      prompt: 'Solve 2x = 4.',
      givens: [],
      constraints: [],
      hints: [],
      steps: [
        {
          id: 'p1-s1',
          title: 'Divide',
          explanation: 'Divide both sides by 2.',
          sourceIds: [],
        },
      ],
      answer: 'x = 2',
      checklist: [],
      acceptableAlternatives: [],
      sourceIds: [],
    },
  ],
};

function setup() {
  const material = {
    id: 'sm-1',
    notebookId: 'notebook-1',
    kind: 'practice_problems',
    content: practiceContent,
    deletedAt: null,
  };
  const db = {
    select: () => ({
      from: () => ({ where: async () => [material] }),
    }),
  };
  const notebooksService = {
    assertNotebookOwner: vi.fn(async () => undefined),
  };
  const provider = {
    id: 'gateway',
    listModels: () => [
      {
        id: 'openai/gpt-5.6-sol',
        displayName: 'GPT-5.6 Sol',
        capabilities: { structuredOutput: true },
      },
    ],
    createModel: vi.fn(() => ({})),
  };
  const aiService = {
    getProviderForModel: vi.fn(async () => provider),
    requireStructuredOutput: vi.fn(),
    getGatewayRequestOptions: vi.fn(() => ({
      providerOptions: { gateway: {} },
    })),
  };
  const service = new StudyMaterialService(
    db as never,
    notebooksService as never,
    undefined,
    aiService as never,
  );
  return { service, provider, aiService };
}

const evaluationInput = {
  problemId: 'p1',
  studentAnswer: 'x = 2',
  modelId: 'openai/gpt-5.6-sol',
};

describe('practice problem evaluation structured-output gate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a non-capable model before calling the model', async () => {
    const { service, provider, aiService } = setup();
    aiService.requireStructuredOutput.mockImplementationOnce(() => {
      throw new CapabilityUnsupportedError(
        "GLM 5 Turbo doesn't support structured output. Choose another model and try again.",
        {
          messageKey: 'errors.studyMaterials.evaluation.structuredOutputUnsupported',
          params: { name: 'GLM 5 Turbo' },
        },
      );
    });

    await expect(
      service.evaluatePracticeProblem('sm-1', {
        ...evaluationInput,
        modelId: 'zai/glm-5-turbo',
      }),
    ).rejects.toMatchObject({
      messageKey:
        'errors.studyMaterials.evaluation.structuredOutputUnsupported',
      code: 'gateway_capability_unsupported',
      status: 400,
      params: { name: 'GLM 5 Turbo' },
    });

    expect(aiService.requireStructuredOutput).toHaveBeenCalledWith(
      provider,
      'zai/glm-5-turbo',
      'errors.studyMaterials.evaluation.structuredOutputUnsupported',
    );
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('fails closed when capabilities are not verified', async () => {
    const { service, aiService } = setup();
    aiService.requireStructuredOutput.mockImplementationOnce(() => {
      throw new CapabilityUnsupportedError(
        "GPT-5.6 Sol doesn't support structured output. Choose another model and try again.",
        {
          messageKey:
            'errors.studyMaterials.evaluation.structuredOutputUnsupported',
          params: { name: 'GPT-5.6 Sol' },
        },
      );
    });

    await expect(
      service.evaluatePracticeProblem('sm-1', evaluationInput),
    ).rejects.toMatchObject({
      messageKey:
        'errors.studyMaterials.evaluation.structuredOutputUnsupported',
      code: 'gateway_capability_unsupported',
    });
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('evaluates when the gate accepts the model', async () => {
    const { service, aiService } = setup();
    mockGenerateText.mockResolvedValue({
      output: {
        status: 'correct',
        feedback: 'Nice work.',
        strengths: ['Correct method'],
        missingPoints: [],
      },
    } as never);

    await expect(
      service.evaluatePracticeProblem('sm-1', evaluationInput),
    ).resolves.toEqual({
      status: 'correct',
      feedback: 'Nice work.',
      strengths: ['Correct method'],
      missingPoints: [],
    });

    expect(aiService.requireStructuredOutput).toHaveBeenCalledWith(
      expect.anything(),
      'openai/gpt-5.6-sol',
      'errors.studyMaterials.evaluation.structuredOutputUnsupported',
    );
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });
});
