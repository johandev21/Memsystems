import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchApi } from "@/shared/api";
import type { SourceWithContent } from "../../types";
import { useSourceReaderControls } from "./use-source-reader-controls";

vi.mock("@/shared/api", () => ({ fetchApi: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const source: SourceWithContent = {
  id: "nietzsche-pdf",
  notebookId: "notebook-1",
  kind: "file",
  title: "Nietzsche.pdf",
  url: null,
  contentType: "application/pdf",
  fileSize: 100,
  createdAt: "2026-10-22T12:00:00.000Z",
  rawText: "# Nietzsche\n\nExtracted Markdown.",
  s3Key: "uploads/Nietzsche.pdf",
  sha256: null,
};

describe("source reader original download", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(fetchApi).mockReset();
  });

  it("downloads the stored original instead of exporting the displayed Markdown", async () => {
    const originalUrl = "https://storage.example/Nietzsche.pdf?signature=original";
    vi.mocked(fetchApi).mockResolvedValue(
      new Response(JSON.stringify({ url: originalUrl, expiresIn: 300 })),
    );
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const { result } = renderHook(() =>
      useSourceReaderControls({ source, onClose: vi.fn() }),
    );

    await act(async () => result.current.handleDownload());

    expect(fetchApi).toHaveBeenCalledExactlyOnceWith("/api/sources/nietzsche-pdf/download");
    expect(open).toHaveBeenCalledWith(originalUrl, "_blank", "noopener,noreferrer");
    expect(result.current.downloading).toBe(false);
  });

  it("does not request a file download for a URL source", async () => {
    const { result } = renderHook(() =>
      useSourceReaderControls({
        source: { ...source, kind: "url", url: "https://www.youtube.com/watch?v=example" },
        onClose: vi.fn(),
      }),
    );

    await act(async () => result.current.handleDownload());

    expect(fetchApi).not.toHaveBeenCalled();
  });

  it("does not open a window when the original download request fails", async () => {
    vi.mocked(fetchApi).mockResolvedValue(new Response(null, { status: 500 }));
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const { result } = renderHook(() =>
      useSourceReaderControls({ source, onClose: vi.fn() }),
    );

    await act(async () => result.current.handleDownload());

    expect(open).not.toHaveBeenCalled();
    expect(result.current.downloading).toBe(false);
  });
});
