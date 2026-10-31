import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioOverviewPlayer } from "./audio-overview-player";

describe("AudioOverviewPlayer", () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps one deferred audio element with the localized title and versioned API URL", () => {
    render(<AudioOverviewPlayer materialId="material 1" audioVersion="v2" title="A topic" />);

    const audio = screen.getByLabelText("Audio player for A topic");
    expect(audio.tagName).toBe("AUDIO");
    expect(audio.getAttribute("preload")).toBe("none");
    expect(audio.getAttribute("src")).toBe("/api/study-materials/material%201/audio?v=v2");
    expect(document.querySelectorAll("audio")).toHaveLength(1);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("img", { name: /Waveform unavailable/ })).toBeTruthy();
  });

  it("renders a measured waveform, removes the status label, and samples the actual media clock", () => {
    let frame: FrameRequestCallback = () => {};
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frame = callback;
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    render(
      <AudioOverviewPlayer
        materialId="material-1"
        title="A topic"
        timeline={{ duration: 2, waveform: [0.1, 0.8], sections: [] }}
      />,
    );
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByTestId("audio-waveform").querySelectorAll("rect")).toHaveLength(2);
    const audio = screen.getByLabelText("Audio player for A topic") as HTMLAudioElement;
    Object.defineProperty(audio, "duration", { configurable: true, value: 2 });
    Object.defineProperty(audio, "currentTime", { configurable: true, writable: true, value: 0.7 });
    fireEvent.loadedMetadata(audio);
    fireEvent.play(audio);
    audio.currentTime = 0.8;
    fireEvent.rateChange(audio);
    frame(100);
    expect((screen.getByRole("slider") as HTMLInputElement).value).toBe("0.8");
    fireEvent.pause(audio);
    audio.currentTime = 0.3;
    fireEvent.seeked(audio);
    expect((screen.getByRole("slider") as HTMLInputElement).value).toBe("0.3");
    fireEvent.change(screen.getByRole("slider"), { target: { value: "1.2" } });
    expect(audio.currentTime).toBe(1.2);
    expect((screen.getByRole("slider") as HTMLInputElement).value).toBe("1.2");
  });

  it("changes playback speed through the themed picker and tracks native rate changes", async () => {
    const user = userEvent.setup();
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    render(<AudioOverviewPlayer materialId="material-1" title="A topic" />);
    const audio = screen.getByLabelText("Audio player for A topic") as HTMLAudioElement;
    const trigger = screen.getByRole("combobox", { name: "Playback speed" });
    await user.click(trigger);
    await user.click(await screen.findByRole("option", { name: "1.5×" }));
    expect(audio.playbackRate).toBe(1.5);
    expect(trigger.textContent).toContain("1.5×");
    expect(play).not.toHaveBeenCalled();
    audio.playbackRate = 0.75;
    fireEvent.rateChange(audio);
    expect(trigger.textContent).toContain("0.75×");
  });

  it("recovers from rejected playback when retry succeeds", async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockRejectedValueOnce(new Error("blocked"))
      .mockImplementationOnce(() => Promise.resolve());
    render(<AudioOverviewPlayer materialId="material-1" title="A topic" />);

    fireEvent.click(screen.getByRole("button", { name: "Play A topic" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Audio playback failed");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("resets playback when the material version changes", async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockImplementation(() => Promise.resolve());
    const { rerender } = render(
      <AudioOverviewPlayer materialId="material-1" audioVersion="old" title="A topic" />,
    );
    const audio = screen.getByLabelText("Audio player for A topic") as HTMLAudioElement;
    Object.defineProperty(audio, "duration", { configurable: true, value: 90 });
    Object.defineProperty(audio, "currentTime", { configurable: true, writable: true, value: 42 });
    fireEvent.loadedMetadata(audio);
    fireEvent.click(screen.getByRole("button", { name: "Play A topic" }));
    await waitFor(() => expect(play).toHaveBeenCalledOnce());

    rerender(<AudioOverviewPlayer materialId="material-1" audioVersion="new" title="A topic" />);
    expect(audio.getAttribute("src")).toBe("/api/study-materials/material-1/audio?v=new");
    expect(screen.getByRole("button", { name: "Play A topic" })).toBeTruthy();
    expect((screen.getByLabelText("Playback position") as HTMLInputElement).value).toBe("0");
  });

  it("reports only valid media duration and clears it when the source changes", () => {
    const onDurationChange = vi.fn();
    const { rerender } = render(
      <AudioOverviewPlayer
        materialId="material-1"
        audioVersion="old"
        title="A topic"
        detail="Single narrator"
        onDurationChange={onDurationChange}
      />,
    );
    const audio = screen.getByLabelText("Audio player for A topic") as HTMLAudioElement;
    expect(screen.getByText("Single narrator")).toBeTruthy();

    Object.defineProperty(audio, "duration", { configurable: true, value: 84.5 });
    fireEvent.loadedMetadata(audio);
    expect(onDurationChange).toHaveBeenLastCalledWith(84.5);

    Object.defineProperty(audio, "duration", {
      configurable: true,
      value: Number.POSITIVE_INFINITY,
    });
    fireEvent.durationChange(audio);
    expect(onDurationChange).toHaveBeenLastCalledWith(null);

    rerender(
      <AudioOverviewPlayer
        materialId="material-1"
        audioVersion="new"
        title="A topic"
        detail="Single narrator"
        onDurationChange={onDurationChange}
      />,
    );
    expect(onDurationChange).toHaveBeenLastCalledWith(null);

    Object.defineProperty(audio, "duration", { configurable: true, value: 0 });
    fireEvent.durationChange(audio);
    expect(onDurationChange).toHaveBeenLastCalledWith(null);
    fireEvent.emptied(audio);
    expect(onDurationChange).toHaveBeenLastCalledWith(null);
  });
});
