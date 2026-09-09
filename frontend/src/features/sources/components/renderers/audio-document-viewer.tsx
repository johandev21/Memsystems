import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/shared/api";
import { cn } from "@/shared/utils/cn";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  AlertTriangle,
  Check,
  Edit2,
  Headphones,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Search,
  Sparkles,
  User,
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
import type { SourceSegment, SourceSegmentLocator, SourceWithContent } from "../../types";
import {
  formatTime,
  parseRawTextToAudioSegments,
  type ParsedAudioSegment,
} from "./audio-transcript-parser";

export interface AudioDocumentViewerProps {
  source: SourceWithContent;
  selectedLocator?: SourceSegmentLocator | null;
  scrollElement?: HTMLDivElement | null;
}

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;

function useAudioDownload(sourceId: string, fallbackUrl?: string | null) {
  const query = useQuery({
    queryKey: ["source-download", sourceId],
    queryFn: async () => {
      const response = await fetchApi(`/api/sources/${sourceId}/download`);
      if (!response.ok) {
        if (fallbackUrl) return { url: fallbackUrl };
        throw new Error("Failed to load audio file");
      }
      return (await response.json()) as { url: string; expiresIn?: number };
    },
    enabled: Boolean(sourceId),
    staleTime: 5 * 60 * 1000,
  });
  return {
    downloadData: query.data,
    isLoadingAudio: query.isLoading,
    isAudioError: query.isError,
    audioSrc: query.data?.url || fallbackUrl || undefined,
  };
}

