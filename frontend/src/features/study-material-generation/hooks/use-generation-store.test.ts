import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import {
  GENERATION_ERROR_AUTO_DISMISS_MS,
  GENERATION_STALL_TIMEOUT_MS,
  useGenerationStore,
} from "./use-generation-store";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));
vi.mock("@/features/study-material-viewer", () => ({
  KIND_LABELS: { case_study: "Case Study" },
}));

const input = {
  kind: "case_study" as const,
  brief: "Apply philosophical reasoning",
  sourceIds: ["source-1"],
  folderId: null,
};

describe("generation startup", () => {
  beforeEach(() => {
    useGenerationStore.setState({ generations: {} });
    vi.clearAllMocks();
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each([
    [400, JSON.stringify({ error: "Select a source or enter a brief for your case study." }), "Select a source or enter a brief for your case study."],
    [500, JSON.stringify({ error: "Internal server error" }), "Internal server error"],
    [502, "<html>Bad gateway</html>", "Generation failed (502)"],
    [503, JSON.stringify({ error: { detail: "unavailable" } }), "Generation failed (503)"],
  ])("reports the HTTP %s error before requiring an ID", async (status, body, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status })));

    await useGenerationStore.getState().startBackgroundGeneration("notebook-1", input, new QueryClient());

    expect(toast.error).toHaveBeenCalledExactlyOnceWith(`Generation failed: ${message}`);
    expect(Object.values(useGenerationStore.getState().generations)).toEqual([
      expect.objectContaining({ status: "error", error: message }),
    ]);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("reports network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Failed to fetch")));
    await useGenerationStore.getState().startBackgroundGeneration("notebook-1", input, new QueryClient());
    expect(toast.error).toHaveBeenCalledExactlyOnceWith("Generation failed: Failed to fetch");
  });

  it("still detects a successful response missing its request ID", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 200 })));
    await useGenerationStore.getState().startBackgroundGeneration("notebook-1", input, new QueryClient());
    expect(toast.error).toHaveBeenCalledExactlyOnceWith("Generation failed: No request ID returned from server");
  });

  it.each(["X-Request-Id", "X-Generation-Request-Id"])("streams and completes using %s", async (header) => {
    const body = [
      JSON.stringify({ title: "philosophy-case-study" }),
      JSON.stringify({ done: true, requestId: "request-1", materialId: "material-1" }),
    ].join("\n");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, {
      headers: { [header]: "request-1" },
    })));
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    await useGenerationStore.getState().startBackgroundGeneration("notebook-1", input, client);

    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledOnce());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["study-materials", "notebook-1"] });
    expect(useGenerationStore.getState().generations).toEqual({});
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("treats EOF without done as an error instead of streaming forever", async () => {
    const body = [JSON.stringify({ title: "philosophy-case-study" })].join("\n");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(body, { headers: { "X-Request-Id": "request-eof" } })),
    );

    await useGenerationStore.getState().startBackgroundGeneration("notebook-1", input, new QueryClient());

    await vi.waitFor(() =>
      expect(Object.values(useGenerationStore.getState().generations)).toEqual([
        expect.objectContaining({ status: "error" }),
      ]),
    );
    const entry = useGenerationStore.getState().generations["request-eof"];
    expect(entry?.error).toContain("Connection closed before finishing");
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Connection closed before finishing"),
    );
    expect(toast.success).not.toHaveBeenCalled();
    // Entries carry stall-tracking timestamps.
    expect(typeof entry?.startedAt).toBe("number");
    expect(typeof entry?.lastChunkAt).toBe("number");
  });
});

describe("generation stall timeout", () => {
  beforeEach(() => {
    useGenerationStore.setState({ generations: {} });
    vi.clearAllMocks();
  });

  afterEach(() => {
    for (const id of Object.keys(useGenerationStore.getState().generations)) {
      useGenerationStore.getState().dismissGeneration(id);
    }
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("errors a stalled stream after the timeout and auto-dismisses it", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(new ReadableStream({}), { headers: { "X-Request-Id": "request-stall" } }),
      ),
    );

    await useGenerationStore.getState().startBackgroundGeneration("notebook-1", input, new QueryClient());
    expect(useGenerationStore.getState().generations["request-stall"]?.status).toBe("streaming");

    await vi.advanceTimersByTimeAsync(GENERATION_STALL_TIMEOUT_MS);

    const entry = useGenerationStore.getState().generations["request-stall"];
    expect(entry?.status).toBe("error");
    expect(entry?.error).toContain("Generation timed out");
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Generation timed out"));

    await vi.advanceTimersByTimeAsync(GENERATION_ERROR_AUTO_DISMISS_MS);
    expect(useGenerationStore.getState().generations["request-stall"]).toBeUndefined();
  });
});
