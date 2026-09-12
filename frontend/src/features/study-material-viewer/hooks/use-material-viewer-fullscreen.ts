import { useState, useEffect, useRef, useCallback } from "react";

export function useMaterialViewerFullscreen(
  materialId: string,
  forceFullscreen: boolean | undefined,
  defaultFullscreen: boolean | undefined,
  onClose: () => void,
) {
  const [isFullscreen, setIsFullscreen] = useState(() =>
    Boolean(defaultFullscreen || forceFullscreen),
  );
  const [isExitingFullscreen, setIsExitingFullscreen] = useState(false);
  const [isChatSuspended, setIsChatSuspended] = useState(false);
  const [hasChatHandoff, setHasChatHandoff] = useState(false);
  const scrollPositionRef = useRef<{
    top: number;
    left: number;
    element: HTMLDivElement | null;
  }>({ top: 0, left: 0, element: null });
  const isEffectivelyFullscreen = !isChatSuspended && (Boolean(forceFullscreen) || isFullscreen);

  const isActiveViewer = useCallback(
    () =>
      window.matchMedia(forceFullscreen ? "(max-width: 1023px)" : "(min-width: 1024px)").matches,
    [forceFullscreen],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isEffectivelyFullscreen && isActiveViewer()) {
        if (forceFullscreen) onClose();
        else setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActiveViewer, isEffectivelyFullscreen, forceFullscreen, onClose]);

  useEffect(() => {
    let exitTimer: number | undefined;
    const handleChatNavigation = (event: Event) => {
      const detail = (event as CustomEvent<{ focusChat?: boolean; chatNavigationRetry?: boolean }>)
        .detail;
      if (!detail?.focusChat || !isEffectivelyFullscreen || detail.chatNavigationRetry) return;
      if (!isActiveViewer()) return;
      if (forceFullscreen) {
        const element = scrollPositionRef.current.element;
        if (element) {
          scrollPositionRef.current.top = element.scrollTop;
          scrollPositionRef.current.left = element.scrollLeft;
        }
        window.dispatchEvent(
          new CustomEvent("study-material-chat-handoff", {
            detail: { materialId, suspended: true },
          }),
        );
        setIsChatSuspended(true);
        return;
      }
      setHasChatHandoff(true);
      setIsExitingFullscreen(true);
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      exitTimer = window.setTimeout(
        () => {
          setIsFullscreen(false);
          setIsExitingFullscreen(false);
        },
        reducedMotion ? 0 : 150,
      );
    };
    window.addEventListener("send-chat-prompt", handleChatNavigation);
    return () => {
      window.removeEventListener("send-chat-prompt", handleChatNavigation);
      if (exitTimer) window.clearTimeout(exitTimer);
    };
  }, [isActiveViewer, isEffectivelyFullscreen, forceFullscreen, materialId]);

  useEffect(() => {
    if (!forceFullscreen) return;
    const handleRestore = (event: Event) => {
      const detail = (event as CustomEvent<{ materialId?: string }>).detail;
      if (detail?.materialId && detail.materialId !== materialId) return;
      setIsChatSuspended(false);
      requestAnimationFrame(() => {
        const element = scrollPositionRef.current.element;
        if (element) {
          element.scrollTop = scrollPositionRef.current.top;
          element.scrollLeft = scrollPositionRef.current.left;
        }
      });
      window.dispatchEvent(
        new CustomEvent("study-material-chat-handoff", {
          detail: { materialId, suspended: false },
        }),
      );
    };
    window.addEventListener("restore-study-material", handleRestore);
    return () => window.removeEventListener("restore-study-material", handleRestore);
  }, [forceFullscreen, materialId]);

  const [prevMaterialId, setPrevMaterialId] = useState(materialId);
  if (prevMaterialId !== materialId) {
    setPrevMaterialId(materialId);
    setIsChatSuspended(false);
    setHasChatHandoff(false);
  }

  return {
    isFullscreen,
    setIsFullscreen,
    isExitingFullscreen,
    isEffectivelyFullscreen,
    isChatSuspended,
    hasChatHandoff,
    setHasChatHandoff,
    scrollPositionRef,
  };
}
