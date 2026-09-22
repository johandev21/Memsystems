import { AlertTriangle, File, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { SourceWithContent } from "../../types";
import {
  isSourceDegraded,
  isSourceProcessing,
  processingStageLabel,
  sourceProcessingError,
  sourceProcessingStatus,
  sourceQualityCorrectiveAction,
  sourceQualityReason,
} from "../../utils/source-processing";

export function SourceProcessingState({
  source,
  onClose,
}: {
  source: SourceWithContent;
  onClose: () => void;
}) {
  const { t } = useTranslation("sources");
  const status = sourceProcessingStatus(source);
  const active = isSourceProcessing(source);
  const error = sourceProcessingError(source);

  if (isSourceDegraded(source)) {
    const reason = sourceQualityReason(source);
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-warning/10 text-warning">
          <AlertTriangle className="size-6" />
        </div>
        <h2 className="text-lg font-bold">{t("quality.degradedTitle")}</h2>
        <p className="max-w-sm text-xs text-muted-foreground">
          {reason ? t(`quality.reason.${reason}`) : t("quality.reason.unknown")}
        </p>
        <p className="max-w-sm text-xs font-medium text-foreground">
          {sourceQualityCorrectiveAction(source) ?? t("quality.action.default")}
        </p>
        <Button variant="outline" size="sm" onClick={onClose} className="mt-2 cursor-pointer text-xs">
          {t("states.backToSources")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        {active ? <Loader2 className="size-6 animate-spin" /> : <File className="size-6" />}
      </div>
      <h2 className="text-lg font-bold">
        {active
          ? processingStageLabel(status, source.processingStage)
          : processingStageLabel(status)}
      </h2>
      <p className="max-w-sm text-xs text-muted-foreground">
        {active
          ? t("reader.processingWillBeAvailable")
          : error || t("reader.notAvailable")}
      </p>
      <Button variant="outline" size="sm" onClick={onClose} className="mt-2 cursor-pointer text-xs">
        {t("states.backToSources")}
      </Button>
    </div>
  );
}

export function SourceReaderError({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("sources");
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
        <File className="size-6" />
      </div>
      <h2 className="text-lg font-bold">{t("reader.failedToLoad")}</h2>
      <p className="max-w-xs text-xs text-muted-foreground">
        {t("reader.loadFailedDescription")}
      </p>
      <Button variant="outline" size="sm" onClick={onClose} className="mt-2 cursor-pointer text-xs">
        {t("states.backToSources")}
      </Button>
    </div>
  );
}
