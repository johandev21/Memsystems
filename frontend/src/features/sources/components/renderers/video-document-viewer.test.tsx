import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SourceWithContent } from "../../types";
import { VideoDocumentViewer } from "./video-document-viewer";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

const mockVideoSource: SourceWithContent = {
  id: "source-video-1",
  notebookId: "nb-1",
  kind: "file",
  modality: "video",
  title: "Lecture 5 - Neural Networks.mp4",
  url: null,
  contentType: "video/mp4",
  fileSize: 1024 * 1024 * 250,
  createdAt: "2026-08-30T12:00:00.000Z",
  rawText:
    "[00:00] Prof. Chen: Welcome to lecture five on neural networks.\n[00:15] Prof. Chen: Today we will explore convolutional layers and attention.\n[00:45] Bob: How does self-attention scale with sequence length?\n[01:00] Prof. Chen: Great question Bob. Self-attention scales quadratically.",
  s3Key: "uploads/nb-1/neural-networks.mp4",
  sha256: "video123sha",
  segments: [
    {
      id: "seg-1",
      ordinal: 1,
      kind: "transcript",
      content: "Welcome to lecture five on neural networks.",
      locator: {
        startOffsetMs: 0,
        endOffsetMs: 15_000,
        speaker: "Prof. Chen",
      },
    },
    {
      id: "seg-2",
      ordinal: 2,
      kind: "transcript",
      content: "Today we will explore convolutional layers and attention.",
      locator: {
        startOffsetMs: 15_000,
        endOffsetMs: 45_000,
        speaker: "Prof. Chen",
      },
    },
    {
      id: "seg-3",
      ordinal: 3,
      kind: "transcript",
      content: "How does self-attention scale with sequence length?",
      locator: {
        startOffsetMs: 45_000,
        endOffsetMs: 60_000,
        speaker: "Bob",
      },
    },
    {
      id: "seg-4",
      ordinal: 4,
      kind: "transcript",
      content: "Great question Bob. Self-attention scales quadratically.",
      locator: {
        startOffsetMs: 60_000,
        endOffsetMs: 90_000,
        speaker: "Prof. Chen",
      },
    },
  ],
};

const mockYouTubeSource: SourceWithContent = {
  id: "source-video-youtube-1",
  notebookId: "nb-1",
  kind: "url",
  modality: "video",
  title: "YouTube - Intro to ML",
  url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  contentType: null,
  fileSize: null,
  createdAt: "2026-08-30T12:00:00.000Z",
  rawText:
    "[00:00] Host: Welcome to today's machine learning overview.\n[00:20] Host: We will cover supervised learning basics.",
  s3Key: null,
  sha256: null,
  segments: [
    {
      id: "seg-1",
      ordinal: 1,
      kind: "transcript",
      content: "Welcome to today's machine learning overview.",
      locator: {
        startOffsetMs: 0,
        endOffsetMs: 20_000,
        speaker: "Host",
      },
    },
    {
      id: "seg-2",
      ordinal: 2,
      kind: "transcript",
      content: "We will cover supervised learning basics.",
      locator: {
        startOffsetMs: 20_000,
        endOffsetMs: 40_000,
        speaker: "Host",
      },
    },
  ],
};

const mockVideoSourceWithoutTranscripts: SourceWithContent = {
  id: "source-video-no-transcripts",
  notebookId: "nb-1",
  kind: "file",
  modality: "video",
  title: "Silent Video.mp4",
  url: null,
  contentType: "video/mp4",
  fileSize: 1024 * 1024 * 50,
  createdAt: "2026-08-30T12:00:00.000Z",
  rawText: "",
  s3Key: "uploads/nb-1/silent.mp4",
  sha256: "silent123sha",
  segments: [],
};

