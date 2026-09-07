import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SourceWithContent } from "../../types";
import { AudioDocumentViewer } from "./audio-document-viewer";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

const mockAudioSource: SourceWithContent = {
  id: "source-audio-1",
  notebookId: "nb-1",
  kind: "file",
  modality: "audio",
  title: "Lecture 4 - Quantum Computing.mp3",
  url: null,
  contentType: "audio/mpeg",
  fileSize: 1024 * 1024 * 15,
  createdAt: "2026-08-30T12:00:00.000Z",
  rawText:
    "[00:00] Prof. Miller: Welcome to lecture four on quantum computing.\n[00:15] Prof. Miller: Today we will explore quantum superposition and qubits.\n[00:45] Alice: Can qubits hold both zero and one states simultaneously?\n[01:00] Prof. Miller: Exactly Alice. Superposition allows a linear combination of states.",
  s3Key: "uploads/nb-1/quantum-lecture.mp3",
  sha256: "audio123sha",
  segments: [
    {
      id: "seg-1",
      ordinal: 1,
      kind: "transcript",
      content: "Welcome to lecture four on quantum computing.",
      locator: {
        startOffsetMs: 0,
        endOffsetMs: 15_000,
        speaker: "Prof. Miller",
      },
    },
    {
      id: "seg-2",
      ordinal: 2,
      kind: "transcript",
      content: "Today we will explore quantum superposition and qubits.",
      locator: {
        startOffsetMs: 15_000,
        endOffsetMs: 45_000,
        speaker: "Prof. Miller",
      },
    },
    {
      id: "seg-3",
      ordinal: 3,
      kind: "transcript",
      content: "Can qubits hold both zero and one states simultaneously?",
      locator: {
        startOffsetMs: 45_000,
        endOffsetMs: 60_000,
        speaker: "Alice",
      },
    },
    {
      id: "seg-4",
      ordinal: 4,
      kind: "transcript",
      content: "Exactly Alice. Superposition allows a linear combination of states.",
      locator: {
        startOffsetMs: 60_000,
        endOffsetMs: 90_000,
        speaker: "Prof. Miller",
      },
    },
  ],
};

