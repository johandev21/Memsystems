import { describe, expect, it, vi } from 'vitest';
import {
  normalizeSpeakerLabel,
  parseTranscriptionJson,
  TRANSCRIPTION_SYSTEM_PROMPT,
  TranscriptionService,
} from '../src/modules/sources/transcription.service';
import { TranscriptionInput } from '../src/modules/sources/transcription.port';

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

describe('parseTranscriptionJson', () => {
  it('parses valid structured JSON with speaker labels, monotonic timestamps, and confidence', () => {
    const raw = JSON.stringify({
      title: 'Quarterly Research Review',
      language: 'en',
      durationMs: 12500,
      segments: [
        {
          speaker: 'Speaker A',
          startOffsetMs: 0,
          endOffsetMs: 4500,
          content: 'Welcome everyone to the quarterly review.',
          confidence: 0.98,
        },
        {
          speaker: 'Speaker B',
          startOffsetMs: 4800,
          endOffsetMs: 12500,
          content: 'Thank you. Here are our key memory benchmarks.',
          confidence: 0.95,
        },
      ],
    });

    const parsed = parseTranscriptionJson(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.title).toBe('Quarterly Research Review');
    expect(parsed?.language).toBe('en');
    expect(parsed?.durationMs).toBe(12500);
    expect(parsed?.segments).toHaveLength(2);

    expect(parsed?.segments[0]).toEqual({
      speaker: 'Speaker A',
      startOffsetMs: 0,
      endOffsetMs: 4500,
      content: 'Welcome everyone to the quarterly review.',
      confidence: 0.98,
    });

    expect(parsed?.segments[1]).toEqual({
      speaker: 'Speaker B',
      startOffsetMs: 4800,
      endOffsetMs: 12500,
      content: 'Thank you. Here are our key memory benchmarks.',
      confidence: 0.95,
    });
  });

  it('strips markdown code fences before parsing JSON', () => {
    const raw =
      '```json\n{\n  "title": "Interview",\n  "segments": [\n    {\n      "speaker": "Speaker A",\n      "startOffsetMs": 100,\n      "endOffsetMs": 800,\n      "content": "Can you hear me?"\n    }\n  ]\n}\n```';

    const parsed = parseTranscriptionJson(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.title).toBe('Interview');
    expect(parsed?.segments[0].content).toBe('Can you hear me?');
    expect(parsed?.segments[0].startOffsetMs).toBe(100);
    expect(parsed?.segments[0].endOffsetMs).toBe(800);
  });

  it('enforces monotonic timestamps when timestamps are reversed or overlapping', () => {
    const raw = JSON.stringify({
      segments: [
        {
          speaker: 'Speaker A',
          startOffsetMs: 2000,
          endOffsetMs: 1000, // invalid end < start
          content: 'Segment 1',
        },
        {
          speaker: 'Speaker B',
          startOffsetMs: 500, // invalid start < last end
          endOffsetMs: 2500,
          content: 'Segment 2',
        },
      ],
    });

    const parsed = parseTranscriptionJson(raw);
    expect(parsed).not.toBeNull();
    const segs = parsed!.segments;
    expect(segs).toHaveLength(2);

    // Segment 1 end offset adjusted
    expect(segs[0].startOffsetMs).toBe(2000);
    expect(segs[0].endOffsetMs).toBe(3000);

    // Segment 2 start offset bumped to monotonic position >= segment 1 end
    expect(segs[1].startOffsetMs).toBe(3000);
    expect(segs[1].endOffsetMs).toBe(4000);
  });

  it('returns null for invalid JSON or non-object text', () => {
    expect(parseTranscriptionJson('Not JSON')).toBeNull();
    expect(parseTranscriptionJson('')).toBeNull();
    expect(parseTranscriptionJson('[]')).toBeNull();
  });
});

describe('normalizeSpeakerLabel', () => {
  it('maps custom and raw speaker identifiers consistently to anonymous letters', () => {
    const speakerMap = new Map<string, string>();

    expect(normalizeSpeakerLabel('Alice', speakerMap)).toBe('Speaker A');
    expect(normalizeSpeakerLabel('Bob', speakerMap)).toBe('Speaker B');
    expect(normalizeSpeakerLabel('Alice', speakerMap)).toBe('Speaker A');
    expect(normalizeSpeakerLabel('Charlie', speakerMap)).toBe('Speaker C');
  });

  it('preserves existing standard speaker labels like Speaker A', () => {
    const speakerMap = new Map<string, string>();

    expect(normalizeSpeakerLabel('Speaker A', speakerMap)).toBe('Speaker A');
    expect(normalizeSpeakerLabel('Speaker B', speakerMap)).toBe('Speaker B');
  });
});

