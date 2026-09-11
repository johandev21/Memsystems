import { AlertCircle, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface StudyMaterialsTreeErrorProps {
  message?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function StudyMaterialsTreeError({
  message,
  onRetry,
  isRetrying = false,
}: StudyMaterialsTreeErrorProps) {
  const { t } = useTranslation("tree");
  const resolvedMessage = message ?? t("errors.loadFailed");
  return (
    <div
      data-slot="study-materials-tree-error"
      className="flex flex-col items-center justify-center gap-3 p-6 text-center"
      role="alert"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
        <AlertCircle className="h-5 w-5 text-destructive" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{resolvedMessage}</p>
        <p className="text-xs text-muted-foreground">{t("errors.connection")}</p>
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={isRetrying}
          className="mt-1"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRetrying ? "animate-spin" : ""}`} />
          {isRetrying ? t("errors.retrying") : t("errors.retry")}
        </Button>
      )}
    </div>
  );
}
