import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getApiUrl } from "@/shared/api";
import {
  AudioPlayerButton,
  AudioPlayerDuration,
  AudioPlayerProvider,
  AudioPlayerSkipButton,
  AudioPlayerTime,
} from "@/shared/components/ui/audio-player";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import type { AudioTimeline } from "./use-audio-timeline";
import styles from "./audio-overview-player.module.css";

const playbackSpeeds = [0.75, 1, 1.25, 1.5, 2].map((rate) => ({
  value: String(rate),
  label: `${rate}×`,
}));

export function AudioOverviewPlayer({
  materialId,
  audioVersion,
  title,
  detail,
  timeline,
  onDurationChange,
}: {
  materialId: string;
  audioVersion?: string;
  title: string;
  detail?: string;
  timeline?: AudioTimeline | null;
  onDurationChange?: (duration: number | null) => void;
}) {
  const { t } = useTranslation("viewer");
  const playerRoot = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ time: 0, duration: 0, rate: 1 });
  const audioLabel = t("audioOverview.playerLabel", { title });
  const src = getApiUrl(
    `/api/study-materials/${encodeURIComponent(materialId)}/audio?v=${encodeURIComponent(audioVersion ?? "")}`,
  );
  const labels = {
    play: t("audioOverview.player.play", { title }),
    pause: t("audioOverview.player.pause", { title }),
    rewind: t("audioOverview.player.rewind", { title }),
    forward: t("audioOverview.player.forward", { title }),
    progress: t("audioOverview.player.progress"),
    speed: t("audioOverview.player.speed"),
    error: t("audioOverview.playbackError"),
    retry: t("audioOverview.player.retry"),
    ready: t("audioOverview.player.ready"),
    playing: t("audioOverview.player.playing"),
    buffering: t("audioOverview.player.buffering"),
  };
  const updatePosition = useCallback(
    (audio: HTMLAudioElement) => {
      const time = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
      const rate = audio.playbackRate;
      setPosition((previous) =>
        previous.time === time && previous.duration === duration && previous.rate === rate
          ? previous
          : { time, duration, rate },
      );
      onDurationChange?.(duration || null);
    },
    [onDurationChange],
  );
  const notify = useEffectEvent(updatePosition);
  useEffect(() => {
    const audio = playerRoot.current?.querySelector("audio");
    if (!audio) return;
    let frame = 0;
    let lastSample = -Infinity;
    const sample = () => notify(audio);
    const seek = () => notify(audio);
    const tick = (now: number) => {
      // Read the media clock, never accumulate wall time (rate changes and stalls remain accurate).
      if (now - lastSample >= 50) {
        sample();
        lastSample = now;
      }
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(tick);
      sample();
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      sample();
    };
    const events = [
      "loadedmetadata",
      "durationchange",
      "timeupdate",
      "ratechange",
      "emptied",
    ] as const;
    events.forEach((name) => audio.addEventListener(name, sample));
    audio.addEventListener("seeking", seek);
    audio.addEventListener("seeked", seek);
    audio.addEventListener("play", start);
    audio.addEventListener("pause", stop);
    audio.addEventListener("ended", stop);
    sample();
    if (!audio.paused) start();
    return () => {
      cancelAnimationFrame(frame);
      events.forEach((name) => audio.removeEventListener(name, sample));
      audio.removeEventListener("seeking", seek);
      audio.removeEventListener("seeked", seek);
      audio.removeEventListener("play", start);
      audio.removeEventListener("pause", stop);
      audio.removeEventListener("ended", stop);
    };
  }, [src]);
  const seekTo = (time: number) => {
    const audio = playerRoot.current?.querySelector("audio");
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    audio.currentTime = Math.max(0, Math.min(time, audio.duration));
    updatePosition(audio);
  };
  const peaks = timeline?.waveform ?? [];
  const peakScale = Math.max(0.001, ...peaks);
  const duration = position.duration;
  const time = Math.min(position.time, duration);
  return (
    <div ref={playerRoot}>
      <AudioPlayerProvider src={src} audioLabel={audioLabel} labels={labels}>
        <section className={styles.player} aria-label={t("kinds.audio_overview")}>
          <div className={styles.transport}>
            <AudioPlayerButton />
            <div className={styles.track}>
              <p className={styles.title}>{title}</p>
              {detail && <p className={styles.detail}>{detail}</p>}
            </div>
            <div className={styles.skipGroup}>
              <AudioPlayerSkipButton direction="backward" />
              <AudioPlayerSkipButton direction="forward" />
            </div>
            <Select
              items={playbackSpeeds}
              value={String(position.rate)}
              onValueChange={(value) => {
                const audio = playerRoot.current?.querySelector("audio");
                if (!audio || !playbackSpeeds.some((speed) => speed.value === value)) return;
                audio.playbackRate = Number(value);
                updatePosition(audio);
              }}
            >
              <SelectTrigger aria-label={labels.speed}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                align="end"
                sideOffset={8}
                alignItemWithTrigger={false}
                data-audio-overview-speed-menu=""
              >
                <SelectGroup>
                  {playbackSpeeds.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className={styles.waveform}>
            {peaks.length ? (
              <svg
                viewBox={`0 0 ${peaks.length * 3} 64`}
                preserveAspectRatio="none"
                className={styles.wave}
                aria-hidden="true"
                data-testid="audio-waveform"
              >
                {peaks.map((peak, index) => {
                  const height = Math.max(1, (peak / peakScale) * 60);
                  return (
                    <rect
                      key={index}
                      x={index * 3}
                      y={(64 - height) / 2}
                      width={2}
                      height={height}
                      rx={1}
                      data-played={
                        (duration > 0 && index / peaks.length < time / duration) || undefined
                      }
                    />
                  );
                })}
              </svg>
            ) : (
              <div
                className={styles.placeholder}
                role="img"
                aria-label={t("audioOverview.player.waveformUnavailable")}
              />
            )}
            <input
              type="range"
              min={0}
              max={duration}
              step={0.01}
              value={time}
              disabled={duration <= 0}
              aria-label={labels.progress}
              aria-valuetext={`${formatTime(time)} / ${duration > 0 ? formatTime(duration) : "--:--"}`}
              className={styles.range}
              onChange={(event) => seekTo(Number(event.target.value))}
            />
          </div>
          <div className={styles.times} aria-live="off">
            <AudioPlayerTime />
            <AudioPlayerDuration />
          </div>
        </section>
      </AudioPlayerProvider>
    </div>
  );
}
function formatTime(time: number) {
  return `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, "0")}`;
}
