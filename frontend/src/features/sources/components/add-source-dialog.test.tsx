import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddSourceDialog } from "./add-source-dialog";
import { TextInputMode } from "./text-input-mode";
import { UrlInputMode } from "./url-input-mode";

function renderWithClient(ui: React.ReactElement) {
  const testClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(<QueryClientProvider client={testClient}>{ui}</QueryClientProvider>);
}

describe("AddSourceDialog & Source Modes Layout & Transcript Handling", () => {
  it("renders AddSourceDialog with viewport height bounds and scrollable container", () => {
    renderWithClient(
      <AddSourceDialog notebookId="nb-test">
        <button type="button">Add Source</button>
      </AddSourceDialog>,
    );

    const trigger = screen.getByRole("button", { name: "Add Source" });
    fireEvent.click(trigger);

    const dialogTitle = screen.getByText("Add Knowledge Sources");
    expect(dialogTitle).not.toBeNull();

    const dialogContent = dialogTitle.closest('[data-slot="dialog-content"]');
    expect(dialogContent).not.toBeNull();
    expect(dialogContent?.className).toContain("max-h-[85vh]");
    expect(dialogContent?.className).toContain("flex");
    expect(dialogContent?.className).toContain("flex-col");
    expect(dialogContent?.className).toContain("overflow-hidden");

    // Scrollable body container exists inside dialog content
    const scrollContainer = dialogContent?.querySelector(".overflow-y-auto");
    expect(scrollContainer).not.toBeNull();
    expect(scrollContainer?.className).toContain("flex-1");
  });

  describe("UrlInputMode", () => {
    it("renders caption textarea with bounded height and handles large transcripts", () => {
      const handleCaptionChange = vi.fn();
      const handleSubmit = vi.fn();

      const { rerender } = render(
        <UrlInputMode
          urlValue="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
          onUrlValueChange={vi.fn()}
          urlTitle="Rick Roll"
          onUrlTitleChange={vi.fn()}
          captionText=""
          onCaptionTextChange={handleCaptionChange}
          onSubmit={handleSubmit}
          onBack={vi.fn()}
          isPending={false}
          busy={false}
        />,
      );

      // Open advanced options
      const advancedToggle = screen.getByRole("button", {
        name: /Custom Captions & OAuth Options/i,
      });
      fireEvent.click(advancedToggle);

      const textarea = screen.getByPlaceholderText(/00:00:01.000 --> 00:00:04.000/i);
      expect(textarea.className).toContain("max-h-52");
      expect(textarea.className).toContain("overflow-y-auto");
      expect(textarea.className).toContain("resize-y");

      // Generate a 500-line transcript
      const longTranscript = Array.from(
        { length: 500 },
        (_, i) => `00:${String(i).padStart(2, "0")}:00.000 --> Line ${i + 1} transcript payload`,
      ).join("\n");

      rerender(
        <UrlInputMode
          urlValue="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
          onUrlValueChange={vi.fn()}
          urlTitle="Rick Roll"
          onUrlTitleChange={vi.fn()}
          captionText={longTranscript}
          onCaptionTextChange={handleCaptionChange}
          onSubmit={handleSubmit}
          onBack={vi.fn()}
          isPending={false}
          busy={false}
        />,
      );

      expect(screen.getByText(/500 lines/i)).not.toBeNull();

      // Click Clear
      const clearButton = screen.getByRole("button", { name: "Clear" });
      fireEvent.click(clearButton);
      expect(handleCaptionChange).toHaveBeenCalledWith("");
    });
  });

  describe("TextInputMode", () => {
    it("renders text area with bounded height and shows line/char count with clear button", () => {
      const handleBodyChange = vi.fn();
      const handleSubmit = vi.fn();

      const { rerender } = render(
        <TextInputMode
          textTitle="My Notes"
          onTextTitleChange={vi.fn()}
          textBody=""
          onTextBodyChange={handleBodyChange}
          onSubmit={handleSubmit}
          onBack={vi.fn()}
          isPending={false}
          busy={false}
        />,
      );

      const textarea = screen.getByPlaceholderText(/Paste your copied text here.../i);
      expect(textarea.className).toContain("max-h-64");
      expect(textarea.className).toContain("overflow-y-auto");
      expect(textarea.className).toContain("resize-y");

      // Set multi-line body
      rerender(
        <TextInputMode
          textTitle="My Notes"
          onTextTitleChange={vi.fn()}
          textBody={"Line 1\nLine 2\nLine 3"}
          onTextBodyChange={handleBodyChange}
          onSubmit={handleSubmit}
          onBack={vi.fn()}
          isPending={false}
          busy={false}
        />,
      );

      expect(screen.getByText(/3 lines/i)).not.toBeNull();

      const clearButton = screen.getByRole("button", { name: "Clear" });
      fireEvent.click(clearButton);
      expect(handleBodyChange).toHaveBeenCalledWith("");
    });
  });
});
