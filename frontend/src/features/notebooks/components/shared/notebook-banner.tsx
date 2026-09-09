import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, ImagePlus, Move, Pencil, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { toast } from "sonner";
import { ImageUploadDialog } from "../dialogs/image-upload-dialog";
import { EDIT_NOTEBOOK_EVENT } from "../dialogs/notebook-settings-dialog";
import { NotebookDescription } from "./notebook-description";
import { fetchApi } from "@/shared/api";
import { cn } from "@/shared/utils/cn";
import { Button } from "@/components/ui/button";
import { IconPicker } from "@/components/ui/icon-picker";
import { Input } from "@/components/ui/input";
import { NotebookIcon } from "../notebook-icon";
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

const DEFAULT_FOCAL_POINT = { x: 0.5, y: 0.5 };

function BannerImage({
  visibleBannerUrl,
  visibleFocalPoint,
  imageError,
  onImageError,
}: {
  visibleBannerUrl: string | null | undefined;
  visibleFocalPoint: { x: number; y: number };
  imageError: boolean;
  onImageError: () => void;
}) {
  if (visibleBannerUrl && !imageError) {
    return (
      <img
        src={visibleBannerUrl}
        alt=""
        className="pointer-events-none absolute inset-0 size-full object-cover"
        style={{
          objectPosition: `${Math.round(visibleFocalPoint.x * 100)}% ${Math.round(visibleFocalPoint.y * 100)}%`,
        }}
        draggable={false}
        onError={onImageError}
      />
    );
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-muted">
      {imageError ? <AlertCircle className="size-6 text-muted-foreground/50" /> : null}
    </div>
  );
}

function BannerEditToolbar({
  visibleBannerUrl,
  isSaving,
  onOpenImageDialog,
  onRemoveBanner,
  onCancel,
  onSave,
}: {
  visibleBannerUrl: string | null | undefined;
  isSaving: boolean;
  onOpenImageDialog: () => void;
  onRemoveBanner: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <>
      <div className="absolute left-3 top-3 flex items-center gap-1.5">
        <Button variant="secondary" size="sm" onClick={onOpenImageDialog}>
          <ImagePlus data-icon="inline-start" />
          {visibleBannerUrl ? "Change" : "Add banner"}
        </Button>
        {visibleBannerUrl ? (
          <Button variant="secondary" size="icon-sm" aria-label="Remove banner" onClick={onRemoveBanner}>
            <Trash2 />
          </Button>
        ) : null}
        {visibleBannerUrl ? (
          <span className="pointer-events-none hidden items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-1 text-xs backdrop-blur-sm sm:flex">
            <Move className="size-3" /> Drag to reposition
          </span>
        ) : null}
      </div>
      <div className="absolute right-3 top-3 flex items-center gap-1.5">
        <Button variant="secondary" size="icon-sm" aria-label="Cancel edits" onClick={onCancel}>
          <X />
        </Button>
        <Button size="sm" disabled={isSaving} onClick={onSave}>
          <Check data-icon="inline-start" />
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </div>
    </>
  );
}

function BannerTitleCard({
  isEditing,
  draftTitle,
  onDraftTitleChange,
  formattedDate,
  draftIcon,
  onDraftIconChange,
  icon,
  title,
  isUntitled,
}: {
  isEditing: boolean;
  draftTitle: string;
  onDraftTitleChange: (value: string) => void;
  formattedDate: string;
  draftIcon: string;
  onDraftIconChange: (value: string) => void;
  icon?: string;
  title: string;
  isUntitled: boolean;
}) {
  return (
    <div
      className="absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] items-center gap-3 rounded-2xl border border-white/20 bg-background/85 p-3 shadow-lg backdrop-blur-md sm:bottom-4 sm:left-4"
      onMouseDown={(event) => event.stopPropagation()}
    >
      {isEditing ? (
        <IconPicker
          value={draftIcon}
          onChange={(value) => onDraftIconChange(value ?? "notebook")}
          triggerVariant="minimal"
        />
      ) : (
        <NotebookIcon name={icon} className="size-10 shrink-0 text-foreground" />
      )}
      <div className="flex min-w-0 flex-col gap-0.5 pr-1">
        {isEditing ? (
          <Input
            value={draftTitle}
            onChange={(event) => onDraftTitleChange(event.target.value)}
            maxLength={200}
            aria-label="Notebook title"
            className="h-7 min-w-0 rounded-none border-x-0 border-t-0 border-b border-transparent bg-transparent p-0 text-sm font-medium shadow-none selection:bg-primary/25 selection:text-foreground focus-visible:border-x-0 focus-visible:border-t-0 focus-visible:border-b-foreground/40 focus-visible:ring-0"
          />
        ) : (
          <span className="truncate text-sm font-medium tracking-tight">
            {isUntitled ? "Untitled Notebook" : title}
          </span>
        )}
        <span className="text-xs font-medium text-muted-foreground/80">{formattedDate}</span>
      </div>
    </div>
  );
}

