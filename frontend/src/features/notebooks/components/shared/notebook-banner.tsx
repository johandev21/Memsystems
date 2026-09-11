import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ImageUploadDialog } from "../dialogs/image-upload-dialog";
import { EDIT_NOTEBOOK_EVENT } from "../dialogs/notebook-settings-dialog";
import { NotebookDescription } from "./notebook-description";
import { BannerCanvas } from "./banner-canvas";
import {
  DEFAULT_FOCAL_POINT,
  type BannerDraftState,
  bannerDraftReducer,
  saveNotebookBannerChanges,
} from "./notebook-banner-draft";
import { useBannerFocalPointDrag } from "../../hooks/use-banner-focal-point-drag";

export interface NotebookBannerProps {
  notebookId: string;
  title: string;
  description?: string | null;
  icon?: string;
  bannerUrl?: string | null;
  bannerFocalPoint?: { x: number; y: number } | null;
  updatedAt: string;
  isUntitled: boolean;
}

export function NotebookBanner({
  notebookId,
  title,
  description,
  icon,
  bannerUrl,
  bannerFocalPoint,
  updatedAt,
  isUntitled,
}: NotebookBannerProps) {
  const { t, i18n } = useTranslation("notebooks");
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const bannerFileRef = useRef<File | null>(null);

  const createInitialDraft = useCallback(
    (): BannerDraftState => ({
      title,
      description: description ?? "",
      icon: icon ?? "notebook",
      focalPoint: bannerFocalPoint ?? DEFAULT_FOCAL_POINT,
      previewUrl: null,
      bannerRemoved: false,
      imageError: false,
    }),
    [bannerFocalPoint, description, icon, title],
  );

  const [draft, dispatch] = useReducer(bannerDraftReducer, undefined, createInitialDraft);

  const resetDraft = useCallback(() => {
    if (draft.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(draft.previewUrl);
    bannerFileRef.current = null;
    dispatch({ type: "RESET", payload: createInitialDraft() });
  }, [createInitialDraft, draft.previewUrl]);

  const beginEditing = useCallback(() => {
    resetDraft();
    setIsEditing(true);
  }, [resetDraft]);

  const beginEditingRef = useRef(beginEditing);
  useEffect(() => {
    beginEditingRef.current = beginEditing;
  }, [beginEditing]);

  useEffect(() => {
    const handleEditRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ notebookId?: string }>).detail;
      if (detail?.notebookId === notebookId) beginEditingRef.current();
    };
    window.addEventListener(EDIT_NOTEBOOK_EVENT, handleEditRequest);
    return () => window.removeEventListener(EDIT_NOTEBOOK_EVENT, handleEditRequest);
  }, [notebookId]);

  useEffect(() => {
    return () => {
      if (draft.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(draft.previewUrl);
    };
  }, [draft.previewUrl]);

  const formattedDate = useMemo(
    () =>
      new Date(updatedAt).toLocaleDateString(i18n.resolvedLanguage ?? "en", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    [updatedAt, i18n.resolvedLanguage],
  );

  const visibleBannerUrl = draft.bannerRemoved ? null : (draft.previewUrl ?? bannerUrl ?? null);
  const visibleFocalPoint = isEditing ? draft.focalPoint : (bannerFocalPoint ?? DEFAULT_FOCAL_POINT);

  const focalPointDrag = useBannerFocalPointDrag({
    enabled: isEditing && !!visibleBannerUrl,
    focalPoint: draft.focalPoint,
    onChange: (focalPoint) => dispatch({ type: "SET_FOCAL_POINT", focalPoint }),
  });

  const handleBannerKeyDown = (e: React.KeyboardEvent) => {
    if (!isEditing || !visibleBannerUrl) return;
    const STEP = 0.05;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      dispatch({
        type: "SET_FOCAL_POINT",
        focalPoint: { ...draft.focalPoint, y: Math.max(0, draft.focalPoint.y - STEP) },
      });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      dispatch({
        type: "SET_FOCAL_POINT",
        focalPoint: { ...draft.focalPoint, y: Math.min(1, draft.focalPoint.y + STEP) },
      });
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      dispatch({
        type: "SET_FOCAL_POINT",
        focalPoint: { ...draft.focalPoint, x: Math.max(0, draft.focalPoint.x - STEP) },
      });
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      dispatch({
        type: "SET_FOCAL_POINT",
        focalPoint: { ...draft.focalPoint, x: Math.min(1, draft.focalPoint.x + STEP) },
      });
    }
  };

  const handleSelectFile = (file: File) => {
    if (draft.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(draft.previewUrl);
    bannerFileRef.current = file;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        dispatch({ type: "SET_PREVIEW", previewUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCancel = () => {
    resetDraft();
    setIsEditing(false);
  };

  const handleSave = async () => {
    const trimmedTitle = draft.title.trim();
    if (!trimmedTitle) {
      toast.error(t("banner.titleRequired"));
      return;
    }
    setIsSaving(true);
    try {
      await saveNotebookBannerChanges({
        notebookId,
        title,
        description,
        icon,
        bannerUrl,
        bannerFocalPoint,
        draft: { ...draft, title: trimmedTitle },
        bannerFile: bannerFileRef.current,
        queryClient,
      });
      toast.success(t("banner.updated"));
      setIsEditing(false);
      bannerFileRef.current = null;
      dispatch({ type: "RESET", payload: createInitialDraft() });
    } catch {
      toast.error(t("banner.updateFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="group/header mb-6 flex flex-col gap-3">
      <BannerCanvas
        containerRef={focalPointDrag.containerRef}
        isEditing={isEditing}
        visibleBannerUrl={visibleBannerUrl}
        visibleFocalPoint={visibleFocalPoint}
        imageError={draft.imageError}
        onImageError={() => dispatch({ type: "SET_IMAGE_ERROR", error: true })}
        focalPointDrag={focalPointDrag}
        onKeyDown={handleBannerKeyDown}
        isSaving={isSaving}
        onOpenImageDialog={() => setImageDialogOpen(true)}
        onRemoveBanner={() => {
          bannerFileRef.current = null;
          dispatch({ type: "REMOVE_BANNER" });
        }}
        onCancel={handleCancel}
        onSave={handleSave}
        onBeginEditing={beginEditing}
        draftTitle={draft.title}
        onDraftTitleChange={(nextTitle) => dispatch({ type: "SET_TITLE", title: nextTitle })}
        formattedDate={formattedDate}
        draftIcon={draft.icon}
        onDraftIconChange={(nextIcon) => dispatch({ type: "SET_ICON", icon: nextIcon })}
        icon={icon}
        title={title}
        isUntitled={isUntitled}
      />

      <NotebookDescription
        description={isEditing ? draft.description : (description ?? "")}
        isEditing={isEditing}
        onChange={(nextDescription) => dispatch({ type: "SET_DESCRIPTION", description: nextDescription })}
        onCancel={handleCancel}
      />

      <ImageUploadDialog
        open={imageDialogOpen}
        onOpenChange={setImageDialogOpen}
        onSelectFile={handleSelectFile}
      />
    </div>
  );
}
