import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddSourceDialog } from "./add-source-dialog";
import { FileUploadMode } from "./file-upload-mode";
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
    expect(dialogContent?.className).toContain("max-h-[calc(100dvh-1rem)]");
    expect(dialogContent?.className).toContain("flex");
    expect(dialogContent?.className).toContain("flex-col");
    expect(dialogContent?.className).toContain("overflow-hidden");

    // Scrollable body container exists inside dialog content
    const scrollContainer = dialogContent?.querySelector(".overflow-y-auto");
    expect(scrollContainer).not.toBeNull();
    expect(scrollContainer?.className).toContain("flex-1");
    expect(screen.getByText("Find sources on the web")).not.toBeNull();
    expect(screen.getByPlaceholderText("What would you like to research?")).not.toBeNull();
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
        name: /Captions & video options/i,
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

      const textarea = screen.getByPlaceholderText(/Paste text, notes, or excerpts here.../i);
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

    it("triggers onBack when Back button is clicked", () => {
      const handleBack = vi.fn();
      render(
        <TextInputMode
          textTitle=""
          onTextTitleChange={vi.fn()}
          textBody=""
          onTextBodyChange={vi.fn()}
          onSubmit={vi.fn()}
          onBack={handleBack}
          isPending={false}
          busy={false}
        />,
      );

      const backButton = screen.getByRole("button", { name: "Back" });
      fireEvent.click(backButton);
      expect(handleBack).toHaveBeenCalledTimes(1);
    });
  });

  it("updates header title and provides header back navigation when switching to url or text mode", () => {
    renderWithClient(
      <AddSourceDialog notebookId="nb-test">
        <button type="button">Add Source</button>
      </AddSourceDialog>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add Source" }));

    // Switch to URL mode
    const websiteButton = screen.getByRole("button", { name: /Websites/i });
    fireEvent.click(websiteButton);

    expect(screen.getByText("Add Web Link")).not.toBeNull();
    expect(screen.getByText("Import an article, webpage, or video.")).not.toBeNull();

    // Click header back button
    const backBtn = screen.getByLabelText("Back");
    fireEvent.click(backBtn);

    // Should return to main menu
    expect(screen.getByText("Add Knowledge Sources")).not.toBeNull();

    // Switch to Text mode
    const textButton = screen.getByRole("button", { name: /Copied Text/i });
    fireEvent.click(textButton);

    expect(screen.getByText("Paste Text")).not.toBeNull();
    expect(screen.getByText("Add notes or copied text directly.")).not.toBeNull();
  });

  describe("FileUploadMode", () => {
    it("does not include hover brightness on dashed border and only highlights when dragging files", () => {
      render(
        <FileUploadMode
          onSelectUrlMode={vi.fn()}
          onSelectTextMode={vi.fn()}
          onUploadFile={vi.fn()}
          isUploading={false}
          busy={false}
        />,
      );

      const dropzone = screen.getByText("Drop your files here").closest(".border-dashed");
      expect(dropzone).not.toBeNull();

      // Normal state: dashed border is subtle without hover bright classes
      expect(dropzone?.className).toContain("border-border/60");
      expect(dropzone?.className).toContain("bg-muted/20");
      expect(dropzone?.className).not.toContain("hover:border-primary/40");
      expect(dropzone?.className).not.toContain("hover:bg-primary/5");

      // When dragging files over: border and background change
      fireEvent.dragEnter(dropzone!);
      expect(dropzone?.className).toContain("border-primary");
      expect(dropzone?.className).toContain("bg-primary/5");

      // When drag leaves: returns to non-active state
      fireEvent.dragLeave(dropzone!);
      expect(dropzone?.className).toContain("border-border/60");
      expect(dropzone?.className).not.toContain("border-primary");
    });
  });
});

