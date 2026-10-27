import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/utils/cn";
import { formatDisplayTitle } from "../utils/format-title";
import type { SlidesContentType, SlidesSlideType } from "../shapes/slides";
import {
  buildSlidePreviews,
  slideBodyLines,
  svgToDataUrl,
} from "../utils/slides-preview";
import { useSlidesExport } from "../hooks/use-slides-export";

export interface SlidesViewProps {
  materialId: string;
  materialTitle: string;
  content: SlidesContentType;
}

const SEND_CHAT_PROMPT_EVENT = "send-chat-prompt";

function dispatchChatPrompt(promptText: string): void {
  window.dispatchEvent(
    new CustomEvent(SEND_CHAT_PROMPT_EVENT, {
      detail: { prompt: promptText, autoSend: false, focusChat: true },
    }),
  );
}

export function SlidesView({ materialId, materialTitle, content }: SlidesViewProps) {
  const { t } = useTranslation("viewer");
  const slides = useMemo(() => content.slides ?? [], [content.slides]);
  const previewById = useMemo(() => buildSlidePreviews(content), [content]);

  const designPreset = content.design?.preset;
  const designRole = useCallback(
    (slide: SlidesSlideType): string => slide.role ?? slide.layout ?? "content",
    [],
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const { isDownloading, downloadPptx } = useSlidesExport(materialId, materialTitle);
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
    <div className="flex w-full max-w-4xl mx-auto flex-col gap-4 animate-in fade-in duration-300 pb-safe pb-16 sm:pb-20 select-none px-2.5 sm:px-4">
      <SlidesHeaderBar
        clampedIndex={clampedIndex}
        totalSlides={slides.length}
        designPreset={designPreset}
        activeSlideRole={activeSlide ? designRole(activeSlide) : undefined}
        isDownloading={isDownloading}
        onDownload={downloadPptx}
      />
      <SlideStage
        activeSlide={activeSlide}
        activePreview={activePreview}
        clampedIndex={clampedIndex}
        onPrevious={() => goTo(clampedIndex - 1)}
        onNext={() => goTo(clampedIndex + 1)}
      />
      <SlideThumbnailStrip
        slides={slides}
        previewById={previewById}
        clampedIndex={clampedIndex}
        onSelectSlide={goTo}
      />
      {activeSlide && <SlideSpeakerNotes slide={activeSlide} />}
      <div className="flex justify-center pb-safe">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleStudyInChat}
          className="min-h-11 sm:min-h-8 sm:h-8 px-4 rounded-xl text-xs sm:text-sm font-medium cursor-pointer touch-manipulation active:scale-97 transition-transform"
        >
          {t("slides.studyInChat")}
        </Button>
      </div>
    </div>
  );
}

interface SlidesHeaderBarProps {
  clampedIndex: number;
  totalSlides: number;
  designPreset?: string;
  activeSlideRole?: string;
  isDownloading: boolean;
  onDownload: () => void;
}

function SlidesHeaderBar({
  clampedIndex,
  totalSlides,
  designPreset,
  activeSlideRole,
  isDownloading,
  onDownload,
}: SlidesHeaderBarProps) {
  const { t } = useTranslation("viewer");

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 sm:gap-2 text-xs font-medium text-text-tertiary">
        {t("slides.position", { current: clampedIndex + 1, total: totalSlides })}
        {designPreset && (
          <span
            aria-label={t("slides.deckDesign", { preset: designPreset })}
            className="rounded-full border border-surface-border-subtle px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-text-secondary"
          >
            {designPreset}
          </span>
        )}
        {activeSlideRole && (
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-text-tertiary">
            {activeSlideRole}
          </span>
        )}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onDownload}
        disabled={isDownloading}
        className="min-h-11 sm:min-h-8 sm:h-8 rounded-xl text-xs font-medium cursor-pointer touch-manipulation active:scale-97 transition-transform"
      >
        {isDownloading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Download className="size-3.5" />
        )}
        {t("slides.exportPptx")}
      </Button>
    </div>
  );
}

