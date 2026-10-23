import { AlertCircle, AlertTriangle, Loader2, MoreVertical } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Source } from "../../api/sources";
import { sourceDisplayTitle } from "../../utils/source-display-title";
import {
  isSourceDegraded,
  isSourceProcessing,
  processingStageLabel,
  sourceProcessingError,
  sourceProcessingStatus,
  sourceQualityCorrectiveAction,
  sourceQualityReasonLabel,
} from "../../utils/source-processing";
import { SourceIcon } from "../sources-list/source-icon";
import { MobileTileActionsButton, MOBILE_TILE_CLASS } from "./mobile-tile-parts";

export interface MobileSourceTileProps {
  source: Source;
  onOpen: () => void;
  onActions: () => void;
}

export function MobileSourceTile({ source, onOpen, onActions }: MobileSourceTileProps) {
  const { t } = useTranslation("sources");
  const status = sourceProcessingStatus(source);
  const statusLine = getStatusLine(source);

  return (
    <div role="listitem" data-slot="mobile-source-tile" className={MOBILE_TILE_CLASS}>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-3 py-2 pl-3 text-left touch-manipulation"
      >
        <SourceStatusIcon source={source} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="line-clamp-2 text-sm leading-snug text-foreground">{sourceDisplayTitle(source)}</span>
          {statusLine && (
            <span
              className={
                status === "failed"
                  ? "truncate text-xs text-destructive"
                  : "truncate text-xs text-muted-foreground"
              }
            >
              {statusLine}
            </span>
          )}
        </span>
      </button>
      <MobileTileActionsButton
        label={t("sourceRow.moreActions", "Source actions")}
        icon={MoreVertical}
        onClick={onActions}
      />
    </div>
  );
}

function SourceStatusIcon({ source }: { source: Source }) {
  const status = sourceProcessingStatus(source);

  if (isSourceProcessing(source)) {
    return <Loader2 className="size-5 shrink-0 animate-spin text-primary" />;
  }
  if (status === "failed") {
    return <AlertCircle className="size-5 shrink-0 text-destructive" strokeWidth={1.7} />;
  }
  if (isSourceDegraded(source)) {
    return <AlertTriangle className="size-5 shrink-0 text-warning" strokeWidth={1.7} />;
  }
  return <SourceIcon source={source} className="size-5 shrink-0" />;
}

function getStatusLine(source: Source): string | undefined {
  const status = sourceProcessingStatus(source);
  const label = processingStageLabel(status, source.processingStage, source.modality);

  if (isSourceDegraded(source)) {
    return [sourceQualityReasonLabel(source) ?? label, sourceQualityCorrectiveAction(source)]
      .filter(Boolean)
      .join(" · ");
  }
  if (status === "failed") return sourceProcessingError(source) ?? label;
  return status === "ready" ? undefined : label;
}
