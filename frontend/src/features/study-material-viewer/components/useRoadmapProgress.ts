import { useState } from "react";

export interface RoadmapTopic {
  id: string;
  title: string;
  description?: string;
  order?: number;
  keyTakeaways?: string[];
}

export interface RoadmapPhase {
  id: string;
  title: string;
  description?: string;
  color?: string;
  order?: number;
  topics: RoadmapTopic[];
}

export function useRoadmapProgress(_materialId: string, phases: RoadmapPhase[]) {
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    phases.forEach((p) => {
      initial[p.id] = true;
    });
    return initial;
  });

  const togglePhase = (phaseId: string) => {
    setExpandedPhases((prev) => ({
      ...prev,
      [phaseId]: !prev[phaseId],
    }));
  };

  const expandAllPhases = () => {
    const next: Record<string, boolean> = {};
    phases.forEach((p) => {
      next[p.id] = true;
    });
    setExpandedPhases(next);
  };

  const collapseAllPhases = () => {
    setExpandedPhases({});
  };

  const allTopics = phases.flatMap((p) => p.topics);
  const totalTopicsCount = allTopics.length;
  const totalPhasesCount = phases.length;

  return {
    expandedPhases,
    togglePhase,
    expandAllPhases,
    collapseAllPhases,
    totalTopicsCount,
    totalPhasesCount,
  };
}
