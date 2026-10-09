import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/cn";

export interface AssistantVersionControlsProps {
  activeIndex: number;
  totalVersions: number;
  onPrevious: () => void;
  onNext: () => void;
  className?: string;
}

export function AssistantVersionControls({
  activeIndex,
  totalVersions,
  onPrevious,
  onNext,
  className,
}: AssistantVersionControlsProps) {
  const { t } = useTranslation("chat");

  if (totalVersions <= 1) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-xs text-text-faint select-none",
        className,
      )}
    >
      <button
        type="button"
        disabled={activeIndex === 0}
        onClick={onPrevious}
        className="flex min-h-11 min-w-11 sm:min-h-8 sm:min-w-8 sm:size-6 items-center justify-center rounded-md transition-colors hover:bg-surface-2 hover:text-text-primary disabled:pointer-events-none disabled:opacity-30 cursor-pointer active:scale-97 touch-manipulation"
        aria-label={t("assistant.previousVersion")}
      >
        <ChevronLeftIcon className="size-3.5" />
      </button>
      <span className="min-w-13 text-center text-xs font-medium">
        {t("assistant.branchPage", {
          current: activeIndex + 1,
          total: totalVersions,
        })}
      </span>
      <button
        type="button"
        disabled={activeIndex === totalVersions - 1}
        onClick={onNext}
        className="flex min-h-11 min-w-11 sm:min-h-8 sm:min-w-8 sm:size-6 items-center justify-center rounded-md transition-colors hover:bg-surface-2 hover:text-text-primary disabled:pointer-events-none disabled:opacity-30 cursor-pointer active:scale-97 touch-manipulation"
        aria-label={t("assistant.nextVersion")}
      >
        <ChevronRightIcon className="size-3.5" />
      </button>
    </div>
  );
}
