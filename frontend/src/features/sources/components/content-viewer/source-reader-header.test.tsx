import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { fetchApi } from "@/shared/api";
import { retrySource } from "../../api/sources";
import type { SourceWithContent } from "../../types";
import { SourceReaderHeader } from "./source-reader-header";

vi.mock("../../api/sources", () => ({ retrySource: vi.fn() }));
vi.mock("@/shared/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/api")>()),
  fetchApi: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));

const source: SourceWithContent = {
  id: "youtube-source",
  notebookId: "notebook",
  kind: "url",
  title: "Nietzsche lecture",
  url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  modality: "video",
  contentType: "text/html",
  fileSize: null,
  createdAt: "2026-10-22T12:00:00Z",
  rawText: "",
  s3Key: null,
  sha256: null,
};

function renderHeader(overrides: Partial<SourceWithContent> = {}) {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  render(
    <QueryClientProvider client={client}>
      <SourceReaderHeader
        source={{ ...source, ...overrides }}
        controls={{
          downloading: false,
          handleDownload: vi.fn(),
          isEffectivelyFullscreen: false,
          isFullscreen: false,
          scrollElement: null,
          setScrollElement: vi.fn(),
          toggleFullscreen: vi.fn(),
        }}
        onClose={vi.fn()}
      />
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), invalidate };
}

describe("YouTube caption recovery", () => {
  beforeEach(() => vi.resetAllMocks());

  it("imports caption text using the existing transcript endpoint", async () => {
    vi.mocked(fetchApi).mockResolvedValue(new Response("{}", { status: 200 }));
    const { user, invalidate } = renderHeader();
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Import captions" }));
    await user.type(
      await screen.findByLabelText("Paste Transcript or Subtitles"),
      "Nietzsche discusses philosophy.",
    );
    await user.click(screen.getByRole("button", { name: "Save Transcripts" }));

    await waitFor(() =>
      expect(fetchApi).toHaveBeenCalledWith(
        "/api/sources/youtube-source/transcript",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ transcriptText: "Nietzsche discusses philosophy." }),
        }),
      ),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["source", source.id] });
    expect(document.querySelector("iframe, video, audio")).toBeNull();
  });

  it("retries caption acquisition and refreshes both source queries", async () => {
    vi.mocked(retrySource).mockResolvedValue({});
    const { user, invalidate } = renderHeader();
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Retry captions" }));

    await waitFor(() => expect(retrySource).toHaveBeenCalledWith(source.id));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["source", source.id] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["sources", source.notebookId] });
  });

  it("reports retry errors without claiming success", async () => {
    vi.mocked(retrySource).mockRejectedValue(new Error("Captions unavailable"));
    const { user, invalidate } = renderHeader();
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Retry captions" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Captions unavailable"));
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("disables caption actions while processing", async () => {
    const { user } = renderHeader({ processingStatus: "processing" });
    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(
      (await screen.findByRole("menuitem", { name: "Retry captions" })).getAttribute(
        "aria-disabled",
      ),
    ).toBe("true");
    expect(
      screen.getByRole("menuitem", { name: "Import captions" }).getAttribute("aria-disabled"),
    ).toBe("true");
  });

  it("does not add caption actions to other documents", async () => {
    const { user } = renderHeader({ url: "https://example.com/article", modality: "document" });
    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(await screen.findByRole("menuitem", { name: "Open original webpage" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Import captions" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Retry captions" })).toBeNull();
  });
});
