import type { ChangeEvent, ReactNode } from "react";
import type { ParsedAudioSegment } from "../../../utils/audio-transcript-parser";

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;

export interface AudioPlaybackState {
  isLoadingAudio: boolean;
  isAudioError: boolean;
  isPlaying: boolean;
  isMuted: boolean;
}

export interface AudioPlayerBarProps {
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

export interface AudioTranscriptViewProps {
  filteredSegments: ParsedAudioSegment[];
  isVirtualized: boolean;
  searchQuery: string;
  transcriptContainerRef: React.RefObject<HTMLDivElement | null>;
  segmentElementsRef: React.RefObject<Map<string, HTMLDivElement>>;
  renderSegmentCard: (segment: ParsedAudioSegment) => ReactNode;
}
