import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AudioPlayerDuration,
  AudioPlayerProgress,
  AudioPlayerProvider,
  AudioPlayerSkipButton,
  AudioPlayerSpeed,
  AudioPlayerStatus,
  formatAudioTime,
} from "./audio-player";

const labels = {
  play: "Play topic",
  pause: "Pause topic",
  rewind: "Go back 15 seconds",
  forward: "Skip forward 15 seconds",
  progress: "Playback position",
  speed: "Playback speed",
  error: "Playback failed",
  retry: "Retry",
  ready: "Ready",
  playing: "Playing",
  buffering: "Buffering",
};

function renderPlayer() {
  return render(
    <AudioPlayerProvider src="/audio.mp3" audioLabel="Audio for topic" labels={labels}>
      <AudioPlayerProgress />
      <AudioPlayerStatus />
      <AudioPlayerDuration />
      <AudioPlayerSkipButton direction="backward" />
      <AudioPlayerSkipButton direction="forward" />
      <AudioPlayerSpeed />
    </AudioPlayerProvider>,
  );
}

describe("audio player controls", () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps duration unknown and seeking disabled until finite metadata arrives", () => {
    renderPlayer();
    expect(screen.getByText("--:--")).toBeTruthy();
    expect(screen.getByRole("slider", { name: "Playback position" }).hasAttribute("disabled")).toBe(
      true,
    );

    const audio = screen.getByLabelText("Audio for topic");
    Object.defineProperty(audio, "duration", { configurable: true, value: 125 });
    fireEvent.loadedMetadata(audio);
    expect(screen.getByText("2:05")).toBeTruthy();
    expect(screen.getByRole("slider", { name: "Playback position" }).hasAttribute("disabled")).toBe(
      false,
    );
  });

  it("uses keyboard range changes as the authoritative playback seek", () => {
    renderPlayer();
    const audio = screen.getByLabelText("Audio for topic");
    let currentTime = 0;
    Object.defineProperty(audio, "duration", { configurable: true, value: 60 });
    Object.defineProperty(audio, "currentTime", {
      configurable: true,
      get: () => currentTime,
      set: (next: number) => { currentTime = next; },
    });
    fireEvent.loadedMetadata(audio);
    fireEvent.change(screen.getByRole("slider", { name: "Playback position" }), {
      target: { value: "12.5" },
    });
    expect(currentTime).toBe(12.5);
  });

  it("clamps range seeks and skip controls to the finite media duration", () => {
    renderPlayer();
    const audio = screen.getByLabelText("Audio for topic");
    let currentTime = 5;
    Object.defineProperty(audio, "duration", { configurable: true, value: 60 });
    Object.defineProperty(audio, "currentTime", {
      configurable: true,
      get: () => currentTime,
      set: (next: number) => {
        currentTime = next;
      },
    });
    fireEvent.loadedMetadata(audio);

    fireEvent.change(screen.getByRole("slider", { name: "Playback position" }), {
      target: { value: "80" },
    });
    expect(currentTime).toBe(60);
    currentTime = 8;
    fireEvent.click(screen.getByRole("button", { name: "Go back 15 seconds" }));
    expect(currentTime).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Skip forward 15 seconds" }));
    expect(currentTime).toBe(15);
  });

  it("applies the selected speed to the audio element", async () => {
    renderPlayer();
    const audio = screen.getByLabelText("Audio for topic");
    Object.defineProperty(audio, "playbackRate", { configurable: true, writable: true, value: 1 });
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Playback speed" }));
    await user.click(await screen.findByRole("option", { name: "1.5×" }));
    expect(audio).toHaveProperty("playbackRate", 1.5);
  });

  it("formats finite times and rejects invalid durations", () => {
    expect(formatAudioTime(3661)).toBe("1:01:01");
    expect(formatAudioTime(Number.NaN)).toBe("--:--");
  });
});
