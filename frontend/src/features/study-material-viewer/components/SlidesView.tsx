import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils/cn";
import { formatDisplayTitle } from "../utils/format-title";
import { downloadSlidesPptx } from "../api/study-materials";
import type { SlideElementType, SlidesContentType, SlidesSlideType } from "../shapes/slides";

export interface SlidesViewProps {
  materialId: string;
  materialTitle: string;
  content: SlidesContentType;
}

const SEND_CHAT_PROMPT_EVENT = "send-chat-prompt";

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function dispatchChatPrompt(promptText: string): void {
  window.dispatchEvent(
    new CustomEvent(SEND_CHAT_PROMPT_EVENT, {
      detail: { prompt: promptText, autoSend: false, focusChat: true },
    }),
  );
}

function elementText(element: SlideElementType): string[] {
  switch (element.type) {
    case "text":
      return element.text ? [element.text] : [];
    case "bullet-list":
      return element.items ?? [];
    case "card-group":
      return (element.cards ?? []).flatMap((card) =>
        card.body ? [`${card.title}: ${card.body}`] : [card.title],
      );
    case "comparison": {
      const lines: string[] = [];
      if (element.left) {
        lines.push(`${element.left.heading}:`);
        lines.push(...element.left.points.map((point) => `- ${point}`));
      }
      if (element.right) {
        lines.push(`${element.right.heading}:`);
        lines.push(...element.right.points.map((point) => `- ${point}`));
      }
      return lines;
    }
    case "timeline":
    case "process":
      return (element.steps ?? []).map((step) =>
        step.body ? `${step.title}: ${step.body}` : step.title,
      );
    case "statistic": {
      const lines = [`${element.value ?? ""} — ${element.label ?? ""}`];
      if (element.context) lines.push(element.context);
      return lines;
    }
    case "quote":
      return element.quote
        ? [`"${element.quote}"${element.attribution ? ` — ${element.attribution}` : ""}`]
        : [];
    case "shape":
      return [];
    default:
      return [];
  }
}

function slideBodyLines(slide: SlidesSlideType): string[] {
  const lines: string[] = [];
  for (const bullet of slide.bullets ?? []) lines.push(`• ${bullet}`);
  if (slide.body) lines.push(slide.body);
  for (const element of slide.elements ?? []) lines.push(...elementText(element));
  return lines;
}