describe('TranscriptionService', () => {
  const mockAiService = {
    getProviderForModel: vi.fn(),
  };
  const mockConnectionService = {
    snapshot: vi.fn(),
  };

  const createService = () =>
    new TranscriptionService(
      mockAiService as any,
      mockConnectionService as any,
    );

  it('falls back to deterministic transcription when no userId is provided', async () => {
    const service = createService();
    const input: TranscriptionInput = {
      audioBuffer: Buffer.from([1, 2, 3]),
      mimeType: 'audio/mp3' as any,
      fileName: 'lecture_01.mp3',
    };

    const result = await service.transcribe(input);
    expect(result.title).toBe('lecture_01');
    expect(result.rawText).toBe('[Audio: lecture_01.mp3]');
    expect(result.segments).toEqual([
      {
        speaker: 'Speaker A',
        content: '[Audio: lecture_01.mp3]',
        startOffsetMs: 0,
        endOffsetMs: 1000,
      },
    ]);
    expect(result.warnings?.[0]).toContain('Audio model unavailable');
  });

  it('falls back to deterministic transcription when no models are connected', async () => {
    const service = createService();
    mockConnectionService.snapshot.mockResolvedValue({
      models: [],
    });

    const input: TranscriptionInput = {
      audioBuffer: Buffer.from([1, 2, 3]),
      mimeType: 'audio/wav',
      fileName: 'interview.wav',
      userId: 'user-123',
    };

    const result = await service.transcribe(input);
    expect(result.title).toBe('interview');
    expect(result.segments[0].content).toBe('[Audio: interview.wav]');
  });

  it('invokes AI model and parses structured segments when audio model is available', async () => {
    const service = createService();
    mockConnectionService.snapshot.mockResolvedValue({
      models: [
        {
          id: 'google/gemini-3.6-flash',
          capabilities: { audioInput: true, imageInput: true },
        },
      ],
    });

    const mockModel = {};
    const mockProvider = {
      createModel: vi.fn().mockReturnValue(mockModel),
    };
    mockAiService.getProviderForModel.mockResolvedValue(mockProvider);

    const mockResponseJson = JSON.stringify({
      title: 'Algorithm Lecture',
      language: 'en',
      durationMs: 8000,
      segments: [
        {
          speaker: 'Speaker A',
          startOffsetMs: 0,
          endOffsetMs: 3500,
          content: 'Let us discuss dynamic programming.',
          confidence: 0.96,
        },
        {
          speaker: 'Speaker B',
          startOffsetMs: 4000,
          endOffsetMs: 8000,
          content: 'Specifically, memoization vs tabulation.',
          confidence: 0.94,
        },
      ],
    });

    mockGenerateText.mockResolvedValue({
      text: mockResponseJson,
    } as any);

    const input: TranscriptionInput = {
      audioBuffer: Buffer.from([0x49, 0x44, 0x33]),
      mimeType: 'audio/mpeg',
      fileName: 'lecture.mp3',
      userId: 'user-123',
    };

    const result = await service.transcribe(input);
    expect(result.title).toBe('Algorithm Lecture');
    expect(result.language).toBe('en');
    expect(result.durationMs).toBe(8000);
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0].speaker).toBe('Speaker A');
    expect(result.segments[1].speaker).toBe('Speaker B');
    expect(result.rawText).toContain('Let us discuss dynamic programming.');
    expect(result.rawText).toContain(
      'Specifically, memoization vs tabulation.',
    );
  });

  it('recovers gracefully with deterministic fallback if AI service throws an error', async () => {
    const service = createService();
    mockConnectionService.snapshot.mockResolvedValue({
      models: [
        {
          id: 'google/gemini-3.6-flash',
          capabilities: { audioInput: true },
        },
      ],
    });

    mockAiService.getProviderForModel.mockRejectedValue(
      new Error('Provider rate limit reached'),
    );

    const input: TranscriptionInput = {
      audioBuffer: Buffer.from([1, 2, 3]),
      mimeType: 'audio/wav',
      fileName: 'pod.wav',
      userId: 'user-123',
    };

    const result = await service.transcribe(input);
    expect(result.title).toBe('pod');
    expect(result.segments[0].content).toBe('[Audio: pod.wav]');
    expect(result.warnings?.[0]).toContain('Provider rate limit reached');
  });
});
