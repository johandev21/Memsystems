import { describe, expect, it } from "vitest";
import { parseAudioTimeline } from "./use-audio-timeline";

const timeline = {
  duration: 2,
  waveform: [0.1, 0.6, 1],
  sections: [
    { start: 0, end: 0.75 },
    { start: 0.75, end: 2 },
  ],
};
describe("audio timeline validation and alignment", () => {
  it("rejects invalid amplitudes and preserves peaks when timing data is unusable", () => {
    expect(parseAudioTimeline(timeline)).toEqual(timeline);
    expect(parseAudioTimeline({ ...timeline, waveform: [Number.NaN] })).toBeNull();
    expect(parseAudioTimeline({ ...timeline, waveform: [1.1] })).toBeNull();
    expect(
      parseAudioTimeline({ ...timeline, sections: [{ start: 0.1, end: 2 }] })?.sections,
    ).toEqual([]);
  });
});
