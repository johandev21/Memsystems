import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SourceWithContent } from "../../types";
import { ImageDocumentViewer } from "./image-document-viewer";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

const mockImageSource: SourceWithContent = {
  id: "source-img-1",
  notebookId: "nb-1",
  kind: "file",
  modality: "image",
  title: "Kinematics Diagram.png",
  url: null,
  contentType: "image/png",
  fileSize: 1024 * 500,
  createdAt: "2026-08-30T12:00:00.000Z",
  rawText:
    "# Kinematics Diagram\n\nAcceleration curve for projectile motion.\n\n$$a = \\frac{dv}{dt}$$\n\n### Visual Description\nLine graph showing velocity vs time with shaded area under the curve.",
  s3Key: "uploads/nb-1/kinematics.png",
  sha256: "abc123sha",
  segments: [
    {
      id: "seg-1",
      ordinal: 1,
      kind: "heading",
      content: "Kinematics Diagram",
    },
    {
      id: "seg-2",
      ordinal: 2,
      kind: "text",
      content: "Acceleration curve for projectile motion.",
      locator: {
        imageRegion: { x: 0.05, y: 0.1, width: 0.4, height: 0.15 },
      },
    },
    {
      id: "seg-3",
      ordinal: 3,
      kind: "formula",
      content: "$$a = \\frac{dv}{dt}$$",
      locator: {
        imageRegion: { x: 0.55, y: 0.1, width: 0.35, height: 0.2 },
      },
    },
    {
      id: "seg-4",
      ordinal: 4,
      kind: "visual_description",
      content: "Line graph showing velocity vs time with shaded area under the curve.",
      locator: {
        imageRegion: { x: 0.1, y: 0.4, width: 0.8, height: 0.5 },
      },
    },
  ],
};

describe("ImageDocumentViewer", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/download")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ url: "https://storage.example.com/kinematics.png" }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({}),
        });
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders image document viewer with split layout, original image, and extracted notes", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ImageDocumentViewer source={mockImageSource} />
      </QueryClientProvider>,
    );

    // Toolbar elements
    expect(screen.getByText("Image Document")).toBeTruthy();
    expect(screen.getByText("3 visual regions")).toBeTruthy();
    expect(screen.getByText("Split")).toBeTruthy();
    expect(screen.getByText("Image")).toBeTruthy();
    expect(screen.getByText("Notes")).toBeTruthy();

    // Extracted Notes section
    expect(screen.getByText("Extracted Notes")).toBeTruthy();
    expect(screen.getByText("Kinematics Diagram")).toBeTruthy();
    expect(screen.getByText("Acceleration curve for projectile motion.")).toBeTruthy();
    expect(screen.getByText("Visual Description")).toBeTruthy();

    // Check image element loaded
    const image = await screen.findByAltText("Kinematics Diagram.png");
    expect(image).toBeTruthy();
    expect(image.getAttribute("src")).toBe("https://storage.example.com/kinematics.png");
  });

  it("renders bounding box overlays for segments with image regions", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ImageDocumentViewer source={mockImageSource} />
      </QueryClientProvider>,
    );

    await screen.findByAltText("Kinematics Diagram.png");

    // Bounding box buttons for segments with regions
    const regionButtons = screen.getAllByTestId("image-region-box");
    expect(regionButtons.length).toBe(3);
  });

  it("interactively highlights a segment when clicking a bounding box or note card", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <ImageDocumentViewer source={mockImageSource} />
      </QueryClientProvider>,
    );

    await screen.findByAltText("Kinematics Diagram.png");

    const region4Button = screen.getByLabelText("Region #4: visual_description");
    await user.click(region4Button);

    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();

    // Clicking a note card also toggles/highlights
    const noteCard = screen.getByText("Acceleration curve for projectile motion.");
    await user.click(noteCard);
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("automatically activates and highlights when selectedLocator is passed from citation", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ImageDocumentViewer
          source={mockImageSource}
          selectedLocator={{
            imageRegion: { x: 0.1, y: 0.4, width: 0.8, height: 0.5 },
          }}
        />
      </QueryClientProvider>,
    );

    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("supports zooming in, zooming out, and resetting zoom", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <ImageDocumentViewer source={mockImageSource} />
      </QueryClientProvider>,
    );

    expect(screen.getByText("100%")).toBeTruthy();

    const zoomInBtn = screen.getByTitle("Zoom In");
    await user.click(zoomInBtn);
    expect(screen.getByText("125%")).toBeTruthy();

    const zoomOutBtn = screen.getByTitle("Zoom Out");
    await user.click(zoomOutBtn);
    expect(screen.getByText("100%")).toBeTruthy();

    await user.click(zoomInBtn);
    await user.click(zoomInBtn);
    expect(screen.getByText("150%")).toBeTruthy();

    const resetBtn = screen.getByTitle("Reset Zoom (100%)");
    await user.click(resetBtn);
    expect(screen.getByText("100%")).toBeTruthy();
  });

  it("switches view modes between Split, Image Only, and Notes Only", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <ImageDocumentViewer source={mockImageSource} />
      </QueryClientProvider>,
    );

    await screen.findByAltText("Kinematics Diagram.png");

    const imageModeBtn = screen.getByTitle("Image Only");
    await user.click(imageModeBtn);

    // Notes heading hidden in image only mode
    expect(screen.queryByText("Extracted Notes")).toBeNull();
    expect(screen.getByAltText("Kinematics Diagram.png")).toBeTruthy();

    const notesModeBtn = screen.getByTitle("Notes Only");
    await user.click(notesModeBtn);

    expect(screen.getByText("Extracted Notes")).toBeTruthy();
    expect(screen.queryByAltText("Kinematics Diagram.png")).toBeNull();
  });

  it("renders warnings when source has degraded or unreadable content", () => {
    const warningSource: SourceWithContent = {
      ...mockImageSource,
      processingErrorMessage: "Partially unreadable: Low resolution handwriting in diagram",
    };

    render(
      <QueryClientProvider client={queryClient}>
        <ImageDocumentViewer source={warningSource} />
      </QueryClientProvider>,
    );

    expect(
      screen.getByText("Partially unreadable: Low resolution handwriting in diagram"),
    ).toBeTruthy();
  });

  it("parses rawText when segments array is not provided", () => {
    const rawTextSource: SourceWithContent = {
      ...mockImageSource,
      segments: undefined,
      rawText: "# Raw Diagram\n\nDiagram showing velocity vectors.\n\n$$v = v_0 + at$$",
    };

    render(
      <QueryClientProvider client={queryClient}>
        <ImageDocumentViewer source={rawTextSource} />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Raw Diagram")).toBeTruthy();
    expect(screen.getByText("Diagram showing velocity vectors.")).toBeTruthy();
  });
});
