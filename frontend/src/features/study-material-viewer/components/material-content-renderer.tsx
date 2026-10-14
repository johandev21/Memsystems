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
import { FlashcardView } from "./FlashcardView";
import { MindMapView } from "./MindMapView";
import { QuizView } from "./QuizView";
import { RoadmapView } from "./RoadmapView";
import { SlidesView } from "./SlidesView";

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
  forceFullscreen: _forceFullscreen,
  handleClose: _handleClose,
  setIsFullscreen: _setIsFullscreen,
  beforeCloseRef: _beforeCloseRef,
  onClose: _onClose,
}: MaterialContentRendererProps) {
  const { t } = useTranslation("viewer");

  const content = stripCitationMarkersFromContent(material.content);

  let view: React.ReactNode;
  switch (material.kind) {
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

  return view;
}
