import type { Response } from 'express';

export async function pipeGenerationStreamToResponse(
  stream: ReadableStream<Uint8Array>,
  requestId: string,
  res: Response,
  abortOnDisconnect: () => void,
) {
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Generation-Request-Id', requestId);

  const reader = stream.getReader();
  let terminalSent = false;
  const writeTerminalError = (message: string) => {
    if (terminalSent) return;
    terminalSent = true;
    if (!res.headersSent) {
      res
        .status(500)
        .json({ error: message, code: 'generation_failed', requestId });
    } else {
      res.write(`${JSON.stringify({ error: message, requestId })}\n`);
    }
  };
  try {
    while (true) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        writeTerminalError(message);
        return;
      }
      if (chunk.done) break;
      if (chunk.value) {
        try {
          const text = Buffer.from(chunk.value).toString('utf8');
          for (const line of text.split('\n')) {
            const candidate = line.trim();
            if (!candidate) continue;
            try {
              const frame: unknown = JSON.parse(candidate);
              if (
                frame &&
                typeof frame === 'object' &&
                ('done' in frame || 'error' in frame)
              ) {
                terminalSent = true;
              }
            } catch {
              void 0;
            }
          }
        } catch {
          void 0;
        }
        res.write(chunk.value);
      }
    }
    if (!terminalSent) {
      writeTerminalError('Generation stream ended without a terminal frame.');
    }
  } finally {
    res.off('close', abortOnDisconnect);
    try {
      reader.releaseLock();
    } catch {
      void 0;
    }
    if (!res.writableEnded) res.end();
  }
}
