import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PendingSourceUpload } from "../hooks/use-upload-store";
import { PendingUploadRow } from "./pending-upload-row";

function createUpload(overrides: Partial<PendingSourceUpload> = {}): PendingSourceUpload {
  return {
    id: "upload-1",
    notebookId: "notebook-1",
    kind: "file",
    modality: "video",
    title: "lecture.mp4",
    status: "processing",
    processingStage: "extracting",
    ...overrides,
  };
}

describe("PendingUploadRow identity icon", () => {
  it("uses the Markdown glyph for pending URL and media uploads", () => {
    const { container, rerender } = render(
      <PendingUploadRow
        upload={createUpload({ kind: "url", url: "https://youtube.com/watch?v=abc" })}
        onCancel={vi.fn()}
      />,
    );

    expect(container.querySelectorAll('svg[fill="currentColor"]')).toHaveLength(1);
    expect(container.querySelector("img")).toBeNull();

    rerender(
      <PendingUploadRow upload={createUpload({ kind: "file", modality: "audio" })} onCancel={vi.fn()} />,
    );
    expect(container.querySelectorAll('svg[fill="currentColor"]')).toHaveLength(1);
  });

  it("keeps the processing spinner and cancellation action", () => {
    const onCancel = vi.fn();
    const { container } = render(<PendingUploadRow upload={createUpload()} onCancel={onCancel} />);

    expect(container.querySelector("svg.animate-spin")).toBeTruthy();
    expect(screen.getByText("lecture")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel source processing" }));
    expect(onCancel).toHaveBeenCalledWith("upload-1");
  });

  it("keeps the error status glyph and uses Markdown identity after failure", () => {
    const { container } = render(
      <PendingUploadRow
        upload={createUpload({ status: "failed", errorMessage: "Import failed" })}
        onCancel={vi.fn()}
      />,
    );

    expect(container.querySelector("svg.text-destructive")).toBeTruthy();
    expect(container.querySelectorAll('svg[fill="currentColor"]')).toHaveLength(1);
    expect(screen.getByText("Import failed")).toBeTruthy();
  });
});
