export interface TranscriptionSegment {
  content: string;
  startOffsetMs: number;
  endOffsetMs: number;
  speaker?: string;
  confidence?: number;
}

export interface TranscriptionResult {
  title?: string;
  language?: string;
  durationMs?: number;
  durationSeconds?: number;
  segments: TranscriptionSegment[];
  rawText: string;
  warnings?: string[];
}

export interface TranscriptionInput {
  audioBuffer?: Buffer;
  buffer?: Buffer;
  mimeType:
    | 'audio/mpeg'
    | 'audio/mp4'
    | 'audio/wav'
    | 'audio/webm'
    | 'audio/ogg'
    | 'audio/aac'
    | (string & {});
  fileName?: string;
  filename?: string;
  userId?: string;
  modelId?: string;
  language?: string;
  prompt?: string;
}

export interface TranscriptionPort {
  transcribe(input: TranscriptionInput): Promise<TranscriptionResult>;
  transcribeAudio?(input: TranscriptionInput): Promise<TranscriptionResult>;
}

export const TRANSCRIPTION_PORT = Symbol('TRANSCRIPTION_PORT');
