import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { useGenerationStore } from "./use-generation-store";

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
});
