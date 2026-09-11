import { useId, type MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { sourcesQueryOptions } from "@/features/sources/api/sources";
import type { StudyGuideContentType } from "../shapes/study-guide";

export function useStudyGuideReader(
  guide: StudyGuideContentType,
  notebookId: string,
  onOpenSource?: () => void,
) {
  const prefix = useId();
  const hasReferences = guide.sections.some((section) => section.sourceIds.length > 0);
  const sources = useQuery({ ...sourcesQueryOptions(notebookId), enabled: hasReferences });
  const sectionId = (id: string) => `${prefix}-${id}`;

  const openSource = (sourceId: string) => {
    onOpenSource?.();
    window.dispatchEvent(new CustomEvent("open-source-viewer", { detail: { sourceId } }));
  };
  const navigateToSection = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    const target = document.getElementById(sectionId(id));
    target?.scrollIntoView({ block: "start" });
    target?.focus({ preventScroll: true });
  };

  return { hasReferences, sources, sectionId, openSource, navigateToSection };
}
