import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { fetchApi } from "@/shared/api";
import type { Source, SourceWithContent } from "../../types";
import type { ReaderControls } from "./source-content-types";

export function useCachedSourceSummary(sourceId: string): Source | undefined {
  const queryClient = useQueryClient();
  const allSources = queryClient.getQueriesData<Source[]>({ queryKey: ["sources"] });
  for (const [, list] of allSources) {
    const match = list?.find((s) => s.id === sourceId);
    if (match) return match;
  }
  return undefined;
}

export function useSourceReaderControls({
  defaultFullscreen,
  forceFullscreen,
  onClose,
  source,
}: {
  defaultFullscreen?: boolean;
  forceFullscreen?: boolean;
  onClose: () => void;
  source?: SourceWithContent;
}): ReaderControls {
  const { t } = useTranslation("sources");
  const [downloading, setDownloading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(() =>
    Boolean(defaultFullscreen || forceFullscreen),
  );
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const isEffectivelyFullscreen = Boolean(forceFullscreen || isFullscreen);

  useEffect(() => {
    if (!isEffectivelyFullscreen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (forceFullscreen) onClose();
      else setIsFullscreen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEffectivelyFullscreen, forceFullscreen, onClose]);

  const handleDownload = async () => {
    if (!source || source.kind !== "file") return;
    setDownloading(true);
    try {
      const response = await fetchApi(`/api/sources/${source.id}/download`);
      if (!response.ok) throw new Error(t("reader.downloadLinkFailed"));
      const { url } = await response.json();
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success(t("reader.downloadStarted"));
    } catch {
      toast.error(t("reader.downloadFailed"));
    } finally {
      setDownloading(false);
    }
  };

  return {
    downloading,
    handleDownload,
    isEffectivelyFullscreen,
    isFullscreen,
    scrollElement,
    setScrollElement,
    toggleFullscreen: () => setIsFullscreen((value) => !value),
  };
}
