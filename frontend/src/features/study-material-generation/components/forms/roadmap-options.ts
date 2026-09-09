export type DetailLevel = "basic" | "detailed";

export const PHASE_PRESETS = [3, 5, 7, 10];

export const DETAIL_OPTIONS = [
  {
    id: "basic" as DetailLevel,
    title: "Basic",
    desc: "Phase titles & milestones only",
  },
  {
    id: "detailed" as DetailLevel,
    title: "Detailed",
    desc: "In-depth topics & learning objectives",
  },
] as const;

export const DEFAULT_ROADMAP_OPTIONS: {
  phaseCount: number;
  detailLevel: DetailLevel;
} = {
  phaseCount: 5,
  detailLevel: "detailed",
};

