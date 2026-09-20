import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Headphones,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { formatTime } from "../../../utils/audio-transcript-parser";
import type { AudioPlayerBarProps } from "./audio-types";

export function AudioPlayerBar({
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
  const { t } = useTranslation("sourceRenderers");
  const { isLoadingAudio, isAudioError, isPlaying, isMuted } = playbackState;
  return (
    <div className="shrink-0 border-b border-border/70 bg-card/60 backdrop-blur-md p-3 sm:p-4 shadow-xs">
      <div className="max-w-4xl mx-auto flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
              <Headphones className="size-3 text-primary" />
              {t("audioPlayer.audioRecording")}
            </Badge>
            {segmentsCount > 0 && (
              <Badge variant="secondary" className="font-normal text-xs">
                {t("audioPlayer.summary", { count: segmentsCount, words: totalWords })}
              </Badge>
            )}
          </div>

          {isLoadingAudio && (
            <div className="flex items-center gap-1.5 text-xs text-primary animate-pulse">
              <Loader2 className="size-3.5 animate-spin" />
              <span>{t("audioPlayer.loadingStream")}</span>
            </div>
          )}
          {isAudioError && !audioSrc && (
            <div className="flex items-center gap-1 text-xs text-warning">
              <AlertTriangle className="size-3.5" />
              <span>{t("audioPlayer.streamUnavailable")}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <div className="relative flex items-center group">
            <input
              type="range"
              data-testid="seek-slider"
              aria-label={t("audioPlayer.seekTime")}
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
          <div className="flex justify-between text-xs font-mono text-muted-foreground">
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
              aria-label={t("audioPlayer.skipBackwardAria")}
              title={t("audioPlayer.skipBackwardTitle")}
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
              aria-label={isPlaying ? t("audioPlayer.pause") : t("audioPlayer.play")}
              title={isPlaying ? t("audioPlayer.pause") : t("audioPlayer.play")}
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
              aria-label={t("audioPlayer.skipForwardAria")}
              title={t("audioPlayer.skipForwardTitle")}
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
                title={t("audioPlayer.cycleSpeed")}
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
                aria-label={isMuted ? t("audioPlayer.unmute") : t("audioPlayer.mute")}
                title={isMuted ? t("audioPlayer.unmute") : t("audioPlayer.mute")}
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
                aria-label={t("audioPlayer.volume")}
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
