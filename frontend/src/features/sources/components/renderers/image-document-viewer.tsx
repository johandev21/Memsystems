import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/shared/api";
import type {
  ImageDocumentViewerProps,
  ParsedImageSection,
  ViewMode,
} from "./image/image-types";
import {
  isMatchingRegion,
  normalizeSegmentKind,
  parseRawTextToSections,
} from "./image/image-helpers";
import { ImageViewerToolbar } from "./image/image-viewer-toolbar";
import { ImagePreviewPanel } from "./image/image-preview-panel";
import { ExtractedNotesPanel } from "./image/extracted-notes-panel";

export type { ImageDocumentViewerProps };

export function ImageDocumentViewer({ source, selectedLocator }: ImageDocumentViewerProps) {
  const { t } = useTranslation("sourceRenderers");
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [zoom, setZoom] = useState(1);
  const [showOverlays, setShowOverlays] = useState(true);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null);

  const notesContainerRef = useRef<HTMLDivElement>(null);
  const noteElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const imageViewportRef = useRef<HTMLDivElement>(null);

  // Fetch original image download URL
  const {
    data: downloadData,
    isLoading: isLoadingImage,
    isError: isImageError,
  } = useQuery({
    queryKey: ["source-download", source.id],
    queryFn: async () => {
      const response = await fetchApi(`/api/sources/${source.id}/download`);
      if (!response.ok) {
        if (source.url) return { url: source.url };
        throw new Error("Failed to load image file");
      }
      return (await response.json()) as { url: string; expiresIn?: number };
    },
    enabled: Boolean(source.id),
    staleTime: 5 * 60 * 1000,
  });

  const imageUrl = downloadData?.url || source.url || null;

  // Prepare normalized sections
  const sections = useMemo<ParsedImageSection[]>(() => {
    if (source.segments && source.segments.length > 0) {
      return source.segments.map((seg, idx) => ({
        id: seg.id || `seg-${idx}`,
        ordinal: seg.ordinal ?? idx + 1,
        kind: normalizeSegmentKind(seg.kind, seg.content),
        content: seg.content,
        locator: seg.locator,
        warning: (seg.metadata?.warning as string | undefined) || undefined,
      }));
    }

    return parseRawTextToSections(source.rawText || "");
  }, [source.segments, source.rawText]);

  // Handle selected locator from citations
  const [prevLocator, setPrevLocator] = useState<typeof selectedLocator>(undefined);
  if (prevLocator !== selectedLocator) {
    setPrevLocator(selectedLocator);
    if (selectedLocator?.imageRegion) {
      const matched = sections.find((sec) =>
        isMatchingRegion(sec.locator?.imageRegion, selectedLocator.imageRegion),
      );
      if (matched) setActiveSegmentId(matched.id);
    }
  }

  useEffect(() => {
    if (!selectedLocator?.imageRegion) return;

    const matched = sections.find((sec) =>
      isMatchingRegion(sec.locator?.imageRegion, selectedLocator.imageRegion),
    );
    if (matched) {
      const noteEl = noteElementsRef.current.get(matched.id);
      noteEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedLocator, sections]);

  const handleSelectSegment = useCallback((segmentId: string) => {
    setActiveSegmentId((prev) => (prev === segmentId ? null : segmentId));
    const noteEl = noteElementsRef.current.get(segmentId);
    noteEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const handleZoomIn = () => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)));
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)));
  const handleResetZoom = () => setZoom(1);

  const segmentsWithRegions = useMemo(
    () => sections.filter((s) => Boolean(s.locator?.imageRegion)),
    [sections],
  );

  const warningMessage =
    source.processingErrorMessage ||
    source.errorMessage ||
    sections.find((s) => s.warning)?.warning ||
    (source.rawText?.toLowerCase().includes("unreadable")
      ? t("imageViewer.partialTranscriptionWarning")
      : null);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
      <ImageViewerToolbar
        segmentsWithRegionsCount={segmentsWithRegions.length}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
        {(viewMode === "split" || viewMode === "image") && (
          <ImagePreviewPanel
            viewMode={viewMode}
            zoom={zoom}
            segmentsWithRegions={segmentsWithRegions}
            showOverlays={showOverlays}
            isLoadingImage={isLoadingImage}
            isImageError={isImageError}
            imageUrl={imageUrl}
            sourceTitle={source.title}
            activeSegmentId={activeSegmentId}
            hoveredSegmentId={hoveredSegmentId}
            selectedRegion={selectedLocator?.imageRegion}
            imageViewportRef={imageViewportRef}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetZoom={handleResetZoom}
            onToggleOverlays={() => setShowOverlays((v) => !v)}
            onSelectSegment={handleSelectSegment}
            onHoverSegment={(id) => setHoveredSegmentId(id)}
          />
        )}

        {(viewMode === "split" || viewMode === "notes") && (
          <ExtractedNotesPanel
            viewMode={viewMode}
            warningMessage={warningMessage}
            sections={sections}
            activeSegmentId={activeSegmentId}
            hoveredSegmentId={hoveredSegmentId}
            notesContainerRef={notesContainerRef}
            noteElementsRef={noteElementsRef}
            onSelectSegment={handleSelectSegment}
            onHoverSegment={(id) => setHoveredSegmentId(id)}
          />
        )}
      </div>
    </div>
  );
}
