export const loadMaterialViewer = () =>
  import("./components/MaterialViewer").then((m) => ({
    default: m.MaterialViewer,
  }));
export * from "./components/skeletons/MaterialViewerSkeleton";
export * from "./components/skeletons/FlashcardSkeleton";
export * from "./components/skeletons/QuizSkeleton";
export * from "./components/skeletons/SlidesSkeleton";
export * from "./components/skeletons/RoadmapSkeleton";
export * from "./components/skeletons/MindMapSkeleton";
export * from "./shapes/kind-labels";
export * from "./shapes/mind-map";
export * from "./shapes/simple-flashcard";
export * from "./shapes/slides";
export * from "./shapes/roadmap";
export * from "./types/study-material.types";
export type { StudyMaterialDTO as StudyMaterial } from "./types/study-material.types";
export * from "./api/study-materials";
export * from "./hooks/use-study-material";
export * from "./hooks/use-flashcard-session";
export { useRoadmapProgress } from "./hooks/use-roadmap-progress";
export * from "./hooks/use-material-viewer-fullscreen";
export * from "./hooks/use-slides-export";
export * from "./utils/format-title";
export * from "./utils/slides-preview";