interface BannerDraftState {
  title: string;
  description: string;
  icon: string;
  focalPoint: { x: number; y: number };
  previewUrl: string | null;
  bannerRemoved: boolean;
  imageError: boolean;
}

type BannerDraftAction =
  | { type: "RESET"; payload: BannerDraftState }
  | { type: "SET_TITLE"; title: string }
  | { type: "SET_DESCRIPTION"; description: string }
  | { type: "SET_ICON"; icon: string }
  | { type: "SET_FOCAL_POINT"; focalPoint: { x: number; y: number } }
  | { type: "SET_PREVIEW"; previewUrl: string }
  | { type: "REMOVE_BANNER" }
  | { type: "SET_IMAGE_ERROR"; error: boolean };

function bannerDraftReducer(
  state: BannerDraftState,
  action: BannerDraftAction,
): BannerDraftState {
  switch (action.type) {
    case "RESET":
      return action.payload;
    case "SET_TITLE":
      return { ...state, title: action.title };
    case "SET_DESCRIPTION":
      return { ...state, description: action.description };
    case "SET_ICON":
      return { ...state, icon: action.icon };
    case "SET_FOCAL_POINT":
      return { ...state, focalPoint: action.focalPoint };
    case "SET_PREVIEW":
      return {
        ...state,
        previewUrl: action.previewUrl,
        bannerRemoved: false,
        focalPoint: DEFAULT_FOCAL_POINT,
        imageError: false,
      };
    case "REMOVE_BANNER":
      return { ...state, previewUrl: null, bannerRemoved: true };
    case "SET_IMAGE_ERROR":
      return { ...state, imageError: action.error };
    default:
      return state;
  }
}

async function saveNotebookBannerChanges({
  notebookId,
  title,
  description,
  icon,
  bannerUrl,
  bannerFocalPoint,
  draft,
  bannerFile,
  queryClient,
}: {
  notebookId: string;
  title: string;
  description?: string | null;
  icon?: string;
  bannerUrl?: string | null;
  bannerFocalPoint?: { x: number; y: number } | null;
  draft: BannerDraftState;
  bannerFile: File | null;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const requests: Promise<unknown>[] = [];
  const fieldsChanged =
    draft.title !== title ||
    draft.description !== (description ?? "") ||
    draft.icon !== (icon ?? "notebook") ||
    draft.focalPoint.x !== (bannerFocalPoint?.x ?? 0.5) ||
    draft.focalPoint.y !== (bannerFocalPoint?.y ?? 0.5);

  if (fieldsChanged && !bannerFile) {
    requests.push(
      fetchApi(`/api/notebooks/${notebookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          icon: draft.icon,
          bannerFocalPoint: draft.focalPoint,
        }),
      }).then((response: Response) => {
        if (!response.ok) throw new Error("Failed to update notebook");
      }),
    );
  } else if (fieldsChanged) {
    requests.push(
      fetchApi(`/api/notebooks/${notebookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          icon: draft.icon,
        }),
      }).then((response: Response) => {
        if (!response.ok) throw new Error("Failed to update notebook");
      }),
    );
  }

  if (bannerFile) {
    const body = new FormData();
    body.append("id", notebookId);
    body.append("file", bannerFile);
    body.append("focalPointX", draft.focalPoint.x.toString());
    body.append("focalPointY", draft.focalPoint.y.toString());
    body.append("focalPoint", JSON.stringify(draft.focalPoint));
    requests.push(
      fetchApi(`/api/notebooks/${notebookId}/banner`, { method: "POST", body }).then(
        (response: Response) => {
          if (!response.ok) throw new Error("Failed to upload banner");
        },
      ),
    );
  } else if (draft.bannerRemoved && bannerUrl) {
    requests.push(
      fetchApi(`/api/notebooks/${notebookId}/banner`, { method: "DELETE" }).then(
        (response: Response) => {
          if (!response.ok) throw new Error("Failed to remove banner");
        },
      ),
    );
  }

  await Promise.all(requests);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["notebooks", notebookId] }),
    queryClient.invalidateQueries({ queryKey: ["notebooks"] }),
  ]);
}

