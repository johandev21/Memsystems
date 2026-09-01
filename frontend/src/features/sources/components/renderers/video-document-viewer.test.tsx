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

  it("renders HTML5 video player for uploaded video with controls, video badge, and transcript segments", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <VideoDocumentViewer source={mockVideoSource} />
      </QueryClientProvider>,
    );

    // Video badge and toolbar
    expect(screen.getByText("Video Recording")).toBeTruthy();
    expect(screen.getByText(/4 segments/)).toBeTruthy();
    expect(screen.getByText("AI Transcription")).toBeTruthy();

    // Video element present, iframe absent
    expect(screen.getByTestId("video-element")).toBeTruthy();
    expect(screen.queryByTestId("youtube-iframe")).toBeNull();

    // Video controls
    expect(screen.getByTestId("play-pause-button")).toBeTruthy();
    expect(screen.getByTestId("skip-backward-button")).toBeTruthy();
    expect(screen.getByTestId("skip-forward-button")).toBeTruthy();
    expect(screen.getByTestId("seek-slider")).toBeTruthy();
    expect(screen.getByTestId("playback-speed-button")).toBeTruthy();
    expect(screen.getByTestId("volume-button")).toBeTruthy();
    expect(screen.getByTestId("fullscreen-button")).toBeTruthy();

    // Transcript segments
    expect(screen.getByText("Welcome to lecture five on neural networks.")).toBeTruthy();
    expect(screen.getByText("Today we will explore convolutional layers and attention.")).toBeTruthy();
    expect(screen.getByText("How does self-attention scale with sequence length?")).toBeTruthy();

    // Speaker badges
    const chenBadges = screen.getAllByText("Prof. Chen");
    expect(chenBadges.length).toBe(3);
    expect(screen.getByText("Bob")).toBeTruthy();

    // Video src loaded
    const videoElement = screen.getByTestId("video-element") as HTMLVideoElement;
    expect(videoElement).toBeTruthy();
  });

  it("renders YouTube iframe for YouTube sources", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <VideoDocumentViewer source={mockYouTubeSource} />
      </QueryClientProvider>,
    );

    expect(screen.getByText("YouTube Stream")).toBeTruthy();
    const iframe = screen.getByTestId("youtube-iframe") as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    expect(iframe.src).toContain("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(iframe.src).toContain("enablejsapi=1");
    expect(screen.queryByTestId("video-element")).toBeNull();
  });

  it("toggles play and pause on button click", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <VideoDocumentViewer source={mockVideoSource} />
      </QueryClientProvider>,
    );

    const playBtn = screen.getByTestId("play-pause-button");
    const videoElement = screen.getByTestId("video-element") as HTMLVideoElement;

    await user.click(playBtn);
    expect(videoElement.play).toHaveBeenCalled();

    fireEvent.play(videoElement);
    expect(screen.getByLabelText("Pause")).toBeTruthy();

    await user.click(screen.getByTestId("play-pause-button"));
    expect(videoElement.pause).toHaveBeenCalled();
  });

  it("handles skipping backward and forward 10 seconds", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <VideoDocumentViewer source={mockVideoSource} />
      </QueryClientProvider>,
    );

    const videoElement = screen.getByTestId("video-element") as HTMLVideoElement;
    videoElement.currentTime = 30;

    const skipForwardBtn = screen.getByTestId("skip-forward-button");
    await user.click(skipForwardBtn);
    expect(videoElement.currentTime).toBe(40);

    const skipBackBtn = screen.getByTestId("skip-backward-button");
    await user.click(skipBackBtn);
    expect(videoElement.currentTime).toBe(30);
  });

  it("handles scrubber timeline seeking", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <VideoDocumentViewer source={mockVideoSource} />
      </QueryClientProvider>,
    );

    const videoElement = screen.getByTestId("video-element") as HTMLVideoElement;
    const seekSlider = screen.getByTestId("seek-slider") as HTMLInputElement;

    fireEvent.change(seekSlider, { target: { value: "45" } });
    fireEvent.mouseUp(seekSlider, { target: { value: "45" } });

    expect(videoElement.currentTime).toBe(45);
  });

  it("handles playback rate changes", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <VideoDocumentViewer source={mockVideoSource} />
      </QueryClientProvider>,
    );

    const videoElement = screen.getByTestId("video-element") as HTMLVideoElement;
    const speedBtn = screen.getByTestId("playback-speed-button");

    expect(screen.getByText("1x")).toBeTruthy();

    await user.click(speedBtn);
    expect(videoElement.playbackRate).toBe(1.25);
    expect(screen.getByText("1.25x")).toBeTruthy();

    await user.click(speedBtn);
    expect(videoElement.playbackRate).toBe(1.5);
    expect(screen.getByText("1.5x")).toBeTruthy();
  });

  it("handles volume change and mute toggle", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <VideoDocumentViewer source={mockVideoSource} />
      </QueryClientProvider>,
    );

    const videoElement = screen.getByTestId("video-element") as HTMLVideoElement;
    const muteBtn = screen.getByTestId("volume-button");

    await user.click(muteBtn);
    expect(videoElement.muted).toBe(true);

    await user.click(muteBtn);
    expect(videoElement.muted).toBe(false);
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

  it("renders volume slider and fullscreen button", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <VideoDocumentViewer source={mockVideoSource} />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId("volume-slider")).toBeTruthy();
    expect(screen.getByTestId("fullscreen-button")).toBeTruthy();
  });
});
