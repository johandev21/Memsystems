import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils/cn";
import { formatDisplayTitle } from "@/shared/utils/format-title";
import { downloadSlidesPptx } from "../api/study-materials";
import type { SlidesContentType } from "../shapes/slides";

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
      detail: { prompt: promptText, autoSend: true },
    }),
  );
}

export function SlidesView({ materialId, materialTitle, content }: SlidesViewProps) {
  const slides = useMemo(() => content.slides ?? [], [content.slides]);
  const previewById = useMemo(() => {
    const map = new Map<string, string>();
    for (const preview of content.previews ?? []) {
      map.set(preview.slideId, preview.svg);
    }
    return map;
  }, [content.previews]);

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
      if (event.key === "ArrowRight") goTo(clampedIndex + 1);
      if (event.key === "ArrowLeft") goTo(clampedIndex - 1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clampedIndex, goTo]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadSlidesPptx(materialId, materialTitle || "slides");
      toast.success("PowerPoint exported");
    } catch {
      toast.error("Export failed");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleStudyInChat = () => {
    if (!activeSlide) return;
    const bullets = (activeSlide.bullets ?? []).map((b, i) => `${i + 1}. ${b}`).join("\n");
    dispatchChatPrompt(
      `I'm studying slide ${clampedIndex + 1} ("${activeSlide.title}") from my deck "${formatDisplayTitle(materialTitle)}".\n\nSubtitle: ${activeSlide.subtitle || "N/A"}\n${bullets ? `Key points:\n${bullets}\n` : ""}${activeSlide.body ? `Body: ${activeSlide.body}\n` : ""}\nPlease act as my tutor for this slide: summarize it clearly, then ask me one check-in question.`,
    );
  };

  if (slides.length === 0) {
    return <div className="p-8 text-center text-text-tertiary">No slides in this deck yet.</div>;
  }

  const activePreview = activeSlide ? previewById.get(activeSlide.id) : undefined;

  return (
    <div className="flex w-full max-w-4xl mx-auto flex-col gap-4 animate-in fade-in duration-300 pb-20 select-none px-3 sm:px-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-text-tertiary">
          Slide {clampedIndex + 1} / {slides.length}
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
          Export .pptx
        </Button>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-surface-border-subtle bg-black">
        {activePreview ? (
          <img
            key={activeSlide.id}
            src={svgToDataUrl(activePreview)}
            alt={`Preview of slide ${clampedIndex + 1}: ${activeSlide.title}`}
            className="block h-auto w-full aspect-video object-contain bg-black"
            draggable={false}
          />
        ) : (
          <div className="flex aspect-video w-full flex-col justify-center gap-2 p-8">
            <p className="text-lg font-bold text-text-primary">
              {formatDisplayTitle(activeSlide.title)}
            </p>
            {(activeSlide.bullets ?? []).map((bullet) => (
              <p key={bullet} className="text-sm text-text-secondary">
                • {bullet}
              </p>
            ))}
          </div>
        )}
        <div className="absolute inset-y-0 left-0 flex items-center pl-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => goTo(clampedIndex - 1)}
            aria-label="Previous slide"
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
            aria-label="Next slide"
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
              aria-label={`Go to slide ${index + 1}`}
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

      {activeSlide?.notes && (
        <p className="text-xs leading-relaxed text-text-faint">
          Speaker notes: {activeSlide.notes}
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
          Study this slide in chat
        </Button>
      </div>
    </div>
  );
}

export default SlidesView;
