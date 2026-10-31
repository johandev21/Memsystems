import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type ReactNode,
} from "react";
import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

// Adapted from elevenlabs/ui audio-player.tsx at 3a28ebab197f8cfa599934f52db12ad1396e54f4 (MIT, package metadata).
const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

type AudioPlayerLabels = {
  play: string;
  pause: string;
  rewind: string;
  forward: string;
  progress: string;
  speed: string;
  error: string;
  retry: string;
  ready: string;
  playing: string;
  buffering: string;
};

type AudioPlayerState = {
  audioRef: RefObject<HTMLAudioElement | null>;
  duration: number | null;
  isPlaying: boolean;
  isBuffering: boolean;
  playbackRate: number;
  labels: AudioPlayerLabels;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setPlaybackRate: (rate: number) => void;
  retry: () => void;
};

const AudioPlayerContext = createContext<AudioPlayerState | null>(null);
const AudioPlayerTimeContext = createContext(0);

function useAudioPlayer() {
  const state = useContext(AudioPlayerContext);
  if (!state) throw new Error("Audio player controls must be inside AudioPlayerProvider");
  return state;
}

export function AudioPlayerProvider({
  src,
  audioLabel,
  labels,
  children,
}: {
  src: string;
  audioLabel: string;
  labels: AudioPlayerLabels;
  children: ReactNode;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playAttempt = useRef(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [hasError, setHasError] = useState(false);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const nextTime = Math.min(Math.max(time, 0), audio.duration);
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }, []);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (
      Number.isFinite(audio.duration) &&
      audio.duration > 0 &&
      audio.currentTime >= audio.duration
    ) {
      audio.currentTime = 0;
      setCurrentTime(0);
    }
    const attempt = ++playAttempt.current;
    setHasError(false);
    setIsBuffering(true);
    void audio.play().catch(() => {
      if (playAttempt.current !== attempt) return;
      setIsPlaying(false);
      setIsBuffering(false);
      setHasError(true);
    });
  }, []);

  const pause = useCallback(() => {
    playAttempt.current += 1;
    audioRef.current?.pause();
    setIsPlaying(false);
    setIsBuffering(false);
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    if (!(SPEEDS as readonly number[]).includes(rate)) return;
    if (audioRef.current) audioRef.current.playbackRate = rate;
    setPlaybackRateState(rate);
  }, []);

  const retry = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.load();
    play();
  }, [play]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    playAttempt.current += 1;
    audio.pause();
    audio.currentTime = 0;
    audio.playbackRate = 1;
    setCurrentTime(0);
    setDuration(null);
    setIsPlaying(false);
    setIsBuffering(false);
    setPlaybackRateState(1);
    setHasError(false);
    audio.src = src;
    audio.load();
    return () => {
      playAttempt.current += 1;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const updateTime = () =>
      setCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
    const updateDuration = () =>
      setDuration(Number.isFinite(audio.duration) ? audio.duration : null);
    const onPlay = () => {
      setIsPlaying(true);
      setHasError(false);
    };
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => setIsBuffering(false);
    const onCanPlay = () => {
      setHasError(false);
      setIsBuffering(false);
    };
    const onError = () => {
      setIsPlaying(false);
      setIsBuffering(false);
      setHasError(true);
    };
    const onEnded = () => {
      setIsPlaying(false);
      setIsBuffering(false);
    };
    const onRateChange = () => setPlaybackRateState(audio.playbackRate);
    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("seeking", updateTime);
    audio.addEventListener("seeked", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("error", onError);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("ratechange", onRateChange);
    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("seeking", updateTime);
      audio.removeEventListener("seeked", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("ratechange", onRateChange);
    };
  }, []);

  const state = useMemo(
    () => ({
      audioRef,
      duration,
      isPlaying,
      isBuffering,
      playbackRate,
      labels,
      play,
      pause,
      seek,
      setPlaybackRate,
      retry,
    }),
    [
      duration,
      isPlaying,
      isBuffering,
      playbackRate,
      labels,
      play,
      pause,
      seek,
      setPlaybackRate,
      retry,
    ],
  );

  return (
    <AudioPlayerContext.Provider value={state}>
      <AudioPlayerTimeContext.Provider value={currentTime}>
        <audio ref={audioRef} preload="none" aria-label={audioLabel} className="sr-only" />
        {hasError ? (
          <div className="flex flex-wrap items-center gap-3 text-sm text-destructive" role="alert">
            <span>{labels.error}</span>
            <Button type="button" variant="outline" size="sm" onClick={retry}>
              <RotateCcw aria-hidden="true" />
              {labels.retry}
            </Button>
          </div>
        ) : null}
        {children}
      </AudioPlayerTimeContext.Provider>
    </AudioPlayerContext.Provider>
  );
}

