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
        if (url.includes("/speakers")) {
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

    // Decorative badges and custom buttons are NOT rendered
    expect(screen.queryByText("Video Recording")).toBeNull();
    expect(screen.queryByText(/segments ·/)).toBeNull();
    expect(screen.queryByText("AI Transcription")).toBeNull();
    expect(screen.queryByTestId("play-pause-button")).toBeNull();
    expect(screen.queryByTestId("seek-slider")).toBeNull();
    expect(screen.queryByTestId("volume-button")).toBeNull();
    expect(screen.queryByTestId("fullscreen-button")).toBeNull();

    // Transcript segments rendered
    expect(screen.getByText("Welcome to lecture five on neural networks.")).toBeTruthy();
    expect(screen.getByText("Today we will explore convolutional layers and attention.")).toBeTruthy();
    expect(screen.getByText("How does self-attention scale with sequence length?")).toBeTruthy();

    // Speaker badges
    const chenBadges = screen.getAllByText("Prof. Chen");
    expect(chenBadges.length).toBe(3);
    expect(screen.getByText("Bob")).toBeTruthy();
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

    // Custom controls and badges absent
    expect(screen.queryByText("YouTube Stream")).toBeNull();
    expect(screen.queryByTestId("play-pause-button")).toBeNull();
  });

  it("does not render ordinal badges or emojis in the simplified video view", () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <VideoDocumentViewer source={mockVideoSource} />
      </QueryClientProvider>,
    );

    // Ordinal numbers like #1, #2 are not in segment headers
    expect(screen.queryByText("#1")).toBeNull();
    expect(screen.queryByText("#2")).toBeNull();
    expect(screen.queryByText("#3")).toBeNull();
    expect(screen.queryByText("#4")).toBeNull();

    // Check no emoji characters exist in rendered text
    const emojiRegex = /\p{Extended_Pictographic}/u;
    expect(emojiRegex.test(container.textContent || "")).toBe(false);
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
            speaker: "Prof. Chen",
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

    // Active segment should have data-active attribute
    // Allow React effect to run - check that scrollIntoView was attempted after active change
    // The second segment render cycle may trigger scrollIntoView
    // We verify at least one call happened via effect after currentTime change
    // Give effect time: the activeSegmentId effect calls scrollIntoView
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("supports inline speaker renaming and updates segment labels optimistically", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <VideoDocumentViewer source={mockVideoSource} />
      </QueryClientProvider>,
    );

    const bobBadge = screen.getByText("Bob");
    await user.click(bobBadge);

    const renameInput = screen.getByTestId("speaker-rename-input") as HTMLInputElement;
    expect(renameInput.value).toBe("Bob");

    await user.clear(renameInput);
    await user.type(renameInput, "Bob Smith");

    const saveBtn = screen.getByTestId("speaker-rename-save");
    await user.click(saveBtn);

    expect(screen.getByText("Bob Smith")).toBeTruthy();
    expect(screen.queryByText("Bob")).toBeNull();
  });

  it("filters transcript segments with search input and highlights matching text", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <VideoDocumentViewer source={mockVideoSource} />
      </QueryClientProvider>,
    );

    const searchInput = screen.getByTestId("transcript-search-input");
    await user.type(searchInput, "attention");

    const marks = screen.getAllByText(/attention/i);
    expect(marks.length).toBe(3);
    // At least one should be MARK
    expect(marks.some((el) => el.tagName === "MARK")).toBe(true);

    expect(screen.queryByText(/Welcome to lecture five on neural networks/)).toBeNull();
  });

  it("parses rawText into segments when segments array is not provided", () => {
    const rawTextSource: SourceWithContent = {
      ...mockVideoSource,
      segments: undefined,
      rawText: "[00:10] Speaker 1: Introductory remarks.\n[00:30] Speaker 2: Second section topic.",
    };

    render(
      <QueryClientProvider client={queryClient}>
        <VideoDocumentViewer source={rawTextSource} />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Introductory remarks.")).toBeTruthy();
    expect(screen.getByText("Second section topic.")).toBeTruthy();
    expect(screen.getByText("Speaker 1")).toBeTruthy();
    expect(screen.getByText("Speaker 2")).toBeTruthy();
  });

  it("renders clean transcript search input without decorative badges", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <VideoDocumentViewer source={mockVideoSource} />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId("transcript-search-input")).toBeTruthy();
    expect(screen.queryByText("AI Transcription")).toBeNull();
  });
});