describe("VideoDocumentViewer", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();

    // Mock HTMLMediaElement methods
    window.HTMLMediaElement.prototype.play = vi.fn().mockImplementation(() => Promise.resolve());
    window.HTMLMediaElement.prototype.pause = vi.fn();

    // Mock picture-in-picture and fullscreen APIs if missing in jsdom
    if (!document.pictureInPictureEnabled) {
      Object.defineProperty(document, "pictureInPictureEnabled", { value: true, writable: true });
    }
    if (!HTMLVideoElement.prototype.requestPictureInPicture) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (HTMLVideoElement.prototype as any).requestPictureInPicture = vi.fn().mockResolvedValue(undefined);
    }
    if (!document.exitPictureInPicture) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (document as any).exitPictureInPicture = vi.fn().mockResolvedValue(undefined);
    }
    if (!Element.prototype.requestFullscreen) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (Element.prototype as any).requestFullscreen = vi.fn().mockResolvedValue(undefined);
    }
    if (!document.exitFullscreen) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (document as any).exitFullscreen = vi.fn().mockResolvedValue(undefined);
    }

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/download")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ url: "https://storage.example.com/neural-networks.mp4" }),
          });
        }
        if (url.includes("/transcript")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ success: true }),
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

  it("renders HTML5 video player for uploaded video with native controls and transcript segments", async () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <VideoDocumentViewer source={mockVideoSource} />
      </QueryClientProvider>,
    );

    // Responsive container present
    expect(container.querySelector(".\\@container")).toBeTruthy();

    // Native video element with controls present, iframe absent
    const videoElement = screen.getByTestId("video-element") as HTMLVideoElement;
    expect(videoElement).toBeTruthy();
    expect(videoElement.hasAttribute("controls")).toBe(true);
    expect(videoElement.hasAttribute("playsinline")).toBe(true);
    expect(screen.queryByTestId("youtube-iframe")).toBeNull();

    // Transcript segments rendered
    expect(screen.getByText("Welcome to lecture five on neural networks.")).toBeTruthy();
    expect(screen.getByText("Today we will explore convolutional layers and attention.")).toBeTruthy();
    expect(screen.getByText("How does self-attention scale with sequence length?")).toBeTruthy();

    // Speaker badges and editing are NOT rendered (removed per requirements)
    expect(screen.queryByTestId("speaker-badge")).toBeNull();
    expect(screen.queryByTestId("speaker-rename-input")).toBeNull();

    // Search bar is NOT rendered (removed per requirements)
    expect(screen.queryByTestId("transcript-search-input")).toBeNull();
  });

  it("renders YouTube iframe for YouTube sources without custom controls", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <VideoDocumentViewer source={mockYouTubeSource} />
      </QueryClientProvider>,
    );

    const iframe = screen.getByTestId("youtube-iframe") as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    expect(iframe.src).toContain("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(iframe.src).toContain("enablejsapi=1");
    expect(screen.queryByTestId("video-element")).toBeNull();
  });

  it("does not render search bar in transcript panel", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <VideoDocumentViewer source={mockVideoSource} />
      </QueryClientProvider>,
    );

    expect(screen.queryByTestId("transcript-search-input")).toBeNull();
    expect(screen.queryByPlaceholderText(/search transcript/i)).toBeNull();
  });

  it("does not render editable speaker labels or buttons", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <VideoDocumentViewer source={mockVideoSource} />
      </QueryClientProvider>,
    );

    expect(screen.queryByTestId("speaker-badge")).toBeNull();
    expect(screen.queryByTestId("speaker-rename-input")).toBeNull();
    expect(screen.queryByTestId("speaker-rename-save")).toBeNull();
  });

  it("seeks video and activates segment when clicking a transcript segment", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <VideoDocumentViewer source={mockVideoSource} />
      </QueryClientProvider>,
    );

    const videoElement = screen.getByTestId("video-element") as HTMLVideoElement;
    const bobSegment = screen.getByText("How does self-attention scale with sequence length?");

    await user.click(bobSegment);

    expect(videoElement.currentTime).toBe(45);
    expect(videoElement.play).toHaveBeenCalled();
  });

  it("seeks video when clicking a timestamp badge", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <VideoDocumentViewer source={mockVideoSource} />
      </QueryClientProvider>,
    );

    const videoElement = screen.getByTestId("video-element") as HTMLVideoElement;
    const timestampBadges = screen.getAllByTestId("segment-timestamp");

    // Click [00:15] badge for segment 2
    await user.click(timestampBadges[1]);

    expect(videoElement.currentTime).toBe(15);
    expect(videoElement.play).toHaveBeenCalled();
  });

  it("automatically seeks and scrolls when selectedLocator is passed from citation", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <VideoDocumentViewer
          source={mockVideoSource}
          selectedLocator={{
            startOffsetMs: 60_000,
            endOffsetMs: 90_000,
          }}
        />
      </QueryClientProvider>,
    );

    const videoElement = screen.getByTestId("video-element") as HTMLVideoElement;
    expect(videoElement.currentTime).toBe(60);
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("highlights active segment and autoscrolls on time update", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <VideoDocumentViewer source={mockVideoSource} />
      </QueryClientProvider>,
    );

    const videoElement = screen.getByTestId("video-element") as HTMLVideoElement;

    // Simulate time update to 46 seconds (should highlight Bob segment)
    Object.defineProperty(videoElement, "currentTime", { value: 46, writable: true });
    fireEvent.timeUpdate(videoElement);

    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("parses YouTube parentheses timestamp patterns (00:04) into multiple segments", () => {
    const youtubePatternSource: SourceWithContent = {
      ...mockVideoSource,
      segments: undefined,
      rawText: "(00:00) First part introduction\n(00:04) Second part main topic\n(00:15) Third part conclusion",
    };

    render(
      <QueryClientProvider client={queryClient}>
        <VideoDocumentViewer source={youtubePatternSource} />
      </QueryClientProvider>,
    );

    expect(screen.getByText("First part introduction")).toBeTruthy();
    expect(screen.getByText("Second part main topic")).toBeTruthy();
    expect(screen.getByText("Third part conclusion")).toBeTruthy();

    const timestampBadges = screen.getAllByTestId("segment-timestamp");
    expect(timestampBadges.length).toBe(3);
    expect(timestampBadges[0].textContent).toContain("00:00");
    expect(timestampBadges[1].textContent).toContain("00:04");
    expect(timestampBadges[2].textContent).toContain("00:15");
  });

  it("parses multi-line YouTube copied format (timestamp on line 1, text on line 2)", () => {
    const multilineSource: SourceWithContent = {
      ...mockVideoSource,
      segments: undefined,
      rawText: "0:00\nIntro to neural networks\n0:04\nAttention is all you need\n0:20\nTransformer architecture",
    };

    render(
      <QueryClientProvider client={queryClient}>
        <VideoDocumentViewer source={multilineSource} />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Intro to neural networks")).toBeTruthy();
    expect(screen.getByText("Attention is all you need")).toBeTruthy();
    expect(screen.getByText("Transformer architecture")).toBeTruthy();

    const timestampBadges = screen.getAllByTestId("segment-timestamp");
    expect(timestampBadges.length).toBe(3);
  });

  it("hides transcript section when video has no transcripts and focuses on video", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <VideoDocumentViewer source={mockVideoSourceWithoutTranscripts} />
      </QueryClientProvider>,
    );

    // Video element should be present
    expect(screen.getByTestId("video-element")).toBeTruthy();

    // Transcript panel should NOT be rendered
    expect(screen.queryByTestId("transcript-segment")).toBeNull();
    expect(screen.queryByText("Transcript", { exact: true })).toBeNull();

    // Add Transcripts button should be available
    expect(screen.getByTestId("add-transcripts-button")).toBeTruthy();
  });

  it("opens add transcript dialog when clicking add transcripts button", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <VideoDocumentViewer source={mockVideoSourceWithoutTranscripts} />
      </QueryClientProvider>,
    );

    const addBtn = screen.getByTestId("add-transcripts-button");
    await user.click(addBtn);

    expect(screen.getByText("Add Transcripts to Video")).toBeTruthy();
    expect(screen.getByTestId("add-transcript-textarea")).toBeTruthy();
    expect(screen.getByTestId("save-transcript-button")).toBeTruthy();
  });

  it("ignores obsolete mock transcript segments and treats video as having no transcripts", () => {
    const mockTranscriptSource: SourceWithContent = {
      ...mockVideoSource,
      segments: [
        {
          id: "mock-1",
          ordinal: 1,
          kind: "transcript",
          content: "Welcome back to the channel. Today we are discussing Fable 5.1.",
          locator: { startOffsetMs: 0, endOffsetMs: 15000 },
        },
        {
          id: "mock-2",
          ordinal: 2,
          kind: "transcript",
          content: "In the first part of this video, we explore the core concepts and architectural foundations.",
          locator: { startOffsetMs: 15000, endOffsetMs: 30000 },
        },
      ],
    };

    render(
      <QueryClientProvider client={queryClient}>
        <VideoDocumentViewer source={mockTranscriptSource} />
      </QueryClientProvider>,
    );

    // Transcript panel should NOT be rendered
    expect(screen.queryByTestId("transcript-segment")).toBeNull();
    expect(screen.queryByText("Transcript", { exact: true })).toBeNull();
    // Add Transcripts button should be available
    expect(screen.getByTestId("add-transcripts-button")).toBeTruthy();
  });

  it("renders both narrow and wide add transcript buttons for responsive viewports", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <VideoDocumentViewer source={mockVideoSourceWithoutTranscripts} />
      </QueryClientProvider>,
    );

    const wideBtn = screen.getByTestId("add-transcripts-button-wide");
    expect(wideBtn).toBeTruthy();
    await user.click(wideBtn);

    expect(screen.getByText("Add Transcripts to Video")).toBeTruthy();
  });
});
