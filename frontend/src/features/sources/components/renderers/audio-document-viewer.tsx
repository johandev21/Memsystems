import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { SourceSegment, SourceSegmentLocator, SourceWithContent } from "../../types";
import type { ParsedAudioSegment } from "../../utils/audio-transcript-parser";
import { useAudioDownload, useAudioPlayer } from "./audio/use-audio-player";
import {
  useAudioSegmentList,
  useAudioSegmentSync,
  useFilteredAudioSegments,
  useSpeakerRename,
} from "./audio/use-audio-segments";
import { AudioPlayerBar } from "./audio/audio-player-bar";
import { AudioTranscriptToolbar } from "./audio/audio-transcript-toolbar";
import { AudioSegmentCard } from "./audio/audio-segment-card";
import { AudioTranscriptView } from "./audio/audio-transcript-view";

export interface AudioDocumentViewerProps {
  source: SourceWithContent;
  selectedLocator?: SourceSegmentLocator | null;
  scrollElement?: HTMLDivElement | null;
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
    handleTimeUpdate,
    handleLoadedMetadata,
    handlePlay,
    handlePause,
    handleEnded,
    togglePlayPause,
    handleScrubberChange,
    handleScrubberStart,
    handleScrubberEnd,
    handleSkip,
    cyclePlaybackRate,
    toggleMute,
    handleVolumeChange,
  } = player;

  const [searchQuery, setSearchQuery] = useState("");

  // Local segments state to support instant optimistic speaker renames
  const [prevSourceId, setPrevSourceId] = useState(source.id);
  const [customSegments, setCustomSegments] = useState<SourceSegment[] | null>(null);

  if (source.id !== prevSourceId) {
    setPrevSourceId(source.id);
    setCustomSegments(null);
  }

  const { isLoadingAudio, isAudioError, audioSrc } = useAudioDownload(source.id, source.url);

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

  const filteredSegments = useFilteredAudioSegments(segments, searchQuery);
  const isVirtualized = filteredSegments.length > 30;

  // TanStack Virtual exposes non-memoizable functions; the compiler skipping
  // this component is the intended behavior.
  // eslint-disable-next-line react/incompatible-library -- third-party virtualizer API
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

      <AudioTranscriptView
        filteredSegments={filteredSegments}
        isVirtualized={isVirtualized}
        searchQuery={searchQuery}
        transcriptContainerRef={transcriptContainerRef}
        segmentElementsRef={segmentElementsRef}
        virtualizer={virtualizer}
        renderTranscriptCard={renderTranscriptCard}
      />
    </div>
  );
}
