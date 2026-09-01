import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Columns2,
  Eye,
  FileText,
  ImageIcon,
  Layers,
  Loader2,
  RotateCcw,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/ui/markdown";
import { fetchApi } from "@/shared/api";
import { cn } from "@/shared/utils/cn";
import type { ImageRegion, SourceSegmentLocator, SourceWithContent } from "../../types";

export interface ImageDocumentViewerProps {
  source: SourceWithContent;
  selectedLocator?: SourceSegmentLocator | null;
  scrollElement?: HTMLDivElement | null;
}

type ViewMode = "split" | "image" | "notes";

interface ParsedImageSection {
  id: string;
  ordinal: number;
  kind: "heading" | "text" | "formula" | "visual_description" | "warning";
  content: string;
  headingLevel?: number;
  locator?: SourceSegmentLocator;
  warning?: string;
}

export function ImageDocumentViewer({
  source,
  selectedLocator,
}: ImageDocumentViewerProps) {
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
  useEffect(() => {
    if (!selectedLocator?.imageRegion) return;

    const matched = sections.find((sec) =>
      isMatchingRegion(sec.locator?.imageRegion, selectedLocator.imageRegion),
    );

    if (matched) {
      setActiveSegmentId(matched.id);
      const noteEl = noteElementsRef.current.get(matched.id);
      noteEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedLocator, sections]);

  const handleSelectSegment = useCallback(
    (segmentId: string) => {
      setActiveSegmentId((prev) => (prev === segmentId ? null : segmentId));
      const noteEl = noteElementsRef.current.get(segmentId);
      noteEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    },
    [],
  );

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
      ? "Some content in this image could not be fully transcribed."
      : null);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
      {/* Top Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/60 bg-muted/20 px-3 py-2 text-xs">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
            <ImageIcon className="size-3 text-primary" />
            Image Document
          </Badge>
          {segmentsWithRegions.length > 0 && (
            <Badge variant="secondary" className="font-normal text-[11px]">
              {segmentsWithRegions.length} visual {segmentsWithRegions.length === 1 ? "region" : "regions"}
            </Badge>
          )}
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1">
          <div className="flex items-center rounded-lg border border-border/60 bg-background p-0.5">
            <Button
              type="button"
              variant={viewMode === "split" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("split")}
              className="h-6 px-2 text-xs font-medium cursor-pointer"
              title="Split View"
            >
              <Columns2 className="size-3 mr-1" />
              Split
            </Button>
            <Button
              type="button"
              variant={viewMode === "image" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("image")}
              className="h-6 px-2 text-xs font-medium cursor-pointer"
              title="Image Only"
            >
              <ImageIcon className="size-3 mr-1" />
              Image
            </Button>
            <Button
              type="button"
              variant={viewMode === "notes" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("notes")}
              className="h-6 px-2 text-xs font-medium cursor-pointer"
              title="Notes Only"
            >
              <FileText className="size-3 mr-1" />
              Notes
            </Button>
          </div>
        </div>
      </div>

      {/* Main Workspace Panels */}
      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
        {/* Left: Original Image Panel */}
        {(viewMode === "split" || viewMode === "image") && (
          <div
            className={cn(
              "flex flex-col border-r border-border/60 bg-muted/10 relative overflow-hidden",
              viewMode === "split" ? "w-full lg:w-1/2" : "w-full",
            )}
          >
            {/* Image Zoom & Tool Bar */}
            <div className="absolute top-2 right-2 z-20 flex items-center gap-1 rounded-lg border border-border/80 bg-background/90 p-1 shadow-md backdrop-blur-xs">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                className="size-7 cursor-pointer text-muted-foreground hover:text-foreground"
                title="Zoom Out"
              >
                <ZoomOut className="size-3.5" />
              </Button>
              <span className="min-w-[36px] text-center text-[11px] font-medium text-muted-foreground">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                className="size-7 cursor-pointer text-muted-foreground hover:text-foreground"
                title="Zoom In"
              >
                <ZoomIn className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleResetZoom}
                className="size-7 cursor-pointer text-muted-foreground hover:text-foreground"
                title="Reset Zoom (100%)"
              >
                <RotateCcw className="size-3.5" />
              </Button>
              {segmentsWithRegions.length > 0 && (
                <Button
                  type="button"
                  variant={showOverlays ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setShowOverlays((v) => !v)}
                  className="size-7 cursor-pointer"
                  title={showOverlays ? "Hide Region Highlights" : "Show Region Highlights"}
                >
                  <Layers className="size-3.5" />
                </Button>
              )}
            </div>

            {/* Image Container Viewport */}
            <div
              ref={imageViewportRef}
              className="flex flex-1 items-center justify-center overflow-auto p-4 select-none"
            >
              {isLoadingImage ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-6 animate-spin text-primary" />
                  <span className="text-xs">Loading image…</span>
                </div>
              ) : isImageError || !imageUrl ? (
                <div className="flex flex-col items-center gap-2 p-6 text-center text-muted-foreground">
                  <AlertTriangle className="size-8 text-warning" />
                  <span className="text-sm font-medium">Image preview unavailable</span>
                  <span className="text-xs text-muted-foreground">
                    The original image could not be loaded directly.
                  </span>
                </div>
              ) : (
                <div
                  className="relative inline-block transition-transform duration-100 ease-out max-w-full"
                  style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
                >
                  <img
                    src={imageUrl}
                    alt={source.title}
                    className="max-h-[85vh] max-w-full rounded-md object-contain shadow-xs border border-border/40"
                  />

                  {/* Bounding Box Highlights */}
                  {showOverlays &&
                    segmentsWithRegions.map((section) => {
                      const region = section.locator?.imageRegion;
                      if (!region) return null;

                      const isActive = activeSegmentId === section.id;
                      const isHovered = hoveredSegmentId === section.id;
                      const isCitationTarget = isMatchingRegion(
                        region,
                        selectedLocator?.imageRegion,
                      );

                      return (
                        <button
                          key={section.id}
                          type="button"
                          data-testid="image-region-box"
                          onClick={() => handleSelectSegment(section.id)}
                          onMouseEnter={() => setHoveredSegmentId(section.id)}
                          onMouseLeave={() => setHoveredSegmentId(null)}
                          className={cn(
                            "absolute rounded transition-all cursor-pointer pointer-events-auto",
                            isActive || isCitationTarget
                              ? "border-2 border-primary bg-primary/30 ring-2 ring-primary/60 shadow-lg z-30"
                              : isHovered
                                ? "border-2 border-primary bg-primary/20 ring-1 ring-primary/40 z-20"
                                : "border border-primary/60 bg-primary/10 hover:border-primary hover:bg-primary/20 z-10",
                          )}
                          style={{
                            left: `${Math.max(0, Math.min(100, region.x * 100))}%`,
                            top: `${Math.max(0, Math.min(100, region.y * 100))}%`,
                            width: `${Math.max(0, Math.min(100, region.width * 100))}%`,
                            height: `${Math.max(0, Math.min(100, region.height * 100))}%`,
                          }}
                          aria-label={`Region #${section.ordinal}: ${section.kind}`}
                        >
                          <span
                            className={cn(
                              "absolute -top-3.5 -left-0.5 rounded px-1 py-0 text-[10px] font-bold shadow-xs whitespace-nowrap",
                              isActive || isCitationTarget
                                ? "bg-primary text-primary-foreground"
                                : "bg-primary/80 text-primary-foreground",
                            )}
                          >
                            #{section.ordinal}
                          </span>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right: Extracted Notes Panel */}
        {(viewMode === "split" || viewMode === "notes") && (
          <div
            ref={notesContainerRef}
            className={cn(
              "flex flex-col overflow-y-auto overscroll-contain bg-background p-4 sm:p-6",
              viewMode === "split" ? "w-full lg:w-1/2" : "w-full max-w-4xl mx-auto",
            )}
          >
            {/* Header & Warnings */}
            <div className="mb-4 space-y-2 border-b border-border/40 pb-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  Extracted Notes
                </h2>
                <Badge variant="secondary" className="gap-1 font-normal text-xs">
                  <Sparkles className="size-3 text-primary" />
                  AI Vision Analysis
                </Badge>
              </div>

              {warningMessage && (
                <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning-foreground">
                  <AlertTriangle className="size-4 shrink-0 text-warning mt-0.5" />
                  <div>
                    <div className="font-semibold">Notice</div>
                    <div className="text-muted-foreground">{warningMessage}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Sections & Note Cards */}
            <div className="space-y-4">
              {sections.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No extracted text or visual analysis available for this image.
                </div>
              ) : (
                sections.map((section) => {
                  const isActive = activeSegmentId === section.id;
                  const isHovered = hoveredSegmentId === section.id;
                  const hasRegion = Boolean(section.locator?.imageRegion);

                  return (
                    <div
                      key={section.id}
                      ref={(el) => {
                        if (el) noteElementsRef.current.set(section.id, el);
                        else noteElementsRef.current.delete(section.id);
                      }}
                      onMouseEnter={() => setHoveredSegmentId(section.id)}
                      onMouseLeave={() => setHoveredSegmentId(null)}
                      onClick={() => handleSelectSegment(section.id)}
                      className={cn(
                        "group rounded-xl border p-3.5 transition-all cursor-pointer",
                        isActive
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30 shadow-xs"
                          : isHovered
                            ? "border-primary/50 bg-muted/40"
                            : "border-border/60 bg-card/40 hover:border-border hover:bg-card/70",
                      )}
                    >
                      {/* Section Card Header */}
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-muted-foreground">
                            #{section.ordinal}
                          </span>

                          {section.kind === "visual_description" && (
                            <Badge
                              variant="secondary"
                              className="gap-1 bg-primary/10 text-primary border-primary/20 text-[11px]"
                            >
                              <Eye className="size-3" />
                              Visual Description
                            </Badge>
                          )}

                          {section.kind === "formula" && (
                            <Badge variant="outline" className="text-[11px] text-muted-foreground">
                              Formula
                            </Badge>
                          )}

                          {section.kind === "heading" && (
                            <Badge variant="outline" className="text-[11px] text-muted-foreground">
                              Heading
                            </Badge>
                          )}
                        </div>

                        {hasRegion && (
                          <span className="text-[10px] text-muted-foreground group-hover:text-primary flex items-center gap-0.5 transition-colors">
                            <Layers className="size-3" />
                            Region #{section.ordinal}
                          </span>
                        )}
                      </div>

                      {/* Section Card Content */}
                      <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed">
                        {section.kind === "heading" ? (
                          <h3 className="font-bold text-foreground text-base tracking-tight my-1">
                            {section.content.replace(/^#{1,6}\s+/, "")}
                          </h3>
                        ) : (
                          <MarkdownRenderer>{section.content}</MarkdownRenderer>
                        )}
                      </div>

                      {section.warning && (
                        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-warning">
                          <AlertTriangle className="size-3" />
                          <span>{section.warning}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function normalizeSegmentKind(
  kind: string | undefined,
  content: string,
): ParsedImageSection["kind"] {
  if (kind === "visual_description") return "visual_description";
  if (kind === "formula" || /\$\$[\s\S]+?\$\$|\$.+?\$/.test(content)) return "formula";
  if (kind === "heading" || /^#{1,6}\s+/.test(content)) return "heading";
  if (kind === "warning") return "warning";
  return "text";
}

function parseRawTextToSections(rawText: string): ParsedImageSection[] {
  if (!rawText || !rawText.trim()) return [];

  const chunks = rawText.split(/\n\n+/).filter((c) => c.trim().length > 0);
  return chunks.map((chunk, index) => {
    let trimmed = chunk.trim();
    const isHeading = /^#{1,6}\s+/.test(trimmed);
    const isVisualDesc =
      trimmed.toLowerCase().startsWith("### visual") ||
      trimmed.toLowerCase().startsWith("**visual description") ||
      trimmed.toLowerCase().includes("diagram:");
    const isFormula = /\$\$[\s\S]+?\$\$|\$.+?\$/.test(trimmed);

    let kind: ParsedImageSection["kind"] = "text";
    if (isVisualDesc) kind = "visual_description";
    else if (isFormula) kind = "formula";
    else if (isHeading) {
      kind = "heading";
      trimmed = trimmed.replace(/^#{1,6}\s+/, "");
    }

    return {
      id: `raw-chunk-${index}`,
      ordinal: index + 1,
      kind,
      content: trimmed,
    };
  });
}

function isMatchingRegion(
  regionA?: ImageRegion | null,
  regionB?: ImageRegion | null,
): boolean {
  if (!regionA || !regionB) return false;
  const tolerance = 0.02;
  return (
    Math.abs(regionA.x - regionB.x) <= tolerance &&
    Math.abs(regionA.y - regionB.y) <= tolerance &&
    Math.abs(regionA.width - regionB.width) <= tolerance &&
    Math.abs(regionA.height - regionB.height) <= tolerance
  );
}