function useAudioSegmentList(
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

function useFilteredAudioSegments(segments: ParsedAudioSegment[], searchQuery: string) {
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

function useSpeakerRename(
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

interface AudioPlaybackState {
  isLoadingAudio: boolean;
  isAudioError: boolean;
  isPlaying: boolean;
  isMuted: boolean;
}

interface AudioPlayerBarProps {
  segmentsCount: number;
  totalWords: number;
  playbackState: AudioPlaybackState;
  audioSrc: string | undefined;
  currentTime: number;
  duration: number;
  playbackRate: number;
  volume: number;
  onScrubberChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onScrubberStart: () => void;
  onScrubberEnd: (
    e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>,
  ) => void;
  onSkip: (delta: number) => void;
  onTogglePlay: () => void;
  onCycleRate: () => void;
  onToggleMute: () => void;
  onVolumeChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

function AudioPlayerBar({
  segmentsCount,
  totalWords,
  playbackState,
  audioSrc,
  currentTime,
  duration,
  playbackRate,
  volume,
  onScrubberChange,
  onScrubberStart,
  onScrubberEnd,
  onSkip,
  onTogglePlay,
  onCycleRate,
  onToggleMute,
  onVolumeChange,
}: AudioPlayerBarProps) {
  const { isLoadingAudio, isAudioError, isPlaying, isMuted } = playbackState;
  return (
    <div className="shrink-0 border-b border-border/70 bg-card/60 backdrop-blur-md p-3 sm:p-4 shadow-xs">
      <div className="max-w-4xl mx-auto flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
              <Headphones className="size-3 text-primary" />
              Audio Recording
            </Badge>
            {segmentsCount > 0 && (
              <Badge variant="secondary" className="font-normal text-[11px]">
                {segmentsCount} {segmentsCount === 1 ? "segment" : "segments"} · {totalWords} words
              </Badge>
            )}
          </div>

          {isLoadingAudio && (
            <div className="flex items-center gap-1.5 text-xs text-primary animate-pulse">
              <Loader2 className="size-3.5 animate-spin" />
              <span>Loading audio stream…</span>
            </div>
          )}
          {isAudioError && !audioSrc && (
            <div className="flex items-center gap-1 text-xs text-warning">
              <AlertTriangle className="size-3.5" />
              <span>Audio stream unavailable</span>
            </div>
          )}
        </div>

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
              onChange={onScrubberChange}
              onMouseDown={onScrubberStart}
              onMouseUp={onScrubberEnd}
              onTouchStart={onScrubberStart}
              onTouchEnd={onScrubberEnd}
              className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
            />
          </div>
          <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              data-testid="skip-backward-button"
              aria-label="Skip backward 10 seconds"
              title="Skip backward 10s"
              onClick={() => onSkip(-10)}
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
              onClick={onTogglePlay}
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
              onClick={() => onSkip(10)}
              className="size-8 cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <RotateCw className="size-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="playback-speed-button"
                onClick={onCycleRate}
                className="h-7 px-2 text-xs font-mono cursor-pointer"
                title="Click to cycle speed (0.75x, 1x, 1.25x, 1.5x, 2x)"
              >
                {playbackRate}x
              </Button>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-testid="volume-button"
                aria-label={isMuted ? "Unmute" : "Mute"}
                title={isMuted ? "Unmute" : "Mute"}
                onClick={onToggleMute}
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
                onChange={onVolumeChange}
                className="w-16 h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none hidden sm:inline-block"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AudioTranscriptToolbar({
  searchQuery,
  onSearchChange,
}: {
  searchQuery: string;
  onSearchChange: (v: string) => void;
}) {
  return (
    <div className="shrink-0 border-b border-border/40 bg-muted/10 px-4 py-2">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            type="text"
            data-testid="transcript-search-input"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search transcript text or speaker…"
            aria-label="Search transcript text or speaker"
            className="h-8 w-full rounded-lg border border-border/60 bg-background pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
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
  );
}

function AudioSegmentCard({
  segment,
  isActive,
  isSelectedCitation,
  searchQuery,
  speakerColor,
  isEditingSpeaker,
  editingValue,
  onSegmentClick,
  onTimestampClick,
  onStartRename,
  onRenameChange,
  onSaveRename,
  onCancelRename,
  onSpeakerKeyDown,
}: {
  segment: ParsedAudioSegment;
  isActive: boolean;
  isSelectedCitation: boolean;
  searchQuery: string;
  speakerColor: string;
  isEditingSpeaker: boolean;
  editingValue: string;
  onSegmentClick: (segment: ParsedAudioSegment) => void;
  onTimestampClick: (segment: ParsedAudioSegment) => void;
  onStartRename: (speaker: string, e: React.MouseEvent) => void;
  onRenameChange: (v: string) => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onSpeakerKeyDown: (e: ReactKeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div
      data-testid="transcript-segment"
      data-active={isActive ? "true" : undefined}
      className={cn(
        "group rounded-xl border p-3.5 transition-all",
        isActive || isSelectedCitation
          ? "border-primary bg-primary/5 ring-1 ring-primary/30 shadow-xs"
          : "border-border/60 bg-card/40 hover:border-border hover:bg-card/70",
      )}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="segment-timestamp"
            onClick={(e) => {
              e.stopPropagation();
              onTimestampClick(segment);
            }}
            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
            title="Seek audio to this timestamp"
          >
            [{formatTime(segment.startOffsetMs / 1000)}]
          </button>
          {segment.speaker && (
            <>
              {isEditingSpeaker ? (
                <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    autoFocus
                    data-testid="speaker-rename-input"
                    aria-label="Rename speaker"
                    value={editingValue}
                    onChange={(e) => onRenameChange(e.target.value)}
                    onKeyDown={onSpeakerKeyDown}
                    className="h-6 w-32 rounded border border-primary bg-background px-1.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    data-testid="speaker-rename-save"
                    onClick={onSaveRename}
                    className="size-5 flex items-center justify-center rounded bg-primary text-primary-foreground hover:opacity-90 cursor-pointer"
                    title="Save speaker name"
                  >
                    <Check className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={onCancelRename}
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
                  onClick={(e) => onStartRename(segment.speaker!, e)}
                  className={cn(
                    "group/speaker inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-all cursor-pointer",
                    speakerColor,
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
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">#{segment.ordinal}</span>
      </div>
      <button
        type="button"
        onClick={() => onSegmentClick(segment)}
        className="w-full text-left font-normal text-sm leading-relaxed text-foreground/90 select-text cursor-pointer focus:outline-none focus-visible:underline"
      >
        {searchQuery ? <HighlightMatches text={segment.content} query={searchQuery} /> : segment.content}
      </button>
    </div>
  );
}

function useAudioPlayer(audioRef: { current: HTMLAudioElement | null }) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const isSeekingRef = useRef(false);

  const handleTimeUpdate = () => {
    if (audioRef.current && !isSeekingRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const dur = audioRef.current.duration;
      if (dur && !isNaN(dur) && isFinite(dur)) setDuration(dur);
    }
  };
  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);
  const handleEnded = () => {
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  };
  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play().catch(() => {});
  };
  const seekTo = (seconds: number) => {
    const clamped = Math.max(0, Math.min(seconds, duration || 100));
    setCurrentTime(clamped);
    if (audioRef.current) audioRef.current.currentTime = clamped;
  };
  const handleScrubberChange = (e: ChangeEvent<HTMLInputElement>) =>
    setCurrentTime(parseFloat(e.target.value));
  const handleScrubberStart = () => {
    isSeekingRef.current = true;
  };
  const handleScrubberEnd = (
    e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>,
  ) => {
    isSeekingRef.current = false;
    seekTo(parseFloat((e.target as HTMLInputElement).value));
  };
  const handleSkip = (deltaSeconds: number) => {
    if (!audioRef.current) return;
    seekTo(audioRef.current.currentTime + deltaSeconds);
  };
  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) audioRef.current.playbackRate = rate;
  };
  const cyclePlaybackRate = () => {
    const idx = PLAYBACK_RATES.indexOf(playbackRate as (typeof PLAYBACK_RATES)[number]);
    handleRateChange(PLAYBACK_RATES[idx === -1 ? 1 : (idx + 1) % PLAYBACK_RATES.length]);
  };
  const toggleMute = () => {
    if (!audioRef.current) return;
    const next = !isMuted;
    setIsMuted(next);
    audioRef.current.muted = next;
  };
  const handleVolumeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    setIsMuted(v === 0);
    if (audioRef.current) {
      audioRef.current.volume = v;
      audioRef.current.muted = v === 0;
    }
  };
  return {
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    playbackRate,
    volume,
    isMuted,
    handleTimeUpdate,
    handleLoadedMetadata,
    handlePlay,
    handlePause,
    handleEnded,
    togglePlayPause,
    seekTo,
    handleScrubberChange,
    handleScrubberStart,
    handleScrubberEnd,
    handleSkip,
    cyclePlaybackRate,
    toggleMute,
    handleVolumeChange,
  };
}

function useAudioSegmentSync({
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
  }, [currentTime, segments, activeSegmentId, filteredSegments, isVirtualized, virtualizer, segmentElementsRef]);

  return { activeSegmentId, setActiveSegmentId };
}

export function AudioDocumentViewer({ source, selectedLocator }: AudioDocumentViewerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const segmentElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  const player = useAudioPlayer(audioRef);
  const {
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    volume,
    isMuted,
    seekTo,
  } = player;

  // Transcript state
  const [searchQuery, setSearchQuery] = useState("");

  // Local segments state to support instant optimistic speaker renames without useEffect
  const [prevSourceId, setPrevSourceId] = useState(source.id);
  const [customSegments, setCustomSegments] = useState<SourceSegment[] | null>(null);

  if (source.id !== prevSourceId) {
    setPrevSourceId(source.id);
    setCustomSegments(null);
  }

  const { isLoadingAudio, isAudioError, audioSrc } = useAudioDownload(source.id, source.url);

  // Normalize segments
  const effectiveSourceSegments = customSegments ?? source.segments;
  const { segments, totalWords } = useAudioSegmentList(source, effectiveSourceSegments);

  const fallbackDuration = useMemo(() => {
    if (segments.length === 0) return 0;
    const last = segments[segments.length - 1];
    const maxMs = last.endOffsetMs ?? last.startOffsetMs + 5000;
    return maxMs > 0 ? Math.ceil(maxMs / 1000) : 0;
  }, [segments]);

  const effectiveDuration = duration > 0 ? duration : fallbackDuration;

  const {
    editingSpeaker,
    setEditingSpeaker,
    handleStartRenameSpeaker,
    handleSaveSpeakerRename,
    handleSpeakerKeyDown,
    getSpeakerColor,
  } = useSpeakerRename(source.id, segments, setCustomSegments);

  // Filter segments by search query
  const filteredSegments = useFilteredAudioSegments(segments, searchQuery);

  const isVirtualized = filteredSegments.length > 30;

  const virtualizer = useVirtualizer({
    count: filteredSegments.length,
    getScrollElement: () => transcriptContainerRef.current,
    estimateSize: () => 90,
    overscan: 6,
    getItemKey: (index) => filteredSegments[index]?.id ?? index,
    enabled: isVirtualized,
    initialRect: { width: 800, height: 600 },
  });

  const { activeSegmentId, setActiveSegmentId } = useAudioSegmentSync({
    segments,
    currentTime,
    filteredSegments,
    isVirtualized,
    virtualizer,
    segmentElementsRef,
  });

  // Handle citation jumping
  useEffect(() => {
    if (typeof selectedLocator?.startOffsetMs !== "number") return;
    const target = selectedLocator.startOffsetMs / 1000;
    if (audioRef.current) audioRef.current.currentTime = target;
    audioRef.current?.play().catch(() => {});
    const idx = filteredSegments.findIndex(
      (s) => Math.abs(s.startOffsetMs - (selectedLocator.startOffsetMs ?? 0)) < 1000,
    );
    if (idx !== -1) {
      const matched = filteredSegments[idx];
      setActiveSegmentId(matched.id);
      if (isVirtualized) {
        virtualizer.scrollToIndex(idx, { align: "center", behavior: "smooth" });
      } else {
        segmentElementsRef.current.get(matched.id)?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }
  }, [selectedLocator, filteredSegments, isVirtualized, virtualizer, setActiveSegmentId]);

  const { handleTimeUpdate, handleLoadedMetadata, handlePlay, handlePause, handleEnded } = player;
  const {
    togglePlayPause,
    handleScrubberChange,
    handleScrubberStart,
    handleScrubberEnd,
    handleSkip,
    cyclePlaybackRate,
    toggleMute,
    handleVolumeChange,
  } = player;

  const handleSegmentClick = (segment: ParsedAudioSegment) => {
    seekTo(segment.startOffsetMs / 1000);
    setActiveSegmentId(segment.id);
    audioRef.current?.play().catch(() => {});
  };

  const isSelectedCitation = (segment: ParsedAudioSegment) =>
    typeof selectedLocator?.startOffsetMs === "number" &&
    Math.abs(segment.startOffsetMs - selectedLocator.startOffsetMs) < 1000;

  const renderTranscriptCard = (segment: ParsedAudioSegment) => {
    const isActive = activeSegmentId === segment.id;
    const isEditingThis =
      editingSpeaker !== null && editingSpeaker.originalSpeaker === segment.speaker;
    return (
      <AudioSegmentCard
        segment={segment}
        isActive={isActive}
        isSelectedCitation={isSelectedCitation(segment)}
        searchQuery={searchQuery}
        speakerColor={getSpeakerColor(segment.speaker)}
        isEditingSpeaker={isEditingThis}
        editingValue={isEditingThis && editingSpeaker ? editingSpeaker.currentValue : ""}
        onSegmentClick={handleSegmentClick}
        onTimestampClick={handleSegmentClick}
        onStartRename={handleStartRenameSpeaker}
        onRenameChange={(v) =>
          setEditingSpeaker((prev) => (prev ? { ...prev, currentValue: v } : prev))
        }
        onSaveRename={handleSaveSpeakerRename}
        onCancelRename={() => setEditingSpeaker(null)}
        onSpeakerKeyDown={handleSpeakerKeyDown}
      />
    );
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
      {/* Hidden native HTML5 audio element */}
      <audio
        ref={audioRef}
        data-testid="audio-element"
        src={audioSrc}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        className="hidden"
      />

      <AudioPlayerBar
        segmentsCount={segments.length}
        totalWords={totalWords}
        playbackState={{
          isLoadingAudio,
          isAudioError,
          isPlaying,
          isMuted,
        }}
        audioSrc={audioSrc}
        currentTime={currentTime}
        duration={effectiveDuration}
        playbackRate={playbackRate}
        volume={volume}
        onScrubberChange={handleScrubberChange}
        onScrubberStart={handleScrubberStart}
        onScrubberEnd={handleScrubberEnd}
        onSkip={handleSkip}
        onTogglePlay={togglePlayPause}
        onCycleRate={cyclePlaybackRate}
        onToggleMute={toggleMute}
        onVolumeChange={handleVolumeChange}
      />

      <AudioTranscriptToolbar searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      {/* Synchronized Transcript View */}
      <div
        ref={transcriptContainerRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6"
      >
        {filteredSegments.length === 0 ? (
          <div className="py-16 text-center text-xs text-muted-foreground">
            {searchQuery
              ? `No transcript segments match "${searchQuery}".`
              : "No transcript segments available for this audio file."}
          </div>
        ) : isVirtualized ? (
          <div
            className="max-w-4xl mx-auto relative w-full"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const segment = filteredSegments[virtualRow.index];
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
                  className="py-1.5"
                >
                  {renderTranscriptCard(segment)}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-3">
            {filteredSegments.map((segment) => (
              <div
                key={segment.id}
                ref={(el) => {
                  if (el) segmentElementsRef.current.set(segment.id, el);
                  else segmentElementsRef.current.delete(segment.id);
                }}
              >
                {renderTranscriptCard(segment)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HighlightMatches({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, "gi"));
  return (
    <>
      {parts.map((part) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={part} className="bg-warning/30 text-foreground rounded-xs px-0.5 font-medium">
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
