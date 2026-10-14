import { useRef, useState } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";

export interface UseNotebookPanelsReturn {
  sourcesRef: React.RefObject<PanelImperativeHandle | null>;
  chatRef: React.RefObject<PanelImperativeHandle | null>;
  studioRef: React.RefObject<PanelImperativeHandle | null>;
  sourcesCollapsed: boolean;
  studioCollapsed: boolean;
  syncSources: () => void;
  syncStudio: () => void;
}

export function useNotebookPanels(): UseNotebookPanelsReturn {
  const sourcesRef = useRef<PanelImperativeHandle>(null);
  const chatRef = useRef<PanelImperativeHandle>(null);
  const studioRef = useRef<PanelImperativeHandle>(null);
  const [sourcesCollapsed, setSourcesCollapsed] = useState(false);
  const [studioCollapsed, setStudioCollapsed] = useState(false);

  const syncSources = () => {
    const isCollapsed = sourcesRef.current?.isCollapsed() ?? false;
    setSourcesCollapsed((prev) => (prev !== isCollapsed ? isCollapsed : prev));
  };

  const syncStudio = () => {
    const isCollapsed = studioRef.current?.isCollapsed() ?? false;
    setStudioCollapsed((prev) => (prev !== isCollapsed ? isCollapsed : prev));
  };

  return {
    sourcesRef,
    chatRef,
    studioRef,
    sourcesCollapsed,
    studioCollapsed,
    syncSources,
    syncStudio,
  };
}
