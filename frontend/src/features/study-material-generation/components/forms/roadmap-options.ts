import type { RoadmapOptions } from "./types";

export type DetailLevel = "basic" | "detailed";

export const PHASE_PRESETS = [3, 5, 7];

export const DETAIL_OPTIONS = [
  {
    id: "basic" as DetailLevel,
    titleKey: "roadmap.detail.basic.title",
    descKey: "roadmap.detail.basic.desc",
  },
  {
    id: "detailed" as DetailLevel,
    titleKey: "roadmap.detail.detailed.title",
    descKey: "roadmap.detail.detailed.desc",
  },
] as const;

export const DEFAULT_ROADMAP_OPTIONS: RoadmapOptions = {
  phaseCount: 0,
  detailLevel: "auto",
};
