import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  DEFAULT_FOCAL_POINT,
  type BannerDraftState,
  bannerDraftReducer,
  saveNotebookBannerChanges,
} from "../components/shared/notebook-banner-draft";
import { resolveGroundingMode, type GroundingMode } from "../model/grounding-mode";
import { useBannerFocalPointDrag } from "./use-banner-focal-point-drag";
import { EDIT_NOTEBOOK_EVENT } from "./use-notebook-settings-actions";
import type { BannerUploadPayload } from "../utils/banner-variants";

export interface UseNotebookBannerEditorProps {
  notebookId: string;
  title: string;
  description?: string | null;
  icon?: string;
  groundingMode?: GroundingMode | null;
  bannerUrl?: string | null;
  bannerVariants?: { w480: string | null; w960: string | null; w1920: string | null } | null;
  bannerFocalPoint?: { x: number; y: number } | null;
  updatedAt: string;
}

export function useNotebookBannerEditor({
  notebookId,
  title,
  description,
  icon,
  groundingMode,
  bannerUrl,
  bannerVariants,
  bannerFocalPoint,
  updatedAt,
}: UseNotebookBannerEditorProps) {
  const { t, i18n } = useTranslation("notebooks");
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const bannerUploadRef = useRef<BannerUploadPayload | null>(null);

  const createInitialDraft = useCallback(
    (): BannerDraftState => ({
      title,
      description: description ?? "",
      icon: icon ?? "notebook",
      groundingMode: resolveGroundingMode(undefined, groundingMode),
      focalPoint: bannerFocalPoint ?? DEFAULT_FOCAL_POINT,
      previewUrl: null,
      bannerRemoved: false,
      imageError: false,
    }),
    [bannerFocalPoint, description, groundingMode, icon, title],
  );

  const [draft, dispatch] = useReducer(bannerDraftReducer, undefined, createInitialDraft);

  const resetDraft = useCallback(() => {
    if (draft.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(draft.previewUrl);
    bannerUploadRef.current = null;
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
  const visibleBannerVariants = isEditing && draft.previewUrl ? null : bannerVariants;

  const focalPointDrag = useBannerFocalPointDrag({
    enabled: isEditing && !!visibleBannerUrl,
    focalPoint: draft.focalPoint,
    onChange: (nextFocalPoint) => dispatch({ type: "SET_FOCAL_POINT", focalPoint: nextFocalPoint }),
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

  const handleSelectFile = (payload: BannerUploadPayload) => {
    if (draft.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(draft.previewUrl);
    bannerUploadRef.current = payload;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        dispatch({ type: "SET_PREVIEW", previewUrl: reader.result });
      }
    };
    reader.readAsDataURL(payload.file);
  };

  const handleRemoveBanner = () => {
    bannerUploadRef.current = null;
    dispatch({ type: "REMOVE_BANNER" });
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
        groundingMode,
        bannerUrl,
        bannerFocalPoint,
        draft: { ...draft, title: trimmedTitle },
        bannerUpload: bannerUploadRef.current,
        queryClient,
      });
      toast.success(t("banner.updated"));
      setIsEditing(false);
      bannerUploadRef.current = null;
      dispatch({ type: "RESET", payload: createInitialDraft() });
    } catch {
      toast.error(t("banner.updateFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDraftTitleChange = (nextTitle: string) =>
    dispatch({ type: "SET_TITLE", title: nextTitle });

  const handleDraftIconChange = (nextIcon: string) =>
    dispatch({ type: "SET_ICON", icon: nextIcon });

  const handleDraftDescriptionChange = (nextDescription: string) =>
    dispatch({ type: "SET_DESCRIPTION", description: nextDescription });

  const handleImageError = () => dispatch({ type: "SET_IMAGE_ERROR", error: true });

  return {
    isEditing,
    isSaving,
    imageDialogOpen,
    setImageDialogOpen,
    draft,
    dispatch,
    formattedDate,
    visibleBannerUrl,
    visibleFocalPoint,
    visibleBannerVariants,
    focalPointDrag,
    beginEditing,
    handleBannerKeyDown,
    handleSelectFile,
    handleRemoveBanner,
    handleCancel,
    handleSave,
    handleDraftTitleChange,
    handleDraftIconChange,
    handleDraftDescriptionChange,
    handleImageError,
  };
}
