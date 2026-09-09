import { fetchApi } from "@/shared/api";
import { cn } from "@/shared/utils/cn";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertTriangle, FileText, ImageIcon, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { SourceSegmentLocator, SourceWithContent } from "../../types";
import {
  formatTime,
  hasTimestampPatterns,
  parseRawTextToVideoSegments,
  type ParsedVideoSegment,
} from "../../utils/video-transcript-parser";
import { AddTranscriptDialog } from "../add-transcript-dialog";
import { extractYouTubeId, isYouTubeUrl } from "./document-type-detector";

export interface VideoDocumentViewerProps {
  source: SourceWithContent;
  selectedLocator?: SourceSegmentLocator | null;
  scrollElement?: HTMLDivElement | null;
}

export { type ParsedVideoSegment };

function VideoPlayerView({
  isYouTube,
  youtubeVideoId,
  sourceTitle,
  videoSrc,
  videoRef,
  iframeRef,
  isLoadingVideo,
  isVideoError,
  onTimeUpdate,
  onLoadedMetadata,
}: {
  isYouTube: boolean;
  youtubeVideoId: string | null;
  sourceTitle: string;
  videoSrc: string | undefined;
  videoRef: { current: HTMLVideoElement | null };
  iframeRef: { current: HTMLIFrameElement | null };
  isLoadingVideo: boolean;
  isVideoError: boolean;
  onTimeUpdate: () => void;
  onLoadedMetadata: () => void;
}) {
  return (
    <>
      {isYouTube && youtubeVideoId ? (
        <iframe
          ref={iframeRef}
          data-testid="youtube-iframe"
          src={`https://www.youtube.com/embed/${youtubeVideoId}?enablejsapi=1`}
          title={sourceTitle}
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
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
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
    </>
  );
}

function TranscriptSegmentCard({
  segment,
  isActive,
  isSelectedCitation,
  onSeek,
}: {
  segment: ParsedVideoSegment;
  isActive: boolean;
  isSelectedCitation: boolean;
  onSeek: (segment: ParsedVideoSegment) => void;
}) {
  return (
    <div
      data-testid="transcript-segment"
      data-active={isActive ? "true" : undefined}
      onClick={() => onSeek(segment)}
      className={cn(
        "group rounded-lg border p-2.5 @min-[720px]:p-3 transition-colors cursor-pointer",
        isActive || isSelectedCitation
          ? "border-primary/40 bg-surface-2 ring-1 ring-primary/20 shadow-2xs"
          : "border-surface-border-subtle bg-surface-1/70 hover:bg-surface-2 hover:border-surface-border",
      )}
    >
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="segment-timestamp"
          onClick={(e) => {
            e.stopPropagation();
            onSeek(segment);
          }}
          className="inline-flex items-center rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] font-medium text-text-muted hover:bg-surface-3 hover:text-text-primary transition-colors cursor-pointer"
          title="Seek video to this timestamp"
        >
          [{formatTime(segment.startOffsetMs / 1000)}]
        </button>

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

      <p className="text-xs leading-relaxed text-text-primary select-text">{segment.content}</p>
    </div>
  );
}

function TranscriptListView({
  segments,
  activeSegmentId,
  selectedStartOffsetMs,
  isVirtualized,
  virtualizer,
  containerRef,
  segmentRefs,
  onSeek,
}: {
  segments: ParsedVideoSegment[];
  activeSegmentId: string | null;
  selectedStartOffsetMs?: number | null;
  isVirtualized: boolean;
  virtualizer: ReturnType<typeof useVirtualizer>;
  containerRef: { current: HTMLDivElement | null };
  segmentRefs: { current: Map<string, HTMLDivElement> };
  onSeek: (segment: ParsedVideoSegment) => void;
}) {
  const isSelected = (segment: ParsedVideoSegment) =>
    typeof selectedStartOffsetMs === "number" &&
    Math.abs(segment.startOffsetMs - selectedStartOffsetMs) < 1000;
  return (
    <div ref={containerRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 @min-[720px]:p-4">
      {isVirtualized ? (
        <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const segment = segments[virtualRow.index];
            if (!segment) return null;
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
                <TranscriptSegmentCard
                  segment={segment}
                  isActive={activeSegmentId === segment.id}
                  isSelectedCitation={isSelected(segment)}
                  onSeek={onSeek}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {segments.map((segment) => (
            <div
              key={segment.id}
              ref={(el) => {
                if (el) segmentRefs.current.set(segment.id, el);
                else segmentRefs.current.delete(segment.id);
              }}
            >
              <TranscriptSegmentCard
                segment={segment}
                isActive={activeSegmentId === segment.id}
                isSelectedCitation={isSelected(segment)}
                onSeek={onSeek}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NoTranscriptView({
  videoContainerRef,
  player,
  onAddTranscripts,
}: {
  videoContainerRef: { current: HTMLDivElement | null };
  player: ReactNode;
  onAddTranscripts: () => void;
}) {
  return (
    <div className="flex h-full w-full flex-col @min-[720px]:items-center @min-[720px]:justify-center @min-[720px]:p-6 overflow-y-auto overscroll-contain">
      <div className="w-full @min-[720px]:max-w-4xl @min-[1100px]:max-w-5xl flex flex-col shrink-0">
        <div
          ref={videoContainerRef}
          className="relative w-full aspect-video bg-black @min-[720px]:rounded-xl overflow-hidden @min-[720px]:shadow-md @min-[720px]:border @min-[720px]:border-surface-border flex items-center justify-center shrink-0 select-none max-h-[50vh] @min-[720px]:max-h-[75vh]"
        >
          {player}
        </div>

        <div className="hidden @min-[720px]:flex items-center justify-between w-full px-2 py-3 text-text-muted">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-text-secondary" />
            <span className="text-xs">No transcript attached to this video</span>
          </div>
          <button
            type="button"
            data-testid="add-transcripts-button-wide"
            onClick={onAddTranscripts}
            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 px-3.5 py-1.5 text-xs font-medium text-text-primary border border-surface-border shadow-2xs transition-colors cursor-pointer"
          >
            <FileText className="size-3.5 text-primary" />
            Add Transcripts
          </button>
        </div>
      </div>

      <div className="flex @min-[720px]:hidden flex-1 min-h-0 flex-col items-center justify-center p-6 text-center bg-surface-0">
        <div className="flex size-12 items-center justify-center rounded-xl bg-surface-2 text-text-muted mb-3">
          <FileText className="size-6 text-text-secondary" />
        </div>
        <h4 className="text-sm font-semibold text-text-primary mb-1">No Transcripts</h4>
        <p className="text-xs text-text-muted max-w-[260px] leading-relaxed mb-4">
          Add or paste a transcript to follow along with synchronized timestamps and search.
        </p>
        <button
          type="button"
          data-testid="add-transcripts-button"
          onClick={onAddTranscripts}
          className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-3.5 py-2 text-xs font-medium text-text-primary border border-surface-border shadow-xs hover:bg-surface-3 transition-colors cursor-pointer"
        >
          <FileText className="size-3.5 text-primary" />
          Add Transcripts
        </button>
      </div>
    </div>
  );
}

function useVideoDownload(sourceId: string, fallbackUrl?: string | null, disabled?: boolean) {
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

function useVideoSegments(source: SourceWithContent, duration: number) {
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

function useVideoSegmentSync({
  segments,
  currentTime,
  activeSegmentId,
  setActiveSegmentId,
  duration,
  setDuration,
}: {
  segments: ParsedVideoSegment[];
  currentTime: number;
  activeSegmentId: string | null;
  setActiveSegmentId: (id: string) => void;
  duration: number;
  setDuration: (d: number) => void;
}) {
  useEffect(() => {
    if (duration === 0 && segments.length > 0) {
      const lastSeg = segments[segments.length - 1];
      const maxMs = lastSeg.endOffsetMs ?? lastSeg.startOffsetMs + 5000;
      if (maxMs > 0) setDuration(Math.ceil(maxMs / 1000));
    }
  }, [segments, duration, setDuration]);

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
    if (found && found.id !== activeSegmentId) setActiveSegmentId(found.id);
  }, [currentTime, segments, activeSegmentId, setActiveSegmentId]);
}

export function VideoDocumentViewer({ source, selectedLocator }: VideoDocumentViewerProps) {
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
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [isAddTranscriptOpen, setIsAddTranscriptOpen] = useState(false);

  // Fetch presigned video download URL if not a YouTube URL
  const { isLoadingVideo, isVideoError, videoSrc } = useVideoDownload(
    source.id,
    source.url,
    isYouTube,
  );

  // Normalize segments + transcript availability
  const { segments, hasTranscripts } = useVideoSegments(source, duration);

  useVideoSegmentSync({
    segments,
    currentTime,
    activeSegmentId,
    setActiveSegmentId,
    duration,
    setDuration,
  });

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

  const isVirtualized = segments.length > 30;

  const virtualizer = useVirtualizer({
    count: segments.length,
    getScrollElement: () => transcriptContainerRef.current,
    estimateSize: () => 80,
    overscan: 6,
    getItemKey: (index) => segments[index]?.id ?? index,
    enabled: isVirtualized,
    initialRect: { width: 800, height: 600 },
  });

  // Auto-scroll to active segment if playing
  useEffect(() => {
    if (!activeSegmentId) return;
    if (isVirtualized) {
      const idx = segments.findIndex((s) => s.id === activeSegmentId);
      if (idx !== -1) {
        virtualizer.scrollToIndex(idx, { align: "center", behavior: "smooth" });
      }
    } else {
      const el = segmentElementsRef.current.get(activeSegmentId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [activeSegmentId, isVirtualized, segments, virtualizer]);

  // Handle citation jumping
  useEffect(() => {
    if (typeof selectedLocator?.startOffsetMs !== "number") return;
    const targetSeconds = selectedLocator.startOffsetMs / 1000;
    seekTo(targetSeconds);

    // Match segment
    const matchedIdx = segments.findIndex(
      (s) => Math.abs(s.startOffsetMs - (selectedLocator.startOffsetMs ?? 0)) < 1000,
    );
    if (matchedIdx !== -1) {
      const matched = segments[matchedIdx];
      setActiveSegmentId(matched.id);
      if (isVirtualized) {
        virtualizer.scrollToIndex(matchedIdx, { align: "center", behavior: "smooth" });
      } else {
        const el = segmentElementsRef.current.get(matched.id);
        el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [selectedLocator, segments, isVirtualized, virtualizer, seekTo]);

  const playerNode = (
    <VideoPlayerView
      isYouTube={isYouTube}
      youtubeVideoId={youtubeVideoId}
      sourceTitle={source.title}
      videoSrc={videoSrc}
      videoRef={videoRef}
      iframeRef={iframeRef}
      isLoadingVideo={isLoadingVideo}
      isVideoError={isVideoError}
      onTimeUpdate={handleTimeUpdate}
      onLoadedMetadata={handleLoadedMetadata}
    />
  );

  return (
    <div className="@container h-full w-full overflow-hidden bg-surface-0 text-text-primary">
      {hasTranscripts ? (
        /* When transcripts exist: Split layout in wide view (@min-[720px]), vertical stack in narrow */
        <div className="flex h-full w-full flex-col @min-[720px]:flex-row overflow-hidden">
          {/* Left / Top: Video Viewport Container */}
          <div className="flex flex-col shrink-0 bg-black items-center justify-center relative w-full @min-[720px]:w-1/2 @min-[900px]:w-3/5 border-b @min-[720px]:border-b-0 @min-[720px]:border-r border-surface-border">
            <div
              ref={videoContainerRef}
              className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden shrink-0 select-none max-h-[50vh] @min-[720px]:max-h-full"
            >
              {playerNode}
            </div>
          </div>

          {/* Right / Bottom: Scrollable Synchronized Transcripts */}
          <div className="flex flex-col flex-1 min-h-0 min-w-0 bg-surface-0 overflow-hidden">
            {/* Transcript Header with Add / Replace option */}
            <div className="shrink-0 flex items-center justify-between border-b border-surface-border bg-surface-0 px-3 py-2.5 @min-[720px]:px-4">
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Transcript
              </span>
              <button
                type="button"
                data-testid="add-transcripts-button"
                onClick={() => setIsAddTranscriptOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-text-faint hover:text-text-primary transition-colors cursor-pointer"
                title="Add or replace transcripts"
              >
                <FileText className="size-3 text-primary" />
                Add / Replace
              </button>
            </div>

            <TranscriptListView
              segments={segments}
              activeSegmentId={activeSegmentId}
              selectedStartOffsetMs={selectedLocator?.startOffsetMs}
              isVirtualized={isVirtualized}
              virtualizer={virtualizer}
              containerRef={transcriptContainerRef}
              segmentRefs={segmentElementsRef}
              onSeek={handleSegmentClick}
            />
          </div>
        </div>
      ) : (
        <NoTranscriptView
          videoContainerRef={videoContainerRef}
          player={playerNode}
          onAddTranscripts={() => setIsAddTranscriptOpen(true)}
        />
      )}

      {/* Add Transcript Dialog */}
      <AddTranscriptDialog
        sourceId={source.id}
        sourceTitle={source.title}
        open={isAddTranscriptOpen}
        onOpenChange={setIsAddTranscriptOpen}
      />
    </div>
  );
}
