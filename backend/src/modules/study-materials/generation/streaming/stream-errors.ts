export class AudioGenerationError extends Error {
  constructor(message: string) {
    super(JSON.stringify({ error: message, code: 'audio_synthesis_failed' }));
  }
}

export class AudioScriptLengthError extends Error {
  constructor(message: string) {
    super(
      JSON.stringify({ error: message, code: 'audio_script_length_invalid' }),
    );
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'ResponseAborted')
  );
}
