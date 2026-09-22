import i18n from "@/shared/i18n";
import type {
  Source,
  SourceModality,
  SourceProcessingStage,
  SourceProcessingStatus,
  SourceQualityReason,
} from "../types";

type DynamicTranslate = (
  key: string,
  options?: Record<string, string | number>,
) => string;

const translateDynamic = i18n.t as unknown as DynamicTranslate;

export const SOURCE_POLL_INTERVAL_MS = 1_500;

export function sourceProcessingStatus(source: Source): SourceProcessingStatus {
  // Older API responses have no processing fields because those sources are
  // already synchronously extracted and indexed.
  return source.processingStatus ?? "ready";
}

export function isSourceProcessing(source: Source): boolean {
  const status = sourceProcessingStatus(source);
  return status === "pending" || status === "processing";
}

export function isSourceDegraded(source: Source): boolean {
  return sourceProcessingStatus(source) === "degraded";
}

/** Maps the persisted `quality_<reason>` error code to its reason. */
export function sourceQualityReason(source: Source): SourceQualityReason | null {
  const code = sourceProcessingErrorCode(source);
  switch (code) {
    case "quality_navigation":
      return "navigation";
    case "quality_boilerplate":
      return "boilerplate";
    case "quality_paywall":
      return "paywall";
    default:
      return null;
  }
}

export function sourceQualityReasonLabel(source: Source): string | undefined {
  const reason = sourceQualityReason(source);
  if (!reason) return undefined;
  return i18n.t(`quality.reason.${reason}`, { ns: "sources" });
}

export function sourceQualityCorrectiveAction(
  source: Source,
): string | undefined {
  if (!isSourceDegraded(source)) return undefined;
  const reason = sourceQualityReason(source);
  return i18n.t(
    reason ? `quality.action.${reason}` : "quality.action.default",
    { ns: "sources" },
  );
}

export function sourceProcessingError(source: Source): string | undefined {
  const raw =
    source.processingErrorMessage ??
    source.processingError?.message ??
    source.errorMessage ??
    undefined;
  if (!raw) return undefined;
  if (i18n.exists(raw)) return translateDynamic(raw);
  return raw;
}

export function sourceProcessingErrorCode(source: Source): string | undefined {
  return (
    source.processingErrorCode ?? source.processingError?.code ?? source.errorCode ?? undefined
  );
}

export function processingStageLabel(
  status: SourceProcessingStatus,
  stage?: SourceProcessingStage | null,
  modality?: SourceModality | null,
): string {
  if (status === "pending")
    return i18n.t("processing.queued", { ns: "sources" });
  if (status === "ready") return i18n.t("processing.ready", { ns: "sources" });
  if (status === "degraded")
    return i18n.t("processing.degraded", { ns: "sources" });
  if (status === "failed") return i18n.t("processing.failed", { ns: "sources" });
  if (status === "cancelled") return i18n.t("processing.cancelled", { ns: "sources" });

  switch (stage) {
    case "uploading":
      return i18n.t("processing.uploading", { ns: "sources" });
    case "extracting":
      return i18n.t("processing.extracting", { ns: "sources" });
    case "transcribing":
      return modality === "video"
        ? i18n.t("processing.transcribingVideo", { ns: "sources" })
        : i18n.t("processing.transcribingAudio", { ns: "sources" });
    case "analyzing_visuals":
      return i18n.t("processing.analyzingVisuals", { ns: "sources" });
    case "indexing":
      return i18n.t("processing.indexing", { ns: "sources" });
    default:
      return i18n.t("processing.processing", { ns: "sources" });
  }
}
