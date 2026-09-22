import { describe, expect, it } from "vitest";
import type { Source } from "../types";
import {
  isSourceDegraded,
  isSourceProcessing,
  processingStageLabel,
  sourceProcessingError,
  sourceProcessingStatus,
  sourceQualityCorrectiveAction,
  sourceQualityReason,
  sourceQualityReasonLabel,
} from "./source-processing";

const source = (overrides: Partial<Source> = {}): Source => ({
  id: "source-1",
  notebookId: "notebook-1",
  kind: "text",
  title: "Lecture notes",
  url: null,
  contentType: "text/plain",
  fileSize: null,
  createdAt: "2026-08-30T00:00:00.000Z",
  ...overrides,
});

describe("source processing state", () => {
  it("treats legacy responses without processing fields as ready", () => {
    expect(sourceProcessingStatus(source())).toBe("ready");
    expect(isSourceProcessing(source())).toBe(false);
  });

  it("polls active pending and processing sources, but not terminal states", () => {
    expect(isSourceProcessing(source({ processingStatus: "pending" }))).toBe(true);
    expect(isSourceProcessing(source({ processingStatus: "processing" }))).toBe(true);
    expect(isSourceProcessing(source({ processingStatus: "failed" }))).toBe(false);
    expect(isSourceProcessing(source({ processingStatus: "cancelled" }))).toBe(false);
  });

  it("uses the server stage for honest user-facing copy", () => {
    expect(processingStageLabel("processing", "extracting")).toBe("Extracting content…");
    expect(processingStageLabel("processing", "analyzing_visuals")).toBe("Analyzing visuals…");
    expect(processingStageLabel("processing", "transcribing")).toBe("Transcribing audio…");
    expect(processingStageLabel("processing", "transcribing", "video")).toBe("Transcribing video…");
    expect(processingStageLabel("processing", "indexing")).toBe("Indexing source…");
    expect(processingStageLabel("pending")).toBe("Queued for processing");
  });

  it("supports both current and compatibility error fields", () => {
    expect(sourceProcessingError(source({ processingErrorMessage: "Could not parse PDF" }))).toBe(
      "Could not parse PDF",
    );
    expect(sourceProcessingError(source({ errorMessage: "Old error" }))).toBe("Old error");
  });

  it("labels a degraded source and explains the reason and the corrective action", () => {
    const degraded = source({
      processingStatus: "degraded",
      processingErrorCode: "quality_navigation",
      processingErrorMessage: "errors.sources.quality.navigation",
    });

    expect(sourceProcessingStatus(degraded)).toBe("degraded");
    expect(isSourceDegraded(degraded)).toBe(true);
    expect(isSourceProcessing(degraded)).toBe(false);
    expect(processingStageLabel("degraded")).toBe("Degraded");
    expect(sourceQualityReason(degraded)).toBe("navigation");
    expect(sourceQualityReasonLabel(degraded)).toMatch(/table of contents/i);
    expect(sourceQualityCorrectiveAction(degraded)).toMatch(/paste the text/i);
  });

  it("falls back to a generic corrective action for an unknown degraded reason", () => {
    const degraded = source({ processingStatus: "degraded" });

    expect(sourceQualityReason(degraded)).toBeNull();
    expect(sourceQualityReasonLabel(degraded)).toBeUndefined();
    expect(sourceQualityCorrectiveAction(degraded)).toMatch(/paste the text/i);
    expect(sourceQualityCorrectiveAction(source())).toBeUndefined();
  });
});
