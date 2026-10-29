import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { getApiUrl } from "@/shared/api";
import {
  cancelGeneration,
  startGeneration,
} from "@/features/study-material-generation/api/generation";

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
  brief?: string;
};

export function AudioOverviewView({
  materialId,
  notebookId,
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
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const savedOptions = readAudioGenerationOptions(options);
  const [format, setFormat] = useState(
    content.metadata?.format ?? savedOptions.format ?? "briefing",
  );
  const [length, setLength] = useState(
    content.metadata?.length ?? savedOptions.length ?? "standard",
  );
  const [audience, setAudience] = useState(
    content.metadata?.audience ?? savedOptions.audience ?? "some_background",
  );
  const [brief, setBrief] = useState(savedOptions.brief ?? "");
  const [request, setRequest] = useState<{
    id: string;
    abort: () => void;
  } | null>(null);
  const [error, setError] = useState("");
  const [stage, setStage] = useState<"writing_script" | "synthesizing_audio">(
    "writing_script",
  );
  const cancelled = useRef(false);
  const sections = content.sections;
  const sourceIds = content.metadata?.sourceIds ?? savedOptions.sourceIds ?? [];

  const regenerate = async () => {
    setError("");
    setStage("writing_script");
    cancelled.current = false;
    const generation = startGeneration(notebookId, {
      kind: "audio_overview",
      brief,
      sourceIds,
      audioOverviewOptions: { format, length, audience },
      replaceMaterialId: materialId,
    });
    try {
      const id = await generation.requestIdPromise;
      if (!id) throw new Error(t("audioOverview.regenerateError"));
      setRequest({ id, abort: generation.abort });
      let completed = false;
      for await (const event of generation.stream) {
        if (event.type === "error") throw event.error;
        if (event.type === "stage") setStage(event.stage);
        if (event.type === "done") {
          completed = true;
          await queryClient.invalidateQueries({
            queryKey: ["study-materials", notebookId],
          });
        }
      }
      if (!completed) throw new Error(t("audioOverview.regenerateError"));
    } catch (cause) {
      if (cancelled.current) return;
      setError(
        cause instanceof Error
          ? cause.message
          : t("audioOverview.regenerateError"),
      );
    } finally {
      setRequest(null);
    }
  };

  const cancel = () => {
    if (!request) return;
    cancelled.current = true;
    request.abort();
    void cancelGeneration(notebookId, request.id).catch(() => {});
    setRequest(null);
  };

  return (
    <article className="mx-auto w-full max-w-3xl space-y-5">
      <h2 className="text-xl font-semibold text-text-primary">
        {content.title}
      </h2>
      <audio
        controls
        preload="none"
        className="w-full"
        src={getApiUrl(
          `/api/study-materials/${materialId}/audio?v=${encodeURIComponent(audioVersion ?? "")}`,
        )}
        onError={() => setFailed(true)}
        onCanPlay={() => setFailed(false)}
        aria-label={t("audioOverview.playerLabel", { title: content.title })}
      />
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {t("audioOverview.playbackError")}
        </p>
      )}
      {sections?.length ? (
        <section aria-labelledby="audio-overview-outline" className="space-y-2">
          <h3 id="audio-overview-outline" className="text-base font-semibold">
            {t("audioOverview.outline")}
          </h3>
          <ol className="list-inside list-decimal space-y-1 text-sm text-text-secondary">
            {sections.map((section, index) => (
              <li key={`${section.heading}-${index}`}>{section.heading}</li>
            ))}
          </ol>
        </section>
      ) : null}
      <section
        aria-labelledby="audio-overview-transcript"
        className="space-y-3"
      >
        <h3 id="audio-overview-transcript" className="text-base font-semibold">
          {t("audioOverview.transcript")}
        </h3>
        {sections?.length ? (
          sections.map((section, index) => (
            <section
              key={`${section.heading}-${index}`}
              className="space-y-1.5"
            >
              <h4 className="font-medium text-text-primary">
                {section.heading}
              </h4>
              <p className="whitespace-pre-wrap text-sm leading-7 text-text-secondary">
                {section.text}
              </p>
            </section>
          ))
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-7 text-text-secondary">
            {content.transcript}
          </p>
        )}
      </section>
      <div className="space-y-3 border-t border-surface-border pt-4">
        {!open ? (
          <Button type="button" variant="outline" onClick={() => setOpen(true)}>
            {t("audioOverview.regenerate")}
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="regenerate-audio-brief">
                {t("audioOverview.briefLabel")}
              </Label>
              <Textarea
                id="regenerate-audio-brief"
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                disabled={!!request}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["format", "length", "audience"] as const).map((field) => {
                const values =
                  field === "format"
                    ? ["briefing", "deep_dive"]
                    : field === "length"
                      ? ["short", "standard", "extended"]
                      : ["new_to_topic", "some_background", "advanced"];
                const value =
                  field === "format"
                    ? format
                    : field === "length"
                      ? length
                      : audience;
                const set =
                  field === "format"
                    ? setFormat
                    : field === "length"
                      ? setLength
                      : setAudience;
                return (
                  <div key={field} className="space-y-1">
                    <Label htmlFor={`regenerate-${field}`}>
                      {t(`audioOverview.${field}.label`)}
                    </Label>
                    <select
                      id={`regenerate-${field}`}
                      className="h-10 w-full rounded-md border border-surface-border bg-surface-1 px-3 text-sm"
                      value={value}
                      onChange={(event) => set(event.target.value as never)}
                      disabled={!!request}
                    >
                      {values.map((option) => (
                        <option key={option} value={option}>
                          {t(`audioOverview.${field}.${option}` as never)}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
            {length && (
              <p className="text-xs text-text-secondary">
                {t("audioOverview.length.estimate")}
              </p>
            )}
            {request ? (
              <>
                <p role="status" className="text-sm text-text-secondary">
                  {t(`audioOverview.${stage}`)}
                </p>
                <Button type="button" variant="outline" onClick={cancel}>
                  {t("audioOverview.cancel")}
                </Button>
              </>
            ) : (
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => void regenerate()}
                  disabled={!sourceIds.length}
                >
                  {t("audioOverview.regenerate")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    setError("");
                  }}
                >
                  {t("audioOverview.dismiss")}
                </Button>
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function readAudioGenerationOptions(options: unknown): AudioGenerationOptions {
  if (!options || typeof options !== "object") return {};
  return options as AudioGenerationOptions;
}
