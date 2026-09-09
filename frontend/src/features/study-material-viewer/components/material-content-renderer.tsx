import type {
  FlashcardEditorContentType,
  QuizEditorContentType,
  RoadmapEditorContentType,
  SlidesEditorContentType,
} from "@/features/study-material-generation";
import type { MindMapContentType } from "../shapes/mind-map";
import type { StudyMaterialDTO } from "../types";
import { CaseStudyView } from "./CaseStudyView";
import { FlashcardView } from "./FlashcardView";
import { MindMapView } from "./MindMapView";
import { PracticeProblemsView } from "./PracticeProblemsView";
import { QuizView } from "./QuizView";
import { RoadmapView } from "./RoadmapView";
import { SlidesView } from "./SlidesView";
import { StudyGuideView } from "./StudyGuideView";

export interface MaterialContentRendererProps {
  material: StudyMaterialDTO;
  forceFullscreen?: boolean;
  handleClose: () => void;
  setIsFullscreen: (value: boolean | ((prev: boolean) => boolean)) => void;
  beforeCloseRef: React.RefObject<(() => boolean) | null>;
  onClose: () => void;
}

export function MaterialContentRenderer({
  material,
  forceFullscreen,
  handleClose,
  setIsFullscreen,
  beforeCloseRef,
  onClose,
}: MaterialContentRendererProps) {
  switch (material.kind) {
    case "case_study":
      return (
        <CaseStudyView
          materialId={material.id}
          content={material.content}
          notebookId={material.notebookId}
          onOpenSource={() => {
            if (forceFullscreen) handleClose();
            else setIsFullscreen(false);
          }}
        />
      );
    case "practice_problems":
      return (
        <PracticeProblemsView
          materialId={material.id}
          content={material.content}
          notebookId={material.notebookId}
          onClose={onClose}
          registerBeforeClose={(fn) => {
            beforeCloseRef.current = fn;
          }}
          onOpenSource={() => {
            if (forceFullscreen) handleClose();
            else setIsFullscreen(false);
          }}
        />
      );
    case "study_guide":
      return (
        <StudyGuideView
          content={material.content}
          notebookId={material.notebookId}
          onOpenSource={() => {
            if (forceFullscreen) onClose();
            else setIsFullscreen(false);
          }}
        />
      );
    case "quiz":
      return <QuizView content={material.content as QuizEditorContentType} />;
    case "simple_flashcard":
      return (
        <FlashcardView
          materialId={material.id}
          materialTitle={material.title}
          content={material.content as FlashcardEditorContentType}
        />
      );
    case "roadmap":
      return (
        <RoadmapView
          materialId={material.id}
          content={material.content as RoadmapEditorContentType}
        />
      );
    case "mind_map":
      return (
        <MindMapView
          materialId={material.id}
          materialTitle={material.title}
          content={material.content as MindMapContentType}
        />
      );
    case "slides":
      return (
        <SlidesView
          materialId={material.id}
          materialTitle={material.title}
          content={material.content as SlidesEditorContentType}
        />
      );
    default:
      return <div className="p-8 text-center text-text-tertiary">Unsupported material type</div>;
  }
}
