import { describe, expect, it, vi } from 'vitest';
import {
  parseVisionJson,
  VISION_EXTRACTION_SYSTEM_PROMPT,
  VisionExtractionService,
} from '../src/modules/sources/vision-extraction.service';
import { VisionExtractionInput } from '../src/modules/sources/vision-extraction.port';

const { mockGenerateText } = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
}));

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    generateText: mockGenerateText,
  };
});

describe('parseVisionJson', () => {
  it('parses valid structured JSON with all segment kinds and bounding boxes', () => {
    const raw = JSON.stringify({
      title: 'Thermodynamics Diagram',
      segments: [
        {
          kind: 'heading',
          content: 'Carnot Cycle Analysis',
          confidence: 0.98,
          imageRegion: { x: 0.1, y: 0.05, width: 0.8, height: 0.1 },
        },
        {
          kind: 'text',
          content: 'The efficiency of an ideal Carnot engine is defined as:',
          confidence: 0.95,
          imageRegion: { x: 0.1, y: 0.2, width: 0.8, height: 0.15 },
        },
        {
          kind: 'formula',
          content: '$$\\eta = 1 - \\frac{T_C}{T_H}$$',
          confidence: 0.99,
          imageRegion: { x: 0.25, y: 0.4, width: 0.5, height: 0.15 },
        },
        {
          kind: 'visual_description',
          content:
            'A P-V indicator diagram showing two isothermal and two adiabatic processes.',
          confidence: 0.92,
          imageRegion: { x: 0.1, y: 0.6, width: 0.8, height: 0.35 },
        },
      ],
    });

    const parsed = parseVisionJson(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.title).toBe('Thermodynamics Diagram');
    expect(parsed?.segments).toHaveLength(4);

    expect(parsed?.segments[0]).toEqual({
      kind: 'heading',
      content: 'Carnot Cycle Analysis',
      confidence: 0.98,
      imageRegion: { x: 0.1, y: 0.05, width: 0.8, height: 0.1 },
    });

    expect(parsed?.segments[2]).toEqual({
      kind: 'formula',
      content: '$$\\eta = 1 - \\frac{T_C}{T_H}$$',
      confidence: 0.99,
      imageRegion: { x: 0.25, y: 0.4, width: 0.5, height: 0.15 },
    });

    expect(parsed?.segments[3]).toEqual({
      kind: 'visual_description',
      content:
        'A P-V indicator diagram showing two isothermal and two adiabatic processes.',
      confidence: 0.92,
      imageRegion: { x: 0.1, y: 0.6, width: 0.8, height: 0.35 },
    });
  });

  it('strips markdown code fences before parsing JSON', () => {
    const raw =
      '```json\n{\n  "title": "Cleaned JSON",\n  "segments": [\n    {\n      "kind": "text",\n      "content": "Inside code fence"\n    }\n  ]\n}\n```';
    const parsed = parseVisionJson(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.title).toBe('Cleaned JSON');
    expect(parsed?.segments[0].content).toBe('Inside code fence');
  });

  it('clamps coordinates and confidence within valid bounds', () => {
    const raw = JSON.stringify({
      segments: [
        {
          kind: 'text',
          content: 'Clamped test',
          confidence: 1.5,
          imageRegion: { x: -0.2, y: 0.5, width: 1.8, height: 0.2 },
        },
      ],
    });

    const parsed = parseVisionJson(raw);
    expect(parsed?.segments[0].confidence).toBe(1);
    expect(parsed?.segments[0].imageRegion?.x).toBe(0);
    expect(parsed?.segments[0].imageRegion?.width).toBe(1);
  });

  it('returns null for non-JSON text', () => {
    expect(parseVisionJson('Not JSON')).toBeNull();
    expect(parseVisionJson('')).toBeNull();
  });
});