export function SlidesView({ materialId, materialTitle, content }: SlidesViewProps) {
  const { t } = useTranslation("viewer");
  const slides = useMemo(() => content.slides ?? [], [content.slides]);
  const previewById = useMemo(() => {
    const map = new Map<string, string>();
    for (const preview of content.previews ?? []) {
      map.set(preview.slideId, preview.svg);
    }
    return map;
  }, [content.previews]);

  const designPreset = content.design?.preset;
  const designRole = useCallback(
    (slide: SlidesSlideType): string => slide.role ?? slide.layout ?? "content",
    [],
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const clampedIndex = slides.length === 0 ? 0 : Math.min(activeIndex, slides.length - 1);
  const activeSlide = slides[clampedIndex];

  const goTo = useCallback(
    (index: number) => {
      if (slides.length === 0) return;
      setActiveIndex((index + slides.length) % slides.length);
    },
    [slides.length],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (slides.length === 0) return;
      if (event.key === "ArrowRight") {
        setActiveIndex((prev) => (prev + 1) % slides.length);
      } else if (event.key === "ArrowLeft") {
        setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [slides.length]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadSlidesPptx(materialId, materialTitle || "slides");
      toast.success(t("slides.exportedToast"));
    } catch {
      toast.error(t("slides.exportFailedToast"));
    } finally {
      setIsDownloading(false);
    }
  };

  const handleStudyInChat = () => {
    if (!activeSlide) return;
    const role = designRole(activeSlide);
    const lines = slideBodyLines(activeSlide);
    const bullets = (activeSlide.bullets ?? []).map((b, i) => `${i + 1}. ${b}`).join("\n");
    const keyPoints = bullets ? `${t("slides.prompt.keyPoints", { points: bullets })}\n` : "";
    const body = activeSlide.body ? `${t("slides.prompt.body", { body: activeSlide.body })}\n` : "";
    const contentBlock =
      lines.length > 0
        ? `${t("slides.prompt.content", { lines: lines.slice(0, 12).join("\n") })}\n`
        : "";
    dispatchChatPrompt(
      t("slides.prompt.study", {
        number: clampedIndex + 1,
        title: activeSlide.title,
        role,
        deck: formatDisplayTitle(materialTitle),
        subtitle: activeSlide.subtitle || t("slides.prompt.notAvailable"),
        keyPoints,
        body,
        content: contentBlock,
      }),
    );
  };

  if (slides.length === 0) {
    return <div className="p-8 text-center text-text-tertiary">{t("slides.empty")}</div>;
  }

  const activePreview = activeSlide ? previewById.get(activeSlide.id) : undefined;

  return (
    <div className="flex w-full max-w-4xl mx-auto flex-col gap-4 animate-in fade-in duration-300 pb-20 select-none px-3 sm:px-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-medium text-text-tertiary">
          {t("slides.position", { current: clampedIndex + 1, total: slides.length })}
          {designPreset && (
            <span
              aria-label={t("slides.deckDesign", { preset: designPreset })}
              className="rounded-full border border-surface-border-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-secondary"
            >
              {designPreset}
            </span>
          )}
          {activeSlide && (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-text-tertiary">
              {designRole(activeSlide)}
            </span>
          )}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={isDownloading}
          className="h-8 rounded-xl text-xs font-medium cursor-pointer"
        >
          {isDownloading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Download className="size-3.5" />
          )}
          {t("slides.exportPptx")}
        </Button>
      </div>
      <div className="relative overflow-hidden rounded-2xl border border-surface-border-subtle bg-black">
        {activePreview ? (
          <img
            key={activeSlide.id}
            src={svgToDataUrl(activePreview)}
            alt={t("slides.previewAlt", { number: clampedIndex + 1, title: activeSlide.title })}
            className="block h-auto w-full aspect-video object-contain bg-black"
            draggable={false}
          />
        ) : (
          <div
            role="img"
            aria-label={t("slides.unavailableAlt", {
              number: clampedIndex + 1,
              title: activeSlide.title,
            })}
            className="flex aspect-video w-full flex-col justify-center gap-2 p-8"
          >
            <p className="text-lg font-bold text-text-primary">
              {formatDisplayTitle(activeSlide.title)}
            </p>
            {activeSlide.subtitle && (
              <p className="text-sm text-text-secondary">{activeSlide.subtitle}</p>
            )}
            {slideBodyLines(activeSlide)
              .slice(0, 6)
              .map((line) => (
                <p key={line} className="text-sm text-text-secondary">
                  {line}
                </p>
              ))}
            <p className="text-xs text-text-faint">{t("slides.previewUnavailable")}</p>
          </div>
        )}
        <div className="absolute inset-y-0 left-0 flex items-center pl-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => goTo(clampedIndex - 1)}
            aria-label={t("slides.previous")}
            className="h-9 w-9 rounded-full bg-black/50 text-white hover:bg-black/70 cursor-pointer"
          >
            <ChevronLeft className="size-5" />
          </Button>
        </div>
        <div className="absolute inset-y-0 right-0 flex items-center pr-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => goTo(clampedIndex + 1)}
            aria-label={t("slides.next")}
            className="h-9 w-9 rounded-full bg-black/50 text-white hover:bg-black/70 cursor-pointer"
          >
            <ChevronRight className="size-5" />
          </Button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {slides.map((slide, index) => {
          const preview = previewById.get(slide.id);
          const selected = index === clampedIndex;
          return (
            <button
              key={slide.id}
              type="button"
              onClick={() => goTo(index)}
              aria-label={t("slides.goToSlide", { number: index + 1 })}
              aria-current={selected}
              className={cn(
                "shrink-0 w-28 overflow-hidden rounded-xl border transition-all cursor-pointer",
                selected
                  ? "border-primary ring-1 ring-primary"
                  : "border-surface-border-subtle opacity-70 hover:opacity-100",
              )}
            >
              {preview ? (
                <img
                  src={svgToDataUrl(preview)}
                  alt=""
                  className="w-full aspect-video object-contain bg-black/60"
                  draggable={false}
                />
              ) : (
                <span className="flex aspect-video w-full items-center justify-center p-1 text-[10px] text-text-tertiary">
                  {formatDisplayTitle(slide.title)}
                </span>
              )}
              <span className="block truncate px-1.5 py-1 text-[10px] font-medium text-text-secondary">
                {index + 1}. {formatDisplayTitle(slide.title)}
              </span>
            </button>
          );
        })}
      </div>

      {(activeSlide?.notes || activeSlide?.speakerNotes) && (
        <p className="text-xs leading-relaxed text-text-faint">
          {t("slides.speakerNotes", {
            notes: activeSlide.speakerNotes ?? activeSlide.notes ?? "",
          })}
        </p>
      )}

      <div className="flex justify-center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleStudyInChat}
          className="h-8 rounded-xl text-xs font-medium cursor-pointer"
        >
          {t("slides.studyInChat")}
        </Button>
      </div>
    </div>
  );
}

export default SlidesView;
