import type {
  Source,
  SourceModality,
  SourceProcessingStage,
  SourceProcessingStatus,
} from "../types";

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

export function sourceProcessingError(source: Source): string | undefined {
  return (
    source.processingErrorMessage ??
    source.processingError?.message ??
    source.errorMessage ??
    undefined
  );
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
  if (status === "pending") return "Queued for processing";
  if (status === "ready") return "Ready";
  if (status === "failed") return "Processing failed";
  if (status === "cancelled") return "Cancelled";

  switch (stage) {
    case "uploading":
      return "Uploading original…";
    case "extracting":
      return "Extracting content…";
    case "transcribing":
      return modality === "video" ? "Transcribing video…" : "Transcribing audio…";
    case "analyzing_visuals":
      return "Analyzing visuals…";
    case "indexing":
      return "Indexing source…";
    default:
      return "Processing source…";
  }
}
