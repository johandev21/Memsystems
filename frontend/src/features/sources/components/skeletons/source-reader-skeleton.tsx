import { ArrowLeft, Maximize2, MoreVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { DocumentType } from "../../utils/detect-document-type";
import { AudioViewerSkeleton } from "./audio-viewer-skeleton";
import { DocumentViewerSkeleton } from "./document-viewer-skeleton";
import { ImageViewerSkeleton } from "./image-viewer-skeleton";
import { SlidesViewerSkeleton } from "./slides-viewer-skeleton";
import { VideoViewerSkeleton } from "./video-viewer-skeleton";

export interface SourceReaderSkeletonProps {
  detectedType?: DocumentType | null;
  title?: string | null;
  isFullscreen?: boolean;
  forceFullscreen?: boolean;
  onClose: () => void;
}

export function SourceReaderSkeleton({
  detectedType,
  title,
  isFullscreen,
  forceFullscreen,
  onClose,
}: SourceReaderSkeletonProps) {
  const isEffectivelyFullscreen = Boolean(forceFullscreen || isFullscreen);

  return (
    <div
      data-testid="source-reader-skeleton"
      className={
        isEffectivelyFullscreen
          ? "fixed inset-0 z-viewer flex h-[100dvh] w-screen flex-col bg-panel-bg text-foreground overflow-hidden"
          : "flex h-full flex-col bg-panel-bg text-foreground overflow-hidden"
      }
    >
      {/* Persistent Zero-CLS Header */}
      <div className="flex items-center justify-between gap-2 p-1.5 bg-panel-header-bg min-h-[44px] shrink-0 select-none border-b border-border/40">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg shrink-0"
            aria-label="Back to sources"
            title="Back to sources"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          {title ? (
            <h3 className="text-sm font-semibold truncate text-foreground min-w-0 flex-1">
              {title}
            </h3>
          ) : (
            <Skeleton className="h-4 w-40 max-w-[220px] rounded-md" />
          )}
        </div>

        <div className="flex items-center gap-1">
          <div className="h-8 w-8 flex items-center justify-center text-muted-foreground/30">
            <MoreVertical className="h-4 w-4" />
          </div>
          {!forceFullscreen && (
            <div className="h-8 w-8 flex items-center justify-center text-muted-foreground/30">
              <Maximize2 className="h-4 w-4" />
            </div>
          )}
          {isEffectivelyFullscreen && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg"
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Modality-specific skeleton body */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {detectedType === "audio" ? (
          <AudioViewerSkeleton />
        ) : detectedType === "video" ? (
          <VideoViewerSkeleton />
        ) : detectedType === "slides" ? (
          <SlidesViewerSkeleton />
        ) : detectedType === "image" ? (
          <ImageViewerSkeleton />
        ) : detectedType === "epub" ? (
          <DocumentViewerSkeleton variant="book" />
        ) : detectedType === "article" ? (
          <DocumentViewerSkeleton variant="article" />
        ) : (
          <DocumentViewerSkeleton variant="document" />
        )}
      </div>
    </div>
  );
}
