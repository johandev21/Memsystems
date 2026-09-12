import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Virtualizer } from "@tanstack/react-virtual";
import { fetchApi } from "@/shared/api";
import type { SourceWithContent } from "../../../types";
import {
  hasTimestampPatterns,
  parseRawTextToVideoSegments,
  type ParsedVideoSegment,
} from "../../../utils/video-transcript-parser";

export function useVideoDownload(sourceId: string, fallbackUrl?: string | null, disabled?: boolean) {
  const query = useQuery({
    queryKey: ["source-download", sourceId],
    queryFn: async () => {
      const response = await fetchApi(`/api/sources/${sourceId}/download`);
      if (!response.ok) {
        if (fallbackUrl) return { url: fallbackUrl };
        throw new Error("Failed to load video file");
      }
      return (await response.json()) as { url: string; expiresIn?: number };
    },
    enabled: Boolean(sourceId) && !disabled,
    staleTime: 5 * 60 * 1000,
  });
  return {
    downloadData: query.data,
    isLoadingVideo: query.isLoading,
    isVideoError: query.isError,
    videoSrc: query.data?.url || fallbackUrl || undefined,
  };
}

export function useVideoSegments(source: SourceWithContent, duration: number) {
  const segments = useMemo<ParsedVideoSegment[]>(() => {
    if (source.segments && source.segments.length > 0) {
      if (source.segments.length === 1 && hasTimestampPatterns(source.segments[0].content)) {
        return parseRawTextToVideoSegments(source.segments[0].content, duration || undefined);
      }
      return source.segments.map((seg, idx) => {
        const startOffsetMs = seg.locator?.startOffsetMs ?? idx * 10_000;
        const endOffsetMs = seg.locator?.endOffsetMs;
        return {
          id: seg.id || `seg-${idx}`,
          ordinal: seg.ordinal ?? idx + 1,
          content: seg.content,
          kind: seg.kind,
          speaker: seg.locator?.speaker || (seg.metadata?.speaker as string | undefined),
          startOffsetMs,
          endOffsetMs,
          locator: { ...seg.locator, startOffsetMs, endOffsetMs },
        };
      });
    }
    return parseRawTextToVideoSegments(source.rawText || "", duration || undefined);
  }, [source.segments, source.rawText, duration]);

  const isObsoleteMockTranscript = useMemo(() => {
    return segments.some(
      (s) =>
        s.content.includes("architectural foundations") ||
        s.content.includes("practical implementation steps and key takeaways") ||
        s.content.includes("Welcome back to the channel. Today we are discussing") ||
        s.content.includes("Thank you for watching! Be sure to like, subscribe"),
    );
  }, [segments]);

  const hasTranscripts = useMemo(() => {
    if (segments.length === 0) return false;
    if (isObsoleteMockTranscript) return false;
    if (segments.length === 1) {
      const seg = segments[0];
      const isTitleOnly =
        seg.content.trim() === source.title.trim() && !hasTimestampPatterns(source.rawText || "");
      if (isTitleOnly && seg.kind !== "transcript") return false;
    }
    return segments.some(
      (s) =>
        s.kind === "transcript" ||
        s.startOffsetMs > 0 ||
        segments.length > 1 ||
        hasTimestampPatterns(source.rawText || ""),
    );
  }, [segments, isObsoleteMockTranscript, source.title, source.rawText]);

  return { segments, hasTranscripts };
}

export function useVideoSegmentSync({
  segments,
  currentTime,
  isVirtualized,
  virtualizer,
  segmentElementsRef,
}: {
  segments: ParsedVideoSegment[];
  currentTime: number;
  isVirtualized: boolean;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  segmentElementsRef: React.RefObject<Map<string, HTMLDivElement>>;
}) {
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);

  useEffect(() => {
    if (segments.length === 0) return;
    const currentMs = currentTime * 1000;
    let found = segments.find((seg) => {
      const end = seg.endOffsetMs ?? Infinity;
      return currentMs >= seg.startOffsetMs && currentMs < end;
    });
    if (!found) {
      for (let i = segments.length - 1; i >= 0; i--) {
        if (currentMs >= segments[i].startOffsetMs) {
          found = segments[i];
          break;
        }
      }
    }
    if (found && found.id !== activeSegmentId) {
      setActiveSegmentId(found.id);
      if (isVirtualized) {
        const idx = segments.findIndex((s) => s.id === found.id);
        if (idx !== -1) {
          virtualizer.scrollToIndex(idx, { align: "center", behavior: "smooth" });
        }
      } else {
        segmentElementsRef.current.get(found.id)?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }
  }, [currentTime, segments, activeSegmentId, isVirtualized, virtualizer, segmentElementsRef]);

  return { activeSegmentId, setActiveSegmentId };
}