interface BannerCanvasProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  isEditing: boolean;
  visibleBannerUrl: string | null;
  visibleFocalPoint: { x: number; y: number };
  imageError: boolean;
  onImageError: () => void;
  focalPointDrag: ReturnType<typeof useBannerFocalPointDrag>;
  onKeyDown: (e: React.KeyboardEvent) => void;
  isSaving: boolean;
  onOpenImageDialog: () => void;
  onRemoveBanner: () => void;
  onCancel: () => void;
  onSave: () => void;
  onBeginEditing: () => void;
  draftTitle: string;
  onDraftTitleChange: (val: string) => void;
  formattedDate: string;
  draftIcon: string;
  onDraftIconChange: (val: string) => void;
  icon?: string;
  title: string;
  isUntitled: boolean;
}

function BannerCanvas({
  containerRef,
  isEditing,
  visibleBannerUrl,
  visibleFocalPoint,
  imageError,
  onImageError,
  focalPointDrag,
  onKeyDown,
  isSaving,
  onOpenImageDialog,
  onRemoveBanner,
  onCancel,
  onSave,
  onBeginEditing,
  draftTitle,
  onDraftTitleChange,
  formattedDate,
  draftIcon,
  onDraftIconChange,
  icon,
  title,
  isUntitled,
}: BannerCanvasProps) {
  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Notebook banner"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseDown={focalPointDrag.handleMouseDown}
      onMouseMove={focalPointDrag.handleMouseMove}
      onMouseUp={focalPointDrag.stopDragging}
      onMouseLeave={focalPointDrag.stopDragging}
      className={cn(
        "relative aspect-3/1 w-full overflow-hidden rounded-4xl border border-border bg-muted select-none outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isEditing &&
          visibleBannerUrl &&
          (focalPointDrag.isDragging ? "cursor-grabbing" : "cursor-grab"),
      )}
    >
      <BannerImage
        visibleBannerUrl={visibleBannerUrl && !imageError ? visibleBannerUrl : null}
        visibleFocalPoint={visibleFocalPoint}
        imageError={imageError}
        onImageError={onImageError}
      />

      {isEditing ? (
        <BannerEditToolbar
          visibleBannerUrl={visibleBannerUrl}
          isSaving={isSaving}
          onOpenImageDialog={onOpenImageDialog}
          onRemoveBanner={onRemoveBanner}
          onCancel={onCancel}
          onSave={onSave}
        />
      ) : (
        <Button
          variant="secondary"
          size="icon-sm"
          onClick={onBeginEditing}
          aria-label="Edit notebook"
          title="Edit notebook"
          className="absolute right-3 top-3 bg-background/80 opacity-0 shadow-sm backdrop-blur-sm transition-[opacity,background-color] hover:bg-background group-hover/header:opacity-100 group-focus-within/header:opacity-100"
        >
          <Pencil />
        </Button>
      )}

      <BannerTitleCard
        isEditing={isEditing}
        draftTitle={draftTitle}
        onDraftTitleChange={onDraftTitleChange}
        formattedDate={formattedDate}
        draftIcon={draftIcon}
        onDraftIconChange={onDraftIconChange}
        icon={icon}
        title={title}
        isUntitled={isUntitled}
      />
    </div>
  );
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
      new Date(updatedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    [updatedAt],
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
      toast.error("Title is required");
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
      toast.success("Notebook updated");
      setIsEditing(false);
      bannerFileRef.current = null;
      dispatch({ type: "RESET", payload: createInitialDraft() });
    } catch {
      toast.error("Failed to update notebook");
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
        onDraftTitleChange={(title) => dispatch({ type: "SET_TITLE", title })}
        formattedDate={formattedDate}
        draftIcon={draft.icon}
        onDraftIconChange={(icon) => dispatch({ type: "SET_ICON", icon })}
        icon={icon}
        title={title}
        isUntitled={isUntitled}
      />

      <NotebookDescription
        description={isEditing ? draft.description : (description ?? "")}
        isEditing={isEditing}
        onChange={(description) => dispatch({ type: "SET_DESCRIPTION", description })}
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
