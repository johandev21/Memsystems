import { useEffect, useState } from "react";
import { getApiUrl } from "@/shared/api";

export type AudioTimeline = {
  duration: number;
  waveform: number[];
  sections: { start: number; end: number }[];
};

export function parseAudioTimeline(value: unknown): AudioTimeline | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const duration = data.duration;
  if (
    typeof duration !== "number" ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > 780 ||
    !Array.isArray(data.waveform) ||
    data.waveform.length > 512 ||
    !data.waveform.every(
      (peak) => typeof peak === "number" && Number.isFinite(peak) && peak >= 0 && peak <= 1,
    )
  )
    return null;
  const sections: AudioTimeline["sections"] = [];
  if (Array.isArray(data.sections) && data.sections.length <= 40) {
    for (const item of data.sections) {
      if (
        !item ||
        typeof item.start !== "number" ||
        typeof item.end !== "number" ||
        !Number.isFinite(item.start) ||
        !Number.isFinite(item.end) ||
        item.start !== (sections.at(-1)?.end ?? 0) ||
        item.end <= item.start ||
        item.end > duration
      ) {
        return { duration, waveform: data.waveform, sections: [] };
      }
      sections.push({ start: item.start, end: item.end });
    }
  }
  if (sections.length && sections.at(-1)?.end !== duration)
    return { duration, waveform: data.waveform, sections: [] };
  return { duration, waveform: data.waveform, sections };
}

export function useAudioTimeline(materialId: string, version?: string) {
  const key = `${materialId}:${version ?? ""}`;
  const [result, setResult] = useState<{ key: string; data: AudioTimeline | null } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(
      getApiUrl(
        `/api/study-materials/${encodeURIComponent(materialId)}/audio/timeline?v=${encodeURIComponent(version ?? "")}`,
      ),
      { signal: controller.signal },
    )
      .then((response) => (response.ok ? response.json() : null))
      .then((value) => {
        if (!controller.signal.aborted) setResult({ key, data: parseAudioTimeline(value) });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key, data: null });
      });
    return () => controller.abort();
  }, [materialId, version, key]);
  return result?.key === key ? result.data : null;
}