interface SlideStageProps {
  activeSlide: SlidesSlideType;
  activePreview?: string;
  clampedIndex: number;
  onPrevious: () => void;
  onNext: () => void;
}

function SlideStage({
  activeSlide,
  activePreview,
  clampedIndex,
  onPrevious,
  onNext,
}: SlideStageProps) {
  const { t } = useTranslation("viewer");

  return (
    <div className="relative overflow-hidden rounded-xl sm:rounded-2xl border border-surface-border-subtle bg-black w-full aspect-video flex items-center justify-center">
      {activePreview ? (
        <img
          key={activeSlide.id}
          src={svgToDataUrl(activePreview)}
          alt={t("slides.previewAlt", { number: clampedIndex + 1, title: activeSlide.title })}
          className="block h-full max-h-[70vh] w-full aspect-video object-contain bg-black"
          draggable={false}
        />
      ) : (
        <div
          role="img"
          aria-label={t("slides.unavailableAlt", {
            number: clampedIndex + 1,
            title: activeSlide.title,
          })}
          className="flex aspect-video w-full flex-col justify-center gap-2 p-4 sm:p-8 overflow-y-auto"
        >
          <p className="text-base sm:text-lg font-bold text-text-primary">
            {formatDisplayTitle(activeSlide.title)}
          </p>
          {activeSlide.subtitle && (
            <p className="text-xs sm:text-sm text-text-secondary">{activeSlide.subtitle}</p>
          )}
          {slideBodyLines(activeSlide)
            .slice(0, 6)
            .map((line) => (
              <p key={line} className="text-xs sm:text-sm text-text-secondary">
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
          onClick={onPrevious}
          aria-label={t("slides.previous")}
          className="min-h-11 min-w-11 sm:min-h-8 sm:min-w-8 sm:h-9 sm:w-9 rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer touch-manipulation active:scale-97 transition-transform"
        >
          <ChevronLeft className="size-5" />
        </Button>
      </div>
      <div className="absolute inset-y-0 right-0 flex items-center pr-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onNext}
          aria-label={t("slides.next")}
          className="min-h-11 min-w-11 sm:min-h-8 sm:min-w-8 sm:h-9 sm:w-9 rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer touch-manipulation active:scale-97 transition-transform"
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>
    </div>
  );
}

interface SlideThumbnailStripProps {
  slides: SlidesSlideType[];
  previewById: Map<string, string>;
  clampedIndex: number;
  onSelectSlide: (index: number) => void;
}

function SlideThumbnailStrip({
  slides,
  previewById,
  clampedIndex,
  onSelectSlide,
}: SlideThumbnailStripProps) {
  const { t } = useTranslation("viewer");

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 touch-pan-x overscroll-x-contain">
      {slides.map((slide, index) => {
        const preview = previewById.get(slide.id);
        const selected = index === clampedIndex;
        return (
          <button
            key={slide.id}
            type="button"
            onClick={() => onSelectSlide(index)}
            aria-label={t("slides.goToSlide", { number: index + 1 })}
            aria-current={selected}
            className={cn(
              "shrink-0 w-24 sm:w-28 overflow-hidden rounded-xl border transition-all cursor-pointer touch-manipulation active:scale-97",
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
              <span className="flex aspect-video w-full items-center justify-center p-1 text-xs text-text-tertiary">
                {formatDisplayTitle(slide.title)}
              </span>
            )}
            <span className="block truncate px-1.5 py-1 text-xs font-medium text-text-secondary">
              {index + 1}. {formatDisplayTitle(slide.title)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SlideSpeakerNotes({ slide }: { slide: SlidesSlideType }) {
  const { t } = useTranslation("viewer");
  const notes = slide.speakerNotes ?? slide.notes;
  if (!notes) return null;

  return (
    <div className="rounded-xl border border-surface-border-subtle bg-surface-2/60 p-3 sm:p-4 text-xs leading-relaxed text-text-secondary">
      <p className="whitespace-pre-wrap break-words">
        {t("slides.speakerNotes", { notes })}
      </p>
    </div>
  );
}

export default SlidesView;