describe('VisionExtractionService', () => {
  const mockAiService = {
    getProviderForModel: vi.fn(),
    getGatewayRequestOptions: vi.fn().mockResolvedValue({}),
  };
  const mockConnectionService = {
    snapshot: vi.fn(),
  };

  const createService = () =>
    new VisionExtractionService(
      mockAiService as any,
      mockConnectionService as any,
    );

  it('falls back to deterministic extraction when no userId is provided', async () => {
    const service = createService();
    const input: VisionExtractionInput = {
      imageBuffer: Buffer.from([1, 2, 3]),
      mimeType: 'image/png',
      fileName: 'test_chart.png',
    };

    const result = await service.extract(input);
    expect(result.title).toBe('test_chart');
    expect(result.rawText).toBe('[Image: test_chart.png]');
    expect(result.segments).toEqual([
      {
        kind: 'visual_description',
        content: '[Image: test_chart.png]',
        imageRegion: { x: 0, y: 0, width: 1, height: 1 },
      },
    ]);
    expect(result.warnings).toBeDefined();
  });

  it('falls back to deterministic extraction when no vision-capable model is connected', async () => {
    const service = createService();
    mockConnectionService.snapshot.mockResolvedValue({
      models: [
        {
          id: 'deepseek/deepseek-v3',
          capabilities: { imageInput: false },
        },
      ],
    });

    const input: VisionExtractionInput = {
      imageBuffer: Buffer.from([1, 2, 3]),
      mimeType: 'image/jpeg',
      fileName: 'diagram.jpg',
      userId: 'user-123',
    };

    const result = await service.extract(input);
    expect(result.title).toBe('diagram');
    expect(result.segments[0].kind).toBe('visual_description');
    expect(result.warnings?.[0]).toContain('Vision model unavailable');
  });

  it('invokes AI model and parses structured segments when vision model is available', async () => {
    const service = createService();
    mockConnectionService.snapshot.mockResolvedValue({
      models: [
        {
          id: 'google/gemini-3.6-flash',
          capabilities: { imageInput: true },
        },
      ],
    });

    const mockModel = {};
    const mockProvider = {
      createModel: vi.fn().mockReturnValue(mockModel),
    };
    mockAiService.getProviderForModel.mockResolvedValue(mockProvider);

    const mockModelResponseJson = JSON.stringify({
      title: 'Neural Network Architecture',
      segments: [
        {
          kind: 'heading',
          content: 'Convolutional Layer',
          confidence: 0.97,
          imageRegion: { x: 0.0, y: 0.0, width: 1.0, height: 0.2 },
        },
        {
          kind: 'formula',
          content: '$$y = f(W * x + b)$$',
          confidence: 0.99,
          imageRegion: { x: 0.2, y: 0.25, width: 0.6, height: 0.2 },
        },
        {
          kind: 'visual_description',
          content:
            'Diagram showing 3x3 filter kernel sliding over 28x28 input map.',
          confidence: 0.94,
          imageRegion: { x: 0.1, y: 0.5, width: 0.8, height: 0.45 },
        },
      ],
    });

    mockGenerateText.mockResolvedValue({
      text: mockModelResponseJson,
    } as any);

    const input: VisionExtractionInput = {
      imageBuffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      mimeType: 'image/png',
      fileName: 'cnn_diagram.png',
      userId: 'user-123',
    };

    const result = await service.extract(input);
    expect(result.title).toBe('Neural Network Architecture');
    expect(result.segments).toHaveLength(3);
    expect(result.segments[0].kind).toBe('heading');
    expect(result.segments[1].kind).toBe('formula');
    expect(result.segments[2].kind).toBe('visual_description');
    expect(result.rawText).toContain('Convolutional Layer');
    expect(result.rawText).toContain('$$y = f(W * x + b)$$');
  });

  it('recovers gracefully with deterministic fallback if AI call throws an error', async () => {
    const service = createService();
    mockConnectionService.snapshot.mockResolvedValue({
      models: [
        {
          id: 'google/gemini-3.6-flash',
          capabilities: { imageInput: true },
        },
      ],
    });

    mockAiService.getProviderForModel.mockRejectedValue(
      new Error('API quota exceeded'),
    );

    const input: VisionExtractionInput = {
      imageBuffer: Buffer.from([1, 2, 3]),
      mimeType: 'image/png',
      fileName: 'circuit.png',
      userId: 'user-123',
    };

    const result = await service.extract(input);
    expect(result.title).toBe('circuit');
    expect(result.segments[0].kind).toBe('visual_description');
    expect(result.warnings?.[0]).toContain('API quota exceeded');
  });
});
