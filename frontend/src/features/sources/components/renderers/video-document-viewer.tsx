import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  Edit2,
  Film,
  ImageIcon,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Search,
  Sparkles,
  User,
  Video,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;

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

  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); // in seconds
  const [duration, setDuration] = useState(0); // in seconds
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);
  const [isPipActive, setIsPipActive] = useState(false);

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

  // Auto-scroll to active segment if playing
  useEffect(() => {
    if (!activeSegmentId) return;
    const el = segmentElementsRef.current.get(activeSegmentId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeSegmentId]);

  // Handle citation jumping
  useEffect(() => {
    if (typeof selectedLocator?.startOffsetMs !== "number") return;
    const targetSeconds = selectedLocator.startOffsetMs / 1000;

    if (videoRef.current) {
      videoRef.current.currentTime = targetSeconds;
      setCurrentTime(targetSeconds);
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }

    if (iframeRef.current && youtubeVideoId) {
      setCurrentTime(targetSeconds);
      // Postmessage or update URL to seek YouTube video
      iframeRef.current.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: "seekTo", args: [targetSeconds, true] }),
        "*",
      );
    }

    // Match segment
    const matched = segments.find(
      (s) => Math.abs(s.startOffsetMs - (selectedLocator.startOffsetMs ?? 0)) < 1000,
    );
    if (matched) {
      setActiveSegmentId(matched.id);
      const el = segmentElementsRef.current.get(matched.id);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedLocator, segments, youtubeVideoId]);

  // Video element event handlers
  const handleTimeUpdate = () => {
    if (videoRef.current && !isSeeking) {
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

  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);
  const handleEnded = () => {
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  };

  // Player controls actions
  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
      }
    } else if (iframeRef.current && youtubeVideoId) {
      const func = isPlaying ? "pauseVideo" : "playVideo";
      iframeRef.current.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func, args: [] }),
        "*",
      );
      setIsPlaying(!isPlaying);
    }
  };

  const seekTo = (seconds: number) => {
    const clamped = Math.max(0, Math.min(seconds, duration || 100));
    setCurrentTime(clamped);
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
    if (iframeRef.current && youtubeVideoId) {
      iframeRef.current.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: "seekTo", args: [clamped, true] }),
        "*",
      );
    }
  };

  const handleScrubberChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setCurrentTime(value);
  };

  const handleScrubberStart = () => {
    setIsSeeking(true);
  };

  const handleScrubberEnd = (
    e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>,
  ) => {
    setIsSeeking(false);
    const value = parseFloat((e.target as HTMLInputElement).value);
    seekTo(value);
  };

  const handleSkip = (deltaSeconds: number) => {
    if (videoRef.current) {
      seekTo(videoRef.current.currentTime + deltaSeconds);
    } else {
      seekTo(currentTime + deltaSeconds);
    }
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    if (iframeRef.current && youtubeVideoId) {
      iframeRef.current.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: "setPlaybackRate", args: [rate] }),
        "*",
      );
    }
  };

  const cyclePlaybackRate = () => {
    const currentIndex = PLAYBACK_RATES.indexOf(playbackRate as (typeof PLAYBACK_RATES)[number]);
    const nextIndex = currentIndex === -1 ? 1 : (currentIndex + 1) % PLAYBACK_RATES.length;
    handleRateChange(PLAYBACK_RATES[nextIndex]);
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
    }
    if (iframeRef.current && youtubeVideoId) {
      const func = nextMuted ? "mute" : "unMute";
      iframeRef.current.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func, args: [] }),
        "*",
      );
    }
  };

  const handleVolumeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0;
    }
    if (iframeRef.current && youtubeVideoId) {
      iframeRef.current.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: "setVolume", args: [newVol * 100] }),
        "*",
      );
    }
  };

  const togglePictureInPicture = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPipActive(false);
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
        setIsPipActive(true);
      }
    } catch {
      toast.error("Picture-in-Picture not available in this browser");
    }
  };

  const toggleVideoFullscreen = () => {
    if (!videoContainerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      setIsVideoFullscreen(false);
    } else {
      videoContainerRef.current.requestFullscreen().catch(() => {});
      setIsVideoFullscreen(true);
    }
  };

  const handleSegmentClick = (segment: ParsedVideoSegment) => {
    const startSec = segment.startOffsetMs / 1000;
    seekTo(startSec);
    setActiveSegmentId(segment.id);
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
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

  // Unique speaker color mapper
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

  const totalWords = useMemo(
    () => segments.reduce((acc, s) => acc + s.content.split(/\s+/).filter(Boolean).length, 0),
    [segments],
  );

  return (
    <div className="flex h-full w-full flex-col lg:flex-row overflow-hidden bg-background text-foreground">
      {/* Left / Top Side: Video Player Panel */}
      <div className="flex flex-col lg:w-3/5 xl:w-2/3 shrink-0 border-b lg:border-b-0 lg:border-r border-border/70 bg-card/30">
        {/* Video Viewport Container */}
        <div
          ref={videoContainerRef}
          className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden group select-none"
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
              playsInline
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onPlay={handlePlay}
              onPause={handlePause}
              onEnded={handleEnded}
              className="w-full h-full max-h-[65vh] object-contain bg-black"
            />
          )}

          {isLoadingVideo && !isYouTube && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs text-white gap-2">
              <Loader2 className="size-8 animate-spin text-primary" />
              <span className="text-xs font-medium">Loading video stream…</span>
            </div>
          )}

          {isVideoError && !videoSrc && !isYouTube && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-warning gap-2 p-4 text-center">
              <AlertTriangle className="size-8 text-destructive" />
              <span className="text-sm font-semibold text-foreground">Video stream unavailable</span>
              <span className="text-xs text-muted-foreground">The source file could not be loaded.</span>
            </div>
          )}
        </div>

        {/* Video Controls Bar */}
        <div className="p-3 sm:p-4 bg-card/70 backdrop-blur-md flex flex-col gap-3 border-t border-border/40">
          {/* Top Info Row */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
                {isYouTube ? (
                  <>
                    <Video className="size-3 text-red-500" />
                    YouTube Stream
                  </>
                ) : (
                  <>
                    <Film className="size-3 text-primary" />
                    Video Recording
                  </>
                )}
              </Badge>
              {segments.length > 0 && (
                <Badge variant="secondary" className="font-normal text-[11px]">
                  {segments.length} {segments.length === 1 ? "segment" : "segments"} · {totalWords} words
                </Badge>
              )}
            </div>

            {isLoadingVideo && !isYouTube && (
              <div className="flex items-center gap-1.5 text-xs text-primary animate-pulse">
                <Loader2 className="size-3.5 animate-spin" />
                <span>Loading stream…</span>
              </div>
            )}
          </div>

          {/* Scrubber Timeline */}
          <div className="flex flex-col gap-1">
            <div className="relative flex items-center group">
              <input
                type="range"
                data-testid="seek-slider"
                aria-label="Seek time"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleScrubberChange}
                onMouseDown={handleScrubberStart}
                onMouseUp={handleScrubberEnd}
                onTouchStart={handleScrubberStart}
                onTouchEnd={handleScrubberEnd}
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Action Controls Row */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Playback Buttons */}
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-testid="skip-backward-button"
                aria-label="Skip backward 10 seconds"
                title="Skip backward 10s"
                onClick={() => handleSkip(-10)}
                className="size-8 cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="size-4" />
              </Button>

              <Button
                type="button"
                variant="default"
                size="icon"
                data-testid="play-pause-button"
                aria-label={isPlaying ? "Pause" : "Play"}
                title={isPlaying ? "Pause" : "Play"}
                onClick={togglePlayPause}
                className="size-9 rounded-full cursor-pointer shadow-sm transition-transform active:scale-95"
              >
                {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-testid="skip-forward-button"
                aria-label="Skip forward 10 seconds"
                title="Skip forward 10s"
                onClick={() => handleSkip(10)}
                className="size-8 cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <RotateCw className="size-4" />
              </Button>
            </div>

            {/* Right Side Options: Speed, Volume, PiP, Fullscreen */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Playback Speed */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="playback-speed-button"
                onClick={cyclePlaybackRate}
                className="h-7 px-2 text-xs font-mono cursor-pointer"
                title="Click to cycle speed (0.75x, 1x, 1.25x, 1.5x, 2x)"
              >
                {playbackRate}x
              </Button>

              {/* Volume & Mute */}
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  data-testid="volume-button"
                  aria-label={isMuted ? "Unmute" : "Mute"}
                  title={isMuted ? "Unmute" : "Mute"}
                  onClick={toggleMute}
                  className="size-7 cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="size-3.5 text-muted-foreground" />
                  ) : (
                    <Volume2 className="size-3.5" />
                  )}
                </Button>
                <input
                  type="range"
                  data-testid="volume-slider"
                  aria-label="Volume"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none hidden sm:inline-block"
                />
              </div>

              {/* Picture-in-Picture */}
              {!isYouTube && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  data-testid="pip-button"
                  aria-label="Picture in Picture"
                  title={isPipActive ? "Exit Picture in Picture" : "Picture in Picture"}
                  onClick={togglePictureInPicture}
                  className="size-7 cursor-pointer text-muted-foreground hover:text-foreground hidden sm:inline-flex"
                >
                  <PictureInPicture2 className="size-3.5" />
                </Button>
              )}

              {/* Fullscreen */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-testid="fullscreen-button"
                aria-label={isVideoFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                title={isVideoFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                onClick={toggleVideoFullscreen}
                className="size-7 cursor-pointer text-muted-foreground hover:text-foreground"
              >
                {isVideoFullscreen ? (
                  <Minimize className="size-3.5" />
                ) : (
                  <Maximize className="size-3.5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Right / Bottom Side: Synchronized Transcript Panel */}
      <div className="flex flex-col flex-1 min-h-0 bg-background overflow-hidden">
        {/* Transcript Toolbar */}
        <div className="shrink-0 border-b border-border/40 bg-muted/10 px-4 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                type="text"
                data-testid="transcript-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search transcript text or speaker…"
                className="h-8 w-full rounded-lg border border-border/60 bg-background pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Clear search"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            <Badge variant="secondary" className="gap-1 font-normal text-xs shrink-0">
              <Sparkles className="size-3 text-primary" />
              AI Transcription
            </Badge>
          </div>
        </div>

        {/* Scrollable Synchronized Transcript Segments */}
        <div
          ref={transcriptContainerRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5"
        >
          <div className="space-y-3">
            {filteredSegments.length === 0 ? (
              <div className="py-16 text-center text-xs text-muted-foreground">
                {searchQuery
                  ? `No transcript segments match "${searchQuery}".`
                  : "No transcript segments available for this video."}
              </div>
            ) : (
              filteredSegments.map((segment) => {
                const isActive = activeSegmentId === segment.id;
                const isSelectedCitation =
                  typeof selectedLocator?.startOffsetMs === "number" &&
                  Math.abs(segment.startOffsetMs - selectedLocator.startOffsetMs) < 1000;
                const isEditingThisSpeaker =
                  editingSpeaker !== null &&
                  editingSpeaker.originalSpeaker === segment.speaker;

                return (
                  <div
                    key={segment.id}
                    ref={(el) => {
                      if (el) segmentElementsRef.current.set(segment.id, el);
                      else segmentElementsRef.current.delete(segment.id);
                    }}
                    data-testid="transcript-segment"
                    data-active={isActive ? "true" : undefined}
                    onClick={() => handleSegmentClick(segment)}
                    className={cn(
                      "group rounded-xl border p-3.5 transition-all cursor-pointer",
                      isActive || isSelectedCitation
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30 shadow-xs"
                        : "border-border/60 bg-card/40 hover:border-border hover:bg-card/70",
                    )}
                  >
                    {/* Segment Header: Timestamp badge + Speaker pill */}
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {/* Timestamp Badge */}
                        <button
                          type="button"
                          data-testid="segment-timestamp"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSegmentClick(segment);
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                          title="Seek video to this timestamp"
                        >
                          [{formatTime(segment.startOffsetMs / 1000)}]
                        </button>

                        {/* Speaker Pill / Inline Renaming */}
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
                                  className="h-6 w-32 rounded border border-primary bg-background px-1.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
                                  className="size-5 flex items-center justify-center rounded bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
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
                                className={cn(
                                  "group/speaker inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-all cursor-pointer",
                                  getSpeakerColor(segment.speaker),
                                )}
                                title="Click to rename speaker"
                              >
                                <User className="size-2.5" />
                                <span>{segment.speaker}</span>
                                <Edit2 className="size-2.5 opacity-0 group-hover/speaker:opacity-100 transition-opacity ml-0.5" />
                              </button>
                            )}
                          </>
                        )}
                        {/* Visual Note Indicator */}
                        {(segment.locator?.imageRegion ||
                          segment.kind === "visual_description") && (
                          <span
                            data-testid="visual-note-badge"
                            className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                          >
                            <ImageIcon className="size-2.5" />
                            Visual Note
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] font-mono text-muted-foreground">
                        #{segment.ordinal}
                      </span>
                    </div>

                    {/* Segment Text Content */}
                    <p className="text-sm leading-relaxed text-foreground/90 select-text">
                      {searchQuery ? (
                        <HighlightMatches text={segment.content} query={searchQuery} />
                      ) : (
                        segment.content
                      )}
                    </p>
                  </div>
                );
              })
            )}
          </div>
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
