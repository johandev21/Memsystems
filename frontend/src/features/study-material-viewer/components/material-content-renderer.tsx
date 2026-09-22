import type {
  FlashcardEditorContentType,
  QuizEditorContentType,
  RoadmapEditorContentType,
  SlidesEditorContentType,
} from "@/features/study-material-generation";
import { useTranslation } from "react-i18next";
import { stripCitationMarkersFromContent } from "@/shared/citations/citation";
import type { MindMapContentType } from "../shapes/mind-map";
import type { StudyMaterialDTO } from "../types";
import { CaseStudyView } from "./CaseStudyView";
import { FlashcardView } from "./FlashcardView";
import { MaterialCitations } from "./material-citations";
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
  const { t } = useTranslation("viewer");

  // The model's raw `[ref:Rn]` markers are stripped from the prose for every
  // kind; the citations they point at are surfaced by MaterialCitations, which
  // reads the original content.
  const content = stripCitationMarkersFromContent(material.content);

  let view: React.ReactNode;
  switch (material.kind) {
    case "case_study":
      view = (
        <CaseStudyView
          materialId={material.id}
          content={content}
          notebookId={material.notebookId}
          onOpenSource={() => {
            if (forceFullscreen) handleClose();
            else setIsFullscreen(false);
          }}
        />
      );
      break;
    case "practice_problems":
      view = (
        <PracticeProblemsView
          materialId={material.id}
          content={content}
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
      break;
    case "study_guide":
      view = (
        <StudyGuideView
          content={content}
          notebookId={material.notebookId}
          onOpenSource={() => {
            if (forceFullscreen) onClose();
            else setIsFullscreen(false);
          }}
        />
      );
      break;
    case "quiz":
      view = <QuizView content={content as QuizEditorContentType} />;
      break;
    case "simple_flashcard":
      view = (
        <FlashcardView
          materialId={material.id}
          materialTitle={material.title}
          content={content as FlashcardEditorContentType}
        />
      );
      break;
    case "roadmap":
      view = <RoadmapView materialId={material.id} content={content as RoadmapEditorContentType} />;
      break;
    case "mind_map":
      view = (
        <MindMapView
          materialId={material.id}
          materialTitle={material.title}
          content={content as MindMapContentType}
        />
      );
      break;
    case "slides":
      view = (
        <SlidesView
          materialId={material.id}
          materialTitle={material.title}
          content={content as SlidesEditorContentType}
        />
      );
      break;
    default:
      view = <div className="p-8 text-center text-text-tertiary">{t("unsupportedMaterial")}</div>;
  }

  return (
    <>
      {view}
      <MaterialCitations content={material.content} notebookId={material.notebookId} />
    </>
  );
}
