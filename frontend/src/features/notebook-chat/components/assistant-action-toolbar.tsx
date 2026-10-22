import { CheckIcon, CopyIcon, PlayIcon, RotateCcwIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/shared/utils/cn";
import { AssistantVersionControls } from "./assistant-version-controls";

export interface AssistantActionToolbarProps {
  totalVersions: number;
  activeIndex: number;
  hasMultipleVersions?: boolean;
  onPreviousVersion: () => void;
  onNextVersion: () => void;
  onCopy: () => void;
  onRegenerate: () => void;
  showRegenerate?: boolean;
  onContinue?: () => void;
  showContinue?: boolean;
  isStreaming?: boolean;
  copied?: boolean;
  className?: string;
  versionsDisabled?: boolean;
}

export function AssistantActionToolbar({
  totalVersions,
  activeIndex,
  hasMultipleVersions = totalVersions > 1,
  onPreviousVersion,
  onNextVersion,
  onCopy,
  onRegenerate,
  showRegenerate = true,
  onContinue,
  showContinue = false,
  isStreaming = false,
  copied = false,
  className,
  versionsDisabled = false,
}: AssistantActionToolbarProps) {
  const { t } = useTranslation("chat");

  return (
    <div
      className={cn(
        "mt-2 flex w-fit max-w-full flex-wrap items-center justify-start gap-x-2 gap-y-1 text-text-tertiary",
        className,
      )}
    >
      {hasMultipleVersions && (
        <AssistantVersionControls
          activeIndex={activeIndex}
          totalVersions={totalVersions}
          onPrevious={onPreviousVersion}
          onNext={onNextVersion}
          disabled={versionsDisabled}
        />
      )}

      <div className="flex flex-wrap items-center gap-1">
        {showContinue && (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  disabled={isStreaming}
                  onClick={onContinue}
                  className="flex min-h-11 min-w-11 sm:min-h-8 sm:min-w-8 sm:size-7 items-center justify-center rounded-lg transition-colors hover:bg-surface-2 hover:text-text-primary disabled:opacity-40 cursor-pointer active:scale-97 touch-manipulation"
                  aria-label={t("actions.continue")}
                >
                  <PlayIcon className="size-3.5" />
                </button>
              }
            />
            <TooltipContent>{t("actions.continue")}</TooltipContent>
          </Tooltip>
        )}

        {showRegenerate && (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  disabled={isStreaming}
                  onClick={onRegenerate}
                  className="flex min-h-11 min-w-11 sm:min-h-8 sm:min-w-8 sm:size-7 items-center justify-center rounded-lg transition-colors hover:bg-surface-2 hover:text-text-primary disabled:opacity-40 cursor-pointer active:scale-97 touch-manipulation"
                  aria-label={t("assistant.regenerateResponse")}
                >
                  <RotateCcwIcon
                    className={cn("size-3.5", isStreaming && "animate-spin")}
                  />
                </button>
              }
            />
            <TooltipContent>{t("assistant.regenerateResponse")}</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={onCopy}
                className="flex min-h-11 min-w-11 sm:min-h-8 sm:min-w-8 sm:size-7 items-center justify-center rounded-lg transition-colors hover:bg-surface-2 hover:text-text-primary cursor-pointer active:scale-97 touch-manipulation"
                aria-label={t("assistant.copyMessage")}
              >
                {copied ? (
                  <CheckIcon className="size-3.5 text-primary" />
                ) : (
                  <CopyIcon className="size-3.5" />
                )}
              </button>
            }
          />
          <TooltipContent>
            {copied ? t("assistant.copied") : t("assistant.copyMessage")}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
