import { useRef, useState, type ChangeEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/shared/api";
import { PLAYBACK_RATES } from "./audio-types";

export function useAudioDownload(sourceId: string, fallbackUrl?: string | null) {
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

export function useAudioPlayer(audioRef: { current: HTMLAudioElement | null }) {
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