describe("AudioDocumentViewer", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();

    // Mock HTMLMediaElement methods
    window.HTMLMediaElement.prototype.play = vi.fn().mockImplementation(() => Promise.resolve());
    window.HTMLMediaElement.prototype.pause = vi.fn();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/download")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ url: "https://storage.example.com/quantum-lecture.mp3" }),
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

  it("renders audio document viewer with controls, audio badge, and transcript segments", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AudioDocumentViewer source={mockAudioSource} />
      </QueryClientProvider>,
    );

    // Toolbar elements
    expect(screen.getByText("Audio Recording")).toBeTruthy();
    expect(screen.getByText(/4 segments/)).toBeTruthy();
    expect(screen.getByText("AI Transcription")).toBeTruthy();

    // Audio controls
    expect(screen.getByTestId("play-pause-button")).toBeTruthy();
    expect(screen.getByTestId("skip-backward-button")).toBeTruthy();
    expect(screen.getByTestId("skip-forward-button")).toBeTruthy();
    expect(screen.getByTestId("seek-slider")).toBeTruthy();
    expect(screen.getByTestId("playback-speed-button")).toBeTruthy();
    expect(screen.getByTestId("volume-button")).toBeTruthy();

    // Transcript segments
    expect(screen.getByText("Welcome to lecture four on quantum computing.")).toBeTruthy();
    expect(
      screen.getByText("Today we will explore quantum superposition and qubits."),
    ).toBeTruthy();
    expect(
      screen.getByText("Can qubits hold both zero and one states simultaneously?"),
    ).toBeTruthy();

    // Speaker badges
    const millerBadges = screen.getAllByText("Prof. Miller");
    expect(millerBadges.length).toBe(3);
    expect(screen.getByText("Alice")).toBeTruthy();

    // Check audio src loaded
    const audioElement = screen.getByTestId("audio-element") as HTMLAudioElement;
    await screen.findByText("Audio Recording");
    expect(audioElement).toBeTruthy();
  });

  it("toggles play and pause on button click", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <AudioDocumentViewer source={mockAudioSource} />
      </QueryClientProvider>,
    );

    const playBtn = screen.getByTestId("play-pause-button");
    const audioElement = screen.getByTestId("audio-element") as HTMLAudioElement;

    await user.click(playBtn);
    expect(audioElement.play).toHaveBeenCalled();

    // Trigger onPlay event
    fireEvent.play(audioElement);
    expect(screen.getByLabelText("Pause")).toBeTruthy();

    await user.click(screen.getByTestId("play-pause-button"));
    expect(audioElement.pause).toHaveBeenCalled();
  });

  it("handles skipping backward and forward 10 seconds", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <AudioDocumentViewer source={mockAudioSource} />
      </QueryClientProvider>,
    );

    const audioElement = screen.getByTestId("audio-element") as HTMLAudioElement;
    audioElement.currentTime = 30;

    const skipForwardBtn = screen.getByTestId("skip-forward-button");
    await user.click(skipForwardBtn);
    expect(audioElement.currentTime).toBe(40);

    const skipBackBtn = screen.getByTestId("skip-backward-button");
    await user.click(skipBackBtn);
    expect(audioElement.currentTime).toBe(30);
  });

  it("handles scrubber timeline seeking", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AudioDocumentViewer source={mockAudioSource} />
      </QueryClientProvider>,
    );

    const audioElement = screen.getByTestId("audio-element") as HTMLAudioElement;
    const seekSlider = screen.getByTestId("seek-slider") as HTMLInputElement;

    fireEvent.change(seekSlider, { target: { value: "45" } });
    fireEvent.mouseUp(seekSlider, { target: { value: "45" } });

    expect(audioElement.currentTime).toBe(45);
  });

  it("handles playback rate changes", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <AudioDocumentViewer source={mockAudioSource} />
      </QueryClientProvider>,
    );

    const audioElement = screen.getByTestId("audio-element") as HTMLAudioElement;
    const speedBtn = screen.getByTestId("playback-speed-button");

    expect(screen.getByText("1x")).toBeTruthy();

    // Clicking cycles from 1x -> 1.25x -> 1.5x
    await user.click(speedBtn);
    expect(audioElement.playbackRate).toBe(1.25);
    expect(screen.getByText("1.25x")).toBeTruthy();

    await user.click(speedBtn);
    expect(audioElement.playbackRate).toBe(1.5);
    expect(screen.getByText("1.5x")).toBeTruthy();
  });

  it("handles volume change and mute toggle", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <AudioDocumentViewer source={mockAudioSource} />
      </QueryClientProvider>,
    );

    const audioElement = screen.getByTestId("audio-element") as HTMLAudioElement;
    const muteBtn = screen.getByTestId("volume-button");

    await user.click(muteBtn);
    expect(audioElement.muted).toBe(true);

    await user.click(muteBtn);
    expect(audioElement.muted).toBe(false);
  });

  it("seeks audio and activates segment when clicking a transcript segment", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <AudioDocumentViewer source={mockAudioSource} />
      </QueryClientProvider>,
    );

    const audioElement = screen.getByTestId("audio-element") as HTMLAudioElement;
    const aliceSegment = screen.getByText(
      "Can qubits hold both zero and one states simultaneously?",
    );

    await user.click(aliceSegment);

    expect(audioElement.currentTime).toBe(45);
    expect(audioElement.play).toHaveBeenCalled();
  });

  it("seeks audio when clicking a timestamp badge", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <AudioDocumentViewer source={mockAudioSource} />
      </QueryClientProvider>,
    );

    const audioElement = screen.getByTestId("audio-element") as HTMLAudioElement;
    const timestampBadges = screen.getAllByTestId("segment-timestamp");

    // Click [00:15] badge for segment 2
    await user.click(timestampBadges[1]);

    expect(audioElement.currentTime).toBe(15);
    expect(audioElement.play).toHaveBeenCalled();
  });

  it("automatically seeks and scrolls when selectedLocator is passed from citation", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AudioDocumentViewer
          source={mockAudioSource}
          selectedLocator={{
            startOffsetMs: 60_000,
            endOffsetMs: 90_000,
            speaker: "Prof. Miller",
          }}
        />
      </QueryClientProvider>,
    );

    const audioElement = screen.getByTestId("audio-element") as HTMLAudioElement;
    expect(audioElement.currentTime).toBe(60);
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("supports inline speaker renaming and updates segment labels optimistically", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <AudioDocumentViewer source={mockAudioSource} />
      </QueryClientProvider>,
    );

    // Click on speaker badge "Alice" to edit
    const aliceBadge = screen.getByText("Alice");
    await user.click(aliceBadge);

    // Rename input should appear
    const renameInput = screen.getByTestId("speaker-rename-input") as HTMLInputElement;
    expect(renameInput.value).toBe("Alice");

    await user.clear(renameInput);
    await user.type(renameInput, "Alice Smith");

    const saveBtn = screen.getByTestId("speaker-rename-save");
    await user.click(saveBtn);

    // Should optimistically show renamed speaker
    expect(screen.getByText("Alice Smith")).toBeTruthy();
    expect(screen.queryByText("Alice")).toBeNull();
  });

  it("filters transcript segments with search input and highlights matching text", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <AudioDocumentViewer source={mockAudioSource} />
      </QueryClientProvider>,
    );

    const searchInput = screen.getByTestId("transcript-search-input");
    await user.type(searchInput, "superposition");

    // Segments matching "superposition" should remain visible and contain mark tags
    const marks = screen.getAllByText(/superposition/i);
    expect(marks.length).toBe(2);
    expect(marks[0].tagName).toBe("MARK");

    // Segment 1 (which doesn't contain "superposition") should be filtered out
    expect(screen.queryByText(/lecture four on quantum computing/)).toBeNull();
  });

  it("parses rawText into segments when segments array is not provided", () => {
    const rawTextSource: SourceWithContent = {
      ...mockAudioSource,
      segments: undefined,
      rawText: "[00:10] Speaker 1: Introductory remarks.\n[00:30] Speaker 2: Second section topic.",
    };

    render(
      <QueryClientProvider client={queryClient}>
        <AudioDocumentViewer source={rawTextSource} />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Introductory remarks.")).toBeTruthy();
    expect(screen.getByText("Second section topic.")).toBeTruthy();
    expect(screen.getByText("Speaker 1")).toBeTruthy();
    expect(screen.getByText("Speaker 2")).toBeTruthy();
  });
});
