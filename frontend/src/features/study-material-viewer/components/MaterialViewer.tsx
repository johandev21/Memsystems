import { useEffect, useRef, useCallback } from "react";
import type { StudyMaterialDTO } from "../types";
import { useMaterialViewerFullscreen } from "../hooks/use-material-viewer-fullscreen";
import { MaterialViewerHeader } from "./material-viewer-header";
import { MaterialContentRenderer } from "./material-content-renderer";

export interface MaterialViewerProps {
  material: StudyMaterialDTO;
  onClose: () => void;
  showHeader?: boolean;
  defaultFullscreen?: boolean;
  forceFullscreen?: boolean;
}

export function MaterialViewer({
  material,
  onClose,
  showHeader = true,
  defaultFullscreen,
  forceFullscreen,
}: MaterialViewerProps) {
  const beforeCloseRef = useRef<(() => boolean) | null>(null);

  const handleClose = useCallback(() => {
    if (beforeCloseRef.current && !beforeCloseRef.current()) {
      return;
    }
    onClose();
  }, [onClose]);

  const {
    isFullscreen,
    setIsFullscreen,
    isExitingFullscreen,
    isEffectivelyFullscreen,
    isChatSuspended,
    hasChatHandoff,
    setHasChatHandoff,
    scrollPositionRef,
  } = useMaterialViewerFullscreen(material.id, forceFullscreen, defaultFullscreen, handleClose);

  const contentScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollPositionRef.current.element = contentScrollRef.current;
  });

  const handleToggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    if (!isFullscreen) setHasChatHandoff(false);
  };

  return (
    <div
      className={`flex h-full flex-col bg-surface-1 text-text-primary overflow-hidden ${
        isChatSuspended ? "hidden" : ""
      } ${
        isEffectivelyFullscreen || isExitingFullscreen
          ? "fixed inset-0 z-viewer h-dvh w-screen motion-reduce:animate-none"
          : ""
      } ${isExitingFullscreen ? "animate-out fade-out duration-150" : ""}`}
    >
      {showHeader && (
        <MaterialViewerHeader
          title={material.title}
          isEffectivelyFullscreen={isEffectivelyFullscreen}
          hasChatHandoff={hasChatHandoff}
          forceFullscreen={forceFullscreen}
          isFullscreen={isFullscreen}
          onClose={handleClose}
          onToggleFullscreen={handleToggleFullscreen}
        />
      )}
      <div
        ref={contentScrollRef}
        className={`flex-1 overflow-y-auto overscroll-contain ${
          isEffectivelyFullscreen
            ? "p-3 sm:p-4 md:p-8 max-w-7xl mx-auto w-full"
            : "p-3 sm:p-4 md:p-6"
        }`}
      >
        <MaterialContentRenderer
          material={material}
          forceFullscreen={forceFullscreen}
          handleClose={handleClose}
          setIsFullscreen={setIsFullscreen}
          beforeCloseRef={beforeCloseRef}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
