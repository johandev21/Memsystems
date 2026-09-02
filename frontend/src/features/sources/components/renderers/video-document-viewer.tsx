import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  AlertTriangle,
  Check,
  Edit2,
  ImageIcon,
  Loader2,
  Search,
  User,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { toast } from "sonner";
import { fetchApi } from "@/shared/api";
import { cn } from "@/shared/utils/cn";
import type { SourceSegment, SourceSegmentLocator, SourceWithContent } from "../../types";
import { extractYouTubeId, isYouTubeUrl } from "./document-type-detector";

export interface VideoDocumentViewerProps {
  source: SourceWithContent;
  selectedLocator?: SourceSegmentLocator | null;
  scrollElement?: HTMLDivElement | null;
}

export interface ParsedVideoSegment {
  id: string;
  ordinal: number;
  content: string;
  kind?: string;
  speaker?: string;
  startOffsetMs: number;
  endOffsetMs?: number;
  locator?: SourceSegmentLocator;
}

export function VideoDocumentViewer({
  source,
  selectedLocator,
}: VideoDocumentViewerProps) {
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const segmentElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  // Detect YouTube video
  const isYouTube = isYouTubeUrl(source.url);
  const youtubeVideoId = isYouTube ? extractYouTubeId(source.url) : null;

  // Minimal playback tracking for transcript synchronization
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Transcript state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [editingSpeaker, setEditingSpeaker] = useState<{
    originalSpeaker: string;
    currentValue: string;
  } | null>(null);

  // Local segments state to support instant optimistic speaker renames
  const [customSegments, setCustomSegments] = useState<SourceSegment[] | null>(null);

  // Reset custom segments when source changes
  useEffect(() => {
    setCustomSegments(null);
  }, [source.id]);

  // Fetch presigned video download URL if not a YouTube URL
  const {
    data: downloadData,
    isLoading: isLoadingVideo,
    isError: isVideoError,
  } = useQuery({
    queryKey: ["source-download", source.id],
    queryFn: async () => {
      const response = await fetchApi(`/api/sources/${source.id}/download`);
      if (!response.ok) {
        if (source.url) return { url: source.url };
        throw new Error("Failed to load video file");
      }
      return (await response.json()) as { url: string; expiresIn?: number };
    },
    enabled: Boolean(source.id) && !isYouTube,
    staleTime: 5 * 60 * 1000,
  });

  const videoSrc = downloadData?.url || source.url || undefined;

  // Normalize segments
  const effectiveSourceSegments = customSegments ?? source.segments;
  const segments = useMemo<ParsedVideoSegment[]>(() => {
    if (effectiveSourceSegments && effectiveSourceSegments.length > 0) {
      return effectiveSourceSegments.map((seg, idx) => {
        const startOffsetMs = seg.locator?.startOffsetMs ?? idx * 10_000;
        const endOffsetMs = seg.locator?.endOffsetMs;
        const speaker = seg.locator?.speaker || (seg.metadata?.speaker as string | undefined);

        return {
          id: seg.id || `seg-${idx}`,
          ordinal: seg.ordinal ?? idx + 1,
          content: seg.content,
          kind: seg.kind,
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

    return parseRawTextToVideoSegments(source.rawText || "");
  }, [effectiveSourceSegments, source.rawText]);

  // Auto-calculate duration from segments if metadata duration isn't available yet
  useEffect(() => {
    if (duration === 0 && segments.length > 0) {
      const lastSeg = segments[segments.length - 1];
      const maxMs = lastSeg.endOffsetMs ?? lastSeg.startOffsetMs + 5000;
      if (maxMs > 0) {
        setDuration(Math.ceil(maxMs / 1000));
      }
    }
  }, [segments, duration]);

  // Find active segment based on current video time
  useEffect(() => {
    if (segments.length === 0) return;
    const currentMs = currentTime * 1000;

    // Find segment where currentMs is within [startOffsetMs, endOffsetMs)
    let found = segments.find((seg) => {
      const start = seg.startOffsetMs;
      const end = seg.endOffsetMs ?? Infinity;
      return currentMs >= start && currentMs < end;
    });

    // If not found in precise window, find the closest preceding segment
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
    }
  }, [currentTime, segments, activeSegmentId]);

  // Video element event handlers for transcript synchronization
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      if (dur && !isNaN(dur) && isFinite(dur)) {
        setDuration(dur);
      }
    }
  };

  const seekTo = useCallback(
    (seconds: number) => {
      const clamped = Math.max(0, duration ? Math.min(seconds, duration) : seconds);
      setCurrentTime(clamped);
      if (videoRef.current) {
        videoRef.current.currentTime = clamped;
        videoRef.current.play().catch(() => {});
      }
      if (iframeRef.current && youtubeVideoId) {
        iframeRef.current.contentWindow?.postMessage(
          JSON.stringify({ event: "command", func: "seekTo", args: [clamped, true] }),
          "*",
        );
      }
    },
    [duration, youtubeVideoId],
  );

  const handleSegmentClick = (segment: ParsedVideoSegment) => {
    const startSec = segment.startOffsetMs / 1000;
    seekTo(startSec);
    setActiveSegmentId(segment.id);
  };

  // Inline speaker renaming
  const handleStartRenameSpeaker = (speaker: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSpeaker({
      originalSpeaker: speaker,
      currentValue: speaker,
    });
  };

  const handleSaveSpeakerRename = async () => {
    if (!editingSpeaker) return;
    const { originalSpeaker, currentValue } = editingSpeaker;
    const trimmed = currentValue.trim();

    if (!trimmed || trimmed === originalSpeaker) {
      setEditingSpeaker(null);
      return;
    }

    // 1. Optimistically update segments in local state
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

    // 2. Persist to server if endpoint exists
    try {
      await fetchApi(`/api/sources/${source.id}/speakers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: originalSpeaker, to: trimmed }),
      });
      queryClient.invalidateQueries({ queryKey: ["source", source.id] });
    } catch {
      // Optimistic local state maintains correct display
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

  // Filter segments by search query
  const filteredSegments = useMemo(() => {
    if (!searchQuery.trim()) return segments;
    const queryLower = searchQuery.toLowerCase();
    return segments.filter(
      (s) =>
        s.content.toLowerCase().includes(queryLower) ||
        s.speaker?.toLowerCase().includes(queryLower),
    );
  }, [segments, searchQuery]);

  const isVirtualized = filteredSegments.length > 30;

  const virtualizer = useVirtualizer({
    count: filteredSegments.length,
    getScrollElement: () => transcriptContainerRef.current,
    estimateSize: () => 80,
    overscan: 6,
    getItemKey: (index) => filteredSegments[index]?.id ?? index,
    enabled: isVirtualized,
    initialRect: { width: 800, height: 600 },
  });

  // Auto-scroll to active segment if playing
  useEffect(() => {
    if (!activeSegmentId) return;
    if (isVirtualized) {
      const idx = filteredSegments.findIndex((s) => s.id === activeSegmentId);
      if (idx !== -1) {
        virtualizer.scrollToIndex(idx, { align: "center", behavior: "smooth" });
      }
    } else {
      const el = segmentElementsRef.current.get(activeSegmentId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [activeSegmentId, isVirtualized, filteredSegments, virtualizer]);

  // Handle citation jumping
  useEffect(() => {
    if (typeof selectedLocator?.startOffsetMs !== "number") return;
    const targetSeconds = selectedLocator.startOffsetMs / 1000;
    seekTo(targetSeconds);

    // Match segment
    const matchedIdx = filteredSegments.findIndex(
      (s) => Math.abs(s.startOffsetMs - (selectedLocator.startOffsetMs ?? 0)) < 1000,
    );
    if (matchedIdx !== -1) {
      const matched = filteredSegments[matchedIdx];
      setActiveSegmentId(matched.id);
      if (isVirtualized) {
        virtualizer.scrollToIndex(matchedIdx, { align: "center", behavior: "smooth" });
      } else {
        const el = segmentElementsRef.current.get(matched.id);
        el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [selectedLocator, filteredSegments, isVirtualized, virtualizer, seekTo]);

  const renderSegmentContent = (
    segment: ParsedVideoSegment,
    isActive: boolean,
    isSelectedCitation: boolean,
  ) => {
    const isEditingThisSpeaker =
      editingSpeaker !== null && editingSpeaker.originalSpeaker === segment.speaker;

    return (
      <div
        data-testid="transcript-segment"
        data-active={isActive ? "true" : undefined}
        onClick={() => handleSegmentClick(segment)}
        className={cn(
          "group rounded-lg border p-3 transition-colors cursor-pointer",
          isActive || isSelectedCitation
            ? "border-surface-border bg-surface-2 ring-1 ring-primary/30"
            : "border-surface-border-subtle bg-surface-1 hover:bg-surface-2",
        )}
      >
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="segment-timestamp"
            onClick={(e) => {
              e.stopPropagation();
              handleSegmentClick(segment);
            }}
            className="inline-flex items-center rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-text-faint hover:bg-surface-3 hover:text-text-primary transition-colors cursor-pointer"
            title="Seek video to this timestamp"
          >
            [{formatTime(segment.startOffsetMs / 1000)}]
          </button>

          {segment.speaker && (
            <>
              {isEditingThisSpeaker && editingSpeaker ? (
                <div
                  className="inline-flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="text"
                    autoFocus
                    data-testid="speaker-rename-input"
                    value={editingSpeaker.currentValue}
                    onChange={(e) =>
                      setEditingSpeaker({
                        originalSpeaker: editingSpeaker.originalSpeaker,
                        currentValue: e.target.value,
                      })
                    }
                    onKeyDown={handleSpeakerKeyDown}
                    className="h-6 w-28 rounded border border-surface-border-strong bg-surface-0 px-1.5 text-xs font-medium text-text-primary focus:outline-none focus:ring-1 focus:ring-surface-border-strong"
                  />
                  <button
                    type="button"
                    data-testid="speaker-rename-save"
                    onClick={handleSaveSpeakerRename}
                    className="size-5 flex items-center justify-center rounded bg-primary text-primary-foreground hover:opacity-90 cursor-pointer"
                    title="Save speaker name"
                  >
                    <Check className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingSpeaker(null)}
                    className="size-5 flex items-center justify-center rounded bg-surface-2 text-text-faint hover:text-text-primary cursor-pointer"
                    title="Cancel rename"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  data-testid="speaker-badge"
                  onClick={(e) => handleStartRenameSpeaker(segment.speaker!, e)}
                  className="group/speaker inline-flex items-center gap-1 rounded-full border border-surface-border bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                  title="Click to rename speaker"
                >
                  <User className="size-2.5 text-text-faint" />
                  <span>{segment.speaker}</span>
                  <Edit2 className="size-2.5 opacity-0 group-hover/speaker:opacity-100 transition-opacity ml-0.5 text-text-faint" />
                </button>
              )}
            </>
          )}

          {(segment.locator?.imageRegion || segment.kind === "visual_description") && (
            <span
              data-testid="visual-note-badge"
              className="inline-flex items-center gap-1 rounded-full border border-surface-border bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-text-secondary"
            >
              <ImageIcon className="size-2.5 text-text-faint" />
              Visual Note
            </span>
          )}
        </div>

        <p className="text-xs leading-relaxed text-text-primary select-text">
          {searchQuery ? (
            <HighlightMatches text={segment.content} query={searchQuery} />
          ) : (
            segment.content
          )}
        </p>
      </div>
    );
  };

  return (
    <div className="@container flex h-full w-full flex-col @min-[720px]:flex-row overflow-hidden bg-surface-0 text-text-primary">
      {/* Video Viewport Container: Adapts between stacked (narrow panel) and side-by-side (wide panel) */}
      <div className="flex flex-col @min-[720px]:w-1/2 @min-[900px]:w-3/5 shrink-0 border-b @min-[720px]:border-b-0 @min-[720px]:border-r border-surface-border bg-black items-center justify-center">
        <div
          ref={videoContainerRef}
          className="relative w-full aspect-video max-h-[45vh] @min-[720px]:max-h-full bg-black flex items-center justify-center overflow-hidden shrink-0 select-none"
        >
          {isYouTube && youtubeVideoId ? (
            <iframe
              ref={iframeRef}
              data-testid="youtube-iframe"
              src={`https://www.youtube.com/embed/${youtubeVideoId}?enablejsapi=1`}
              title={source.title}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <video
              ref={videoRef}
              data-testid="video-element"
              src={videoSrc}
              controls
              playsInline
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              className="w-full h-full object-contain bg-black"
            />
          )}

          {isLoadingVideo && !isYouTube && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs text-white gap-2">
              <Loader2 className="size-7 animate-spin text-primary" />
              <span className="text-xs font-medium">Loading video…</span>
            </div>
          )}

          {isVideoError && !videoSrc && !isYouTube && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-warning gap-2 p-4 text-center">
              <AlertTriangle className="size-7 text-destructive" />
              <span className="text-sm font-semibold text-foreground">Video stream unavailable</span>
              <span className="text-xs text-muted-foreground">The source file could not be loaded.</span>
            </div>
          )}
        </div>
      </div>

      {/* Synchronized Transcript Panel */}
      <div className="flex flex-col flex-1 min-h-0 min-w-0 bg-surface-0 overflow-hidden">
        {/* Transcript Toolbar */}
        <div className="shrink-0 border-b border-surface-border bg-surface-0 px-3 py-2 @min-[720px]:px-4 @min-[720px]:py-2.5">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-text-faint" />
            <input
              type="text"
              data-testid="transcript-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search transcript…"
              className="h-8 w-full rounded-md border border-surface-border bg-surface-1 pl-8 pr-7 text-xs text-text-primary placeholder:text-text-faint focus:border-surface-border-strong focus:outline-none focus:ring-1 focus:ring-surface-border-strong"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-faint hover:text-text-primary cursor-pointer"
                title="Clear search"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Synchronized Transcript Segments */}
        <div
          ref={transcriptContainerRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 @min-[720px]:p-4"
        >
          {filteredSegments.length === 0 ? (
            <div className="py-12 text-center text-xs text-text-faint">
              {searchQuery
                ? `No transcript segments match "${searchQuery}".`
                : "No transcript segments available for this video."}
            </div>
          ) : isVirtualized ? (
            <div
              className="relative w-full"
              style={{ height: `${virtualizer.getTotalSize()}px` }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const segment = filteredSegments[virtualRow.index];
                if (!segment) return null;
                const isActive = activeSegmentId === segment.id;
                const isSelectedCitation =
                  typeof selectedLocator?.startOffsetMs === "number" &&
                  Math.abs(segment.startOffsetMs - selectedLocator.startOffsetMs) < 1000;

                return (
                  <div
                    key={segment.id}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="py-1"
                  >
                    {renderSegmentContent(segment, isActive, isSelectedCitation)}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSegments.map((segment) => {
                const isActive = activeSegmentId === segment.id;
                const isSelectedCitation =
                  typeof selectedLocator?.startOffsetMs === "number" &&
                  Math.abs(segment.startOffsetMs - selectedLocator.startOffsetMs) < 1000;

                return (
                  <div
                    key={segment.id}
                    ref={(el) => {
                      if (el) segmentElementsRef.current.set(segment.id, el);
                      else segmentElementsRef.current.delete(segment.id);
                    }}
                  >
                    {renderSegmentContent(segment, isActive, isSelectedCitation)}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Formats seconds into mm:ss or hh:mm:ss string */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return "00:00";
  const totalSec = Math.floor(seconds);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/** Parse raw text with potential timestamp / speaker lines into structured video segments */
export function parseRawTextToVideoSegments(rawText: string): ParsedVideoSegment[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const segments: ParsedVideoSegment[] = [];

  const timestampPrefixRegex =
    /^\[(\d{1,2}:\d{2}(?::\d{2})?)(?:\s*-\s*(\d{1,2}:\d{2}(?::\d{2})?))?\]\s*(?:([^:]+):\s*)?(.*)$/i;
  const speakerPrefixRegex =
    /^([^:\n(]+)(?:\s*\((?:(\d{1,2}:\d{2}(?::\d{2})?))\))?:\s*(.*)$/i;

  let currentOrdinal = 1;

  for (const line of lines) {
    const tsMatch = line.match(timestampPrefixRegex);
    if (tsMatch) {
      const startTime = tsMatch[1];
      const endTime = tsMatch[2];
      const speaker = tsMatch[3]?.trim();
      const content = tsMatch[4]?.trim() || line;

      const startOffsetMs = parseTimestampToMs(startTime);
      const endOffsetMs = endTime ? parseTimestampToMs(endTime) : undefined;

      segments.push({
        id: `raw-seg-${currentOrdinal}`,
        ordinal: currentOrdinal++,
        content,
        speaker: speaker || undefined,
        startOffsetMs,
        endOffsetMs,
        locator: {
          startOffsetMs,
          endOffsetMs,
          speaker: speaker || undefined,
        },
      });
      continue;
    }

    const spMatch = line.match(speakerPrefixRegex);
    if (spMatch && spMatch[3]) {
      const speaker = spMatch[1]?.trim();
      const timeStr = spMatch[2];
      const content = spMatch[3]?.trim();
      const startOffsetMs = timeStr ? parseTimestampToMs(timeStr) : (currentOrdinal - 1) * 10_000;

      segments.push({
        id: `raw-seg-${currentOrdinal}`,
        ordinal: currentOrdinal++,
        content,
        speaker: speaker || undefined,
        startOffsetMs,
        locator: {
          startOffsetMs,
          speaker: speaker || undefined,
        },
      });
      continue;
    }

    // Default paragraph
    const startOffsetMs = (currentOrdinal - 1) * 10_000;
    segments.push({
      id: `raw-seg-${currentOrdinal}`,
      ordinal: currentOrdinal++,
      content: line,
      startOffsetMs,
      locator: {
        startOffsetMs,
      },
    });
  }

  return segments;
}

export function parseTimestampToMs(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(":").map(Number);
  if (parts.length === 3) {
    return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  }
  if (parts.length === 2) {
    return (parts[0] * 60 + parts[1]) * 1000;
  }
  return 0;
}

function HighlightMatches({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-warning/30 text-foreground rounded-xs px-0.5 font-medium">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
