import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { toast } from "sonner";
import { fetchApi } from "@/shared/api";
import type { SourceSegment, SourceWithContent } from "../../../types";
import {
  parseRawTextToAudioSegments,
  type ParsedAudioSegment,
} from "../../../utils/audio-transcript-parser";

export function useAudioSegmentList(
  source: SourceWithContent,
  effectiveSourceSegments: SourceSegment[] | undefined,
) {
  const segments = useMemo<ParsedAudioSegment[]>(() => {
    if (effectiveSourceSegments && effectiveSourceSegments.length > 0) {
      return effectiveSourceSegments.map((seg, idx) => {
        const startOffsetMs = seg.locator?.startOffsetMs ?? idx * 10_000;
        const endOffsetMs = seg.locator?.endOffsetMs;
        const speaker = seg.locator?.speaker || (seg.metadata?.speaker as string | undefined);
        return {
          id: seg.id || `seg-${idx}`,
          ordinal: seg.ordinal ?? idx + 1,
          content: seg.content,
          speaker: speaker || undefined,
          startOffsetMs,
          endOffsetMs,
          locator: {
            ...seg.locator,
            startOffsetMs,
            endOffsetMs,
            speaker: speaker || undefined,
          },
        };
      });
    }
    return parseRawTextToAudioSegments(source.rawText || "");
  }, [effectiveSourceSegments, source.rawText]);

  const totalWords = useMemo(
    () => segments.reduce((acc, s) => acc + s.content.split(/\s+/).filter(Boolean).length, 0),
    [segments],
  );
  return { segments, totalWords };
}

export function useFilteredAudioSegments(segments: ParsedAudioSegment[], searchQuery: string) {
  return useMemo(() => {
    if (!searchQuery.trim()) return segments;
    const queryLower = searchQuery.toLowerCase();
    return segments.filter(
      (s) =>
        s.content.toLowerCase().includes(queryLower) ||
        s.speaker?.toLowerCase().includes(queryLower),
    );
  }, [segments, searchQuery]);
}

export function useSpeakerRename(
  sourceId: string,
  segments: ParsedAudioSegment[],
  setCustomSegments: (segs: SourceSegment[] | null) => void,
) {
  const queryClient = useQueryClient();
  const [editingSpeaker, setEditingSpeaker] = useState<{
    originalSpeaker: string;
    currentValue: string;
  } | null>(null);

  const handleStartRenameSpeaker = (speaker: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSpeaker({ originalSpeaker: speaker, currentValue: speaker });
  };

  const handleSaveSpeakerRename = async () => {
    if (!editingSpeaker) return;
    const { originalSpeaker, currentValue } = editingSpeaker;
    const trimmed = currentValue.trim();
    if (!trimmed || trimmed === originalSpeaker) {
      setEditingSpeaker(null);
      return;
    }
    const currentList = segments.map((seg) => ({
      id: seg.id,
      ordinal: seg.ordinal,
      content: seg.content,
      locator: {
        ...seg.locator,
        speaker: seg.speaker === originalSpeaker ? trimmed : seg.speaker,
      },
    }));
    setCustomSegments(currentList);
    setEditingSpeaker(null);
    toast.success(`Renamed speaker to "${trimmed}"`);
    try {
      await fetchApi(`/api/sources/${sourceId}/speakers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: originalSpeaker, to: trimmed }),
      });
      queryClient.invalidateQueries({ queryKey: ["source", sourceId] });
    } catch {
      // Backend may not support PATCH /speakers yet; local optimistic state handles it seamlessly
    }
  };

  const handleSpeakerKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveSpeakerRename();
    } else if (e.key === "Escape") {
      setEditingSpeaker(null);
    }
  };

  const getSpeakerColor = useCallback((speaker?: string) => {
    if (!speaker) return "bg-muted text-muted-foreground border-border";
    const colors = [
      "bg-primary/10 text-primary border-primary/20",
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
      "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
    ];
    let hash = 0;
    for (let i = 0; i < speaker.length; i++) {
      hash = (hash << 5) - hash + speaker.charCodeAt(i);
      hash |= 0;
    }
    return colors[Math.abs(hash) % colors.length];
  }, []);

  return {
    editingSpeaker,
    setEditingSpeaker,
    handleStartRenameSpeaker,
    handleSaveSpeakerRename,
    handleSpeakerKeyDown,
    getSpeakerColor,
  };
}

export function useAudioSegmentSync({
  segments,
  currentTime,
  filteredSegments,
  isVirtualized,
  virtualizer,
  segmentElementsRef,
}: {
  segments: ParsedAudioSegment[];
  currentTime: number;
  filteredSegments: ParsedAudioSegment[];
  isVirtualized: boolean;
  virtualizer: ReturnType<typeof useVirtualizer<HTMLDivElement, Element>>;
  segmentElementsRef: { current: Map<string, HTMLDivElement> };
}) {
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);

  useEffect(() => {
    if (segments.length === 0) return;
    const ms = currentTime * 1000;
    let found = segments.find((s) => {
      const end = s.endOffsetMs ?? Infinity;
      return ms >= s.startOffsetMs && ms < end;
    });
    if (!found) {
      for (let i = segments.length - 1; i >= 0; i--) {
        if (ms >= segments[i].startOffsetMs) {
          found = segments[i];
          break;
        }
      }
    }
    if (found && found.id !== activeSegmentId) {
      setActiveSegmentId(found.id);
      if (isVirtualized) {
        const idx = filteredSegments.findIndex((s) => s.id === found.id);
        if (idx !== -1) virtualizer.scrollToIndex(idx, { align: "center", behavior: "smooth" });
      } else {
        segmentElementsRef.current.get(found.id)?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }
  }, [
    currentTime,
    segments,
    activeSegmentId,
    filteredSegments,
    isVirtualized,
    virtualizer,
    segmentElementsRef,
  ]);

  return { activeSegmentId, setActiveSegmentId };
}
