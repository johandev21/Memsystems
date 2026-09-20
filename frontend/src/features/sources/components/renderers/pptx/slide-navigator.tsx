import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/cn";

export interface SlideNavigatorProps {
  slideNumbers: number[];
  activeSlideNumber: number | null;
  selectedSlideNumber?: number | null;
  onSelect: (num: number) => void;
}

export function SlideNavigator({
  slideNumbers,
  activeSlideNumber,
  selectedSlideNumber,
  onSelect,
}: SlideNavigatorProps) {
  const { t } = useTranslation("sourceRenderers");
  return (
    <div className="hidden sm:flex w-20 shrink-0 flex-col border-r border-border/40 bg-muted/20 overflow-y-auto p-2 gap-1.5">
      <span className="text-xs font-semibold text-muted-foreground px-1 py-1">
        {t("pptxSlideNavigator.slides")}
      </span>
      {slideNumbers.map((num) => {
        const isActive = activeSlideNumber === num;
        const isCitationTarget = selectedSlideNumber === num;
        return (
          <button
            key={num}
            type="button"
            data-testid="slide-nav-item"
            data-active={isActive ? "true" : undefined}
            onClick={() => onSelect(num)}
            className={cn(
              "flex h-12 w-full items-center justify-center rounded-lg border text-xs font-semibold transition-colors cursor-pointer",
              isActive || isCitationTarget
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border/60 bg-card hover:bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {num}
          </button>
        );
      })}
    </div>
  );
}

export interface MobileSlideNavigatorProps {
  slideNumbers: number[];
  activeSlideNumber: number | null;
  onSelect: (num: number) => void;
}

export function MobileSlideNavigator({
  slideNumbers,
  activeSlideNumber,
  onSelect,
}: MobileSlideNavigatorProps) {
  return (
    <div className="flex sm:hidden gap-1.5 overflow-x-auto pb-2">
      {slideNumbers.map((num) => (
        <button
          key={num}
          type="button"
          data-testid="slide-nav-item-mobile"
          onClick={() => onSelect(num)}
          className={cn(
            "h-8 min-w-8 rounded-lg border px-3 text-xs font-semibold shrink-0 cursor-pointer",
            activeSlideNumber === num
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border/60 bg-card text-muted-foreground",
          )}
        >
          {num}
        </button>
      ))}
    </div>
  );
}
