import { useEffect, useState } from "react";
import type { SourceSegmentLocator } from "@/features/sources";

export interface OpenSourceViewerDetail {
  sourceId: string;
  locator?: SourceSegmentLocator | null;
}

export function useSourcesPanel() {
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedLocator, setSelectedLocator] = useState<SourceSegmentLocator | null>(null);

  useEffect(() => {
    const handleOpenSource = (event: Event) => {
      const detail = (event as CustomEvent<OpenSourceViewerDetail>).detail;
      if (detail?.sourceId) {
        setSelectedSourceId(detail.sourceId);
        setSelectedLocator(detail.locator ?? null);
      }
    };

    window.addEventListener("open-source-viewer", handleOpenSource);
    return () => window.removeEventListener("open-source-viewer", handleOpenSource);
  }, []);

  const handleSelectSource = (id: string | null, locator?: SourceSegmentLocator | null) => {
    setSelectedSourceId(id);
    setSelectedLocator(locator ?? null);
  };

  return {
    selectedSourceId,
    setSelectedSourceId: handleSelectSource,
    selectedLocator,
    setSelectedLocator,
  };
}

export type UseSourcesPanelReturn = ReturnType<typeof useSourcesPanel>;
