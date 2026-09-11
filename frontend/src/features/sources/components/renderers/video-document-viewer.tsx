import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FileText } from "lucide-react";
import type { VideoDocumentViewerProps, ParsedVideoSegment } from "./video/video-types";
import {
  useVideoDownload,
  useVideoSegments,
  useVideoSegmentSync,
} from "./video/use-video-player";
import { VideoPlayerView } from "./video/video-player-view";
import { TranscriptListView } from "./video/transcript-list-view";
import { NoTranscriptView } from "./video/no-transcript-view";
import { AddTranscriptDialog } from "../add-transcript-dialog";
import { extractYouTubeId, isYouTubeUrl } from "../../utils/detect-document-type";

export type { VideoDocumentViewerProps, ParsedVideoSegment };

export function VideoDocumentViewer({ source, selectedLocator }: VideoDocumentViewerProps) {
  const { t } = useTranslation("sourceRenderers");
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const segmentElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  // Detect YouTube video
  const isYouTube = isYouTubeUrl(source.url);
  const youtubeVideoId = isYouTube ? extractYouTubeId(source.url) : null;

  const [currentTime, setCurrentTime] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(0);
  const [isAddTranscriptOpen, setIsAddTranscriptOpen] = useState(false);

  const { isLoadingVideo, isVideoError, videoSrc } = useVideoDownload(
    source.id,
    source.url,
    isYouTube,
  );

  const fallbackDuration = useMemo(() => {
    const srcSegments = source.segments;
    if (srcSegments && srcSegments.length > 0) {
      const last = srcSegments[srcSegments.length - 1];
      const maxMs =
        (last.locator as { endOffsetMs?: number } | undefined)?.endOffsetMs ??
        (last.locator as { startOffsetMs?: number } | undefined)?.startOffsetMs ??
        0;
      if (maxMs > 0) return Math.ceil(maxMs / 1000);
    }
    return 0;
  }, [source.segments]);

  const duration = mediaDuration > 0 ? mediaDuration : fallbackDuration;
  const { segments, hasTranscripts } = useVideoSegments(source, duration);

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

  const { activeSegmentId, setActiveSegmentId } = useVideoSegmentSync({
    segments,
    currentTime,
    isVirtualized,
    virtualizer,
    segmentElementsRef,
  });

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      if (dur && !isNaN(dur) && isFinite(dur)) {
        setMediaDuration(dur);
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

  // Handle citation jumping
  useEffect(() => {
    if (typeof selectedLocator?.startOffsetMs !== "number") return;
    const targetSeconds = selectedLocator.startOffsetMs / 1000;
    seekTo(targetSeconds);

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
  }, [selectedLocator, segments, isVirtualized, virtualizer, seekTo, setActiveSegmentId]);

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
        <div className="flex h-full w-full flex-col @min-[720px]:flex-row overflow-hidden">
          <div className="flex flex-col shrink-0 bg-black items-center justify-center relative w-full @min-[720px]:w-1/2 @min-[900px]:w-3/5 border-b @min-[720px]:border-b-0 @min-[720px]:border-r border-surface-border">
            <div
              ref={videoContainerRef}
              className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden shrink-0 select-none max-h-[50vh] @min-[720px]:max-h-full"
            >
              {playerNode}
            </div>
          </div>

          <div className="flex flex-col flex-1 min-h-0 min-w-0 bg-surface-0 overflow-hidden">
            <div className="shrink-0 flex items-center justify-between border-b border-surface-border bg-surface-0 px-3 py-2.5 @min-[720px]:px-4">
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                {t("videoTranscript.transcript")}
              </span>
              <button
                type="button"
                data-testid="add-transcripts-button"
                onClick={() => setIsAddTranscriptOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-text-faint hover:text-text-primary transition-colors cursor-pointer"
                title={t("videoTranscript.addOrReplaceTitle")}
              >
                <FileText className="size-3 text-primary" />
                {t("videoTranscript.addReplace")}
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

      <AddTranscriptDialog
        sourceId={source.id}
        sourceTitle={source.title}
        open={isAddTranscriptOpen}
        onOpenChange={setIsAddTranscriptOpen}
      />
    </div>
  );
}
