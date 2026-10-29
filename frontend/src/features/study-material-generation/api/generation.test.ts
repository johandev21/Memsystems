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

  it("parses audio overview stage events from the generation stream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(
                  new TextEncoder().encode(
                    '{"stage":"writing_script"}\n{"stage":"synthesizing_audio"}\n{"done":true,"requestId":"request-1"}\n',
                  ),
                );
                controller.close();
              },
            }),
            { headers: { "X-Request-Id": "request-1" } },
          ),
      ),
    );

    const result = startGeneration("notebook-1", {
      kind: "audio_overview",
      brief: "",
      sourceIds: ["source-1"],
    });
    const events = [];
    for await (const event of result.stream) events.push(event);

    expect(events).toEqual([
      { type: "stage", stage: "writing_script" },
      { type: "stage", stage: "synthesizing_audio" },
      { type: "done", requestId: "request-1", materialId: undefined },
    ]);
  });
});
