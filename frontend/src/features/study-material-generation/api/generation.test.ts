import { afterEach, describe, expect, it, vi } from "vitest";
import { startGeneration } from "./generation";

function emptyStreamResponse(): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    }),
    { headers: { "X-Request-Id": "request-1" } },
  );
}

describe("startGeneration abort handle", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("passes an AbortSignal to fetch and aborts it via the returned handle", () => {
    let captured: RequestInit | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        captured = init;
        return emptyStreamResponse();
      }),
    );

    const result = startGeneration("notebook-1", {
      kind: "quiz",
      brief: "Cell biology",
      sourceIds: [],
    });

    expect(captured?.signal).toBeInstanceOf(AbortSignal);
    const signal = captured?.signal as AbortSignal;
    expect(signal.aborted).toBe(false);

    result.abort();

    expect(signal.aborted).toBe(true);
  });
});
