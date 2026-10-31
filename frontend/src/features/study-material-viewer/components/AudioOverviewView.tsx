import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAudioTimeline } from "./audio-overview/use-audio-timeline";
import { AudioOverviewPlayer } from "./audio-overview/audio-overview-player";
import styles from "./audio-overview-layout.module.css";
import { cn } from "@/shared/utils/cn";

type AudioSection = { heading: string; text: string; citations?: unknown[] };
type AudioContent = {
  title: string;
  transcript?: string;
  sections?: AudioSection[];
  metadata?: {
    format?: "briefing" | "deep_dive";
    length?: "short" | "standard" | "extended";
    audience?: "new_to_topic" | "some_background" | "advanced";
    sourceIds?: string[];
  };
};

type AudioGenerationOptions = {
  format?: "briefing" | "deep_dive";
  length?: "short" | "standard" | "extended";
  audience?: "new_to_topic" | "some_background" | "advanced";
  sourceIds?: string[];
};

const formatTranslationKeys = {
  briefing: "audioOverview.format.briefing",
  deep_dive: "audioOverview.format.deep_dive",
} as const;
const audienceTranslationKeys = {
  new_to_topic: "audioOverview.audience.new_to_topic",
  some_background: "audioOverview.audience.some_background",
  advanced: "audioOverview.audience.advanced",
} as const;
export function AudioOverviewView({
  materialId,
  audioVersion,
  options,
  content,
}: {
  materialId: string;
  notebookId: string;
  audioVersion?: string;
  options?: unknown;
  content: AudioContent;
}) {
  const { t } = useTranslation("viewer");
  const timeline = useAudioTimeline(materialId, audioVersion);
  const [duration, setDuration] = useState<number | null>(null);
  const savedOptions = readSavedOptions(options);
  const knownFormat = content.metadata?.format ?? savedOptions.format;
  const knownAudience = content.metadata?.audience ?? savedOptions.audience;
  useEffect(() => {
    setDuration(null);
  }, [materialId, audioVersion]);

  return (
    <article className={cn(styles.layout, "mx-auto w-full max-w-6xl space-y-6 pb-6")}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <h2
            className={cn(
              styles.title,
              "break-words font-sans font-medium leading-tight tracking-tight text-text-primary",
            )}
          >
            {content.title}
          </h2>
        </div>
        {duration !== null && duration > 0 && (
          <p className={styles.duration}>{formatDuration(duration)}</p>
        )}
      </header>
      <AudioOverviewPlayer
        materialId={materialId}
        audioVersion={audioVersion}
        title={content.title}
        detail={
          [
            knownFormat && t(formatTranslationKeys[knownFormat]),
            knownAudience && t(audienceTranslationKeys[knownAudience]),
          ]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        onDurationChange={setDuration}
        timeline={timeline}
      />
    </article>
  );
}

function formatDuration(duration: number) {
  const totalSeconds = Math.floor(duration);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function readSavedOptions(options: unknown): AudioGenerationOptions {
  if (!options || typeof options !== "object") return {};
  const value = options as Record<string, unknown>;
  return {
    format: value.format === "briefing" || value.format === "deep_dive" ? value.format : undefined,
    length:
      value.length === "short" || value.length === "standard" || value.length === "extended"
        ? value.length
        : undefined,
    audience:
      value.audience === "new_to_topic" ||
      value.audience === "some_background" ||
      value.audience === "advanced"
        ? value.audience
        : undefined,
    sourceIds:
      Array.isArray(value.sourceIds) && value.sourceIds.every((id) => typeof id === "string")
        ? value.sourceIds
        : undefined,
  };
}
