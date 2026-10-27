import { ImageUploadDialog } from "../dialogs/image-upload-dialog";
import { NotebookDescription } from "./notebook-description";
import { BannerCanvas } from "./banner-canvas";
import { useNotebookBannerEditor } from "../../hooks/use-notebook-banner-editor";
import type { GroundingMode } from "../../model/grounding-mode";

export interface NotebookBannerProps {
  notebookId: string;
  title: string;
  description?: string | null;
  icon?: string;
  groundingMode?: GroundingMode | null;
  bannerUrl?: string | null;
  bannerVariants?: { w480: string | null; w960: string | null; w1920: string | null } | null;
  bannerFocalPoint?: { x: number; y: number } | null;
  updatedAt: string;
  isUntitled: boolean;
}

export function NotebookBanner(props: NotebookBannerProps) {
  const {
    notebookId,
    title,
    description,
    icon,
    groundingMode,
    bannerUrl,
    bannerVariants,
    bannerFocalPoint,
    updatedAt,
    isUntitled,
  } = props;

  const editor = useNotebookBannerEditor({
    notebookId,
    title,
    description,
    icon,
    groundingMode,
    bannerUrl,
    bannerVariants,
    bannerFocalPoint,
    updatedAt,
  });

  return (
    <div className="group/header mb-6 flex flex-col gap-3">
      <BannerCanvas
        containerRef={editor.focalPointDrag.containerRef}
        isEditing={editor.isEditing}
        visibleBannerUrl={editor.visibleBannerUrl}
        visibleBannerVariants={editor.visibleBannerVariants}
        visibleFocalPoint={editor.visibleFocalPoint}
        imageError={editor.draft.imageError}
        onImageError={editor.handleImageError}
        focalPointDrag={editor.focalPointDrag}
        onKeyDown={editor.handleBannerKeyDown}
        isSaving={editor.isSaving}
        onOpenImageDialog={() => editor.setImageDialogOpen(true)}
        onRemoveBanner={editor.handleRemoveBanner}
        onCancel={editor.handleCancel}
        onSave={editor.handleSave}
        onBeginEditing={editor.beginEditing}
        draftTitle={editor.draft.title}
        onDraftTitleChange={editor.handleDraftTitleChange}
        formattedDate={editor.formattedDate}
        draftIcon={editor.draft.icon}
        onDraftIconChange={editor.handleDraftIconChange}
        icon={icon}
        title={title}
        isUntitled={isUntitled}
      />

      <NotebookDescription
        description={editor.isEditing ? editor.draft.description : (description ?? "")}
        isEditing={editor.isEditing}
        onChange={editor.handleDraftDescriptionChange}
        onCancel={editor.handleCancel}
      />

      <ImageUploadDialog
        open={editor.imageDialogOpen}
        onOpenChange={editor.setImageDialogOpen}
        onSelectFile={editor.handleSelectFile}
      />
    </div>
  );
}