export function AudioPlayerButton({ className = "" }: { className?: string }) {
  const player = useAudioPlayer();
  return (
    <Button
      type="button"
      variant="default"
      size="icon-lg"
      data-slot="audio-player-button"
      className={`size-12 touch-manipulation rounded-full active:scale-97 max-sm:size-14 ${className}`}
      aria-label={player.isPlaying ? player.labels.pause : player.labels.play}
      aria-busy={player.isBuffering || undefined}
      onClick={player.isPlaying ? player.pause : player.play}
    >
      {player.isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
    </Button>
  );
}

export function AudioPlayerSkipButton({
  direction,
  className = "",
}: {
  direction: "backward" | "forward";
  className?: string;
}) {
  const player = useAudioPlayer();
  const seekBy = direction === "backward" ? -15 : 15;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-lg"
      data-slot="audio-player-skip"
      data-direction={direction}
      className={`min-h-11 min-w-11 touch-manipulation active:scale-97 ${className}`}
      aria-label={direction === "backward" ? player.labels.rewind : player.labels.forward}
      disabled={!Number.isFinite(player.duration) || !player.duration}
      onClick={() => {
        const audio = player.audioRef.current;
        if (audio) player.seek(audio.currentTime + seekBy);
      }}
    >
      {direction === "backward" ? (
        <RotateCcw aria-hidden="true" />
      ) : (
        <RotateCw aria-hidden="true" />
      )}
      <span aria-hidden="true" className="absolute font-mono text-xs">
        15
      </span>
    </Button>
  );
}

export function AudioPlayerProgress({ className = "" }: { className?: string }) {
  const player = useAudioPlayer();
  const currentTime = useContext(AudioPlayerTimeContext);
  const duration = Number.isFinite(player.duration) ? (player.duration ?? 0) : 0;
  const value = Math.min(Math.max(currentTime, 0), duration);
  return (
    <div data-slot="audio-player-progress" className={className}>
      <div aria-hidden="true" data-slot="audio-player-segments">
        {Array.from({ length: 48 }, (_, index) => (
          <span
            key={index}
            data-played={index / 48 < (duration > 0 ? value / duration : 0) || undefined}
            data-slot="audio-player-segment"
          />
        ))}
      </div>
      <input
        type="range"
        aria-label={player.labels.progress}
        aria-valuetext={`${formatAudioTime(value)} / ${formatAudioTime(duration)}`}
        min={0}
        max={duration}
        step={0.25}
        value={value}
        disabled={duration <= 0}
        data-slot="audio-player-range"
        onChange={(event) => player.seek(Number(event.currentTarget.value))}
      />
    </div>
  );
}

export function AudioPlayerStatus({ className = "" }: { className?: string }) {
  const player = useAudioPlayer();
  const label = player.isBuffering
    ? player.labels.buffering
    : player.isPlaying
      ? player.labels.playing
      : player.labels.ready;
  return (
    <p data-slot="audio-player-status" className={className} role="status" aria-live="polite">
      {label}
    </p>
  );
}

export function AudioPlayerTime({ className = "" }: { className?: string }) {
  const time = useContext(AudioPlayerTimeContext);
  return (
    <span data-slot="audio-player-time" className={`font-mono text-xs tabular-nums text-text-secondary ${className}`}>
      {formatAudioTime(time)}
    </span>
  );
}

export function AudioPlayerDuration({ className = "" }: { className?: string }) {
  const { duration } = useAudioPlayer();
  return (
    <span data-slot="audio-player-duration" className={`font-mono text-xs tabular-nums text-text-secondary ${className}`}>
      {duration === null ? "--:--" : formatAudioTime(duration)}
    </span>
  );
}

export function AudioPlayerSpeed({ className = "" }: { className?: string }) {
  const player = useAudioPlayer();
  const items = SPEEDS.map((speed) => ({ label: `${speed}×`, value: String(speed) }));
  return (
    <Select
      items={items}
      value={String(player.playbackRate)}
      onValueChange={(value) => {
        if (value) player.setPlaybackRate(Number(value));
      }}
    >
      <SelectTrigger
        aria-label={player.labels.speed}
        className={`min-h-11 min-w-20 rounded-xl px-2.5 font-mono text-xs ${className}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {items.map(({ label, value }) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function formatAudioTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = Math.floor(seconds % 60);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}
