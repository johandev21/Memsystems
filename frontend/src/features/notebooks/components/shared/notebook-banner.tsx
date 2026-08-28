import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, ImagePlus, Move, Pencil, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [imageError, setImageError] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftDescription, setDraftDescription] = useState(description ?? "");
  const [draftIcon, setDraftIcon] = useState(icon ?? "notebook");
  const [draftFocalPoint, setDraftFocalPoint] = useState(bannerFocalPoint ?? DEFAULT_FOCAL_POINT);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [bannerRemoved, setBannerRemoved] = useState(false);

  const resetDraft = useCallback(() => {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setDraftTitle(title);
    setDraftDescription(description ?? "");
    setDraftIcon(icon ?? "notebook");
    setDraftFocalPoint(bannerFocalPoint ?? DEFAULT_FOCAL_POINT);
    setBannerFile(null);
    setPreviewUrl(null);
    setBannerRemoved(false);
    setImageError(false);
  }, [bannerFocalPoint, description, icon, previewUrl, title]);

  const beginEditing = useCallback(() => {
    resetDraft();
    setIsEditing(true);
  }, [resetDraft]);

  useEffect(() => {
    const handleEditRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ notebookId?: string }>).detail;
      if (detail?.notebookId === notebookId) beginEditing();
    };
    window.addEventListener(EDIT_NOTEBOOK_EVENT, handleEditRequest);
    return () => window.removeEventListener(EDIT_NOTEBOOK_EVENT, handleEditRequest);
  }, [beginEditing, notebookId]);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const formattedDate = useMemo(
    () =>
      new Date(updatedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    [updatedAt],
  );

  const visibleBannerUrl = bannerRemoved ? null : (previewUrl ?? bannerUrl);
  const visibleFocalPoint = isEditing ? draftFocalPoint : (bannerFocalPoint ?? DEFAULT_FOCAL_POINT);
  const focalPointDrag = useBannerFocalPointDrag({
    enabled: isEditing && !!visibleBannerUrl,
    focalPoint: draftFocalPoint,
    onChange: setDraftFocalPoint,
  });

  const handleSelectFile = (file: File) => {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setBannerFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setBannerRemoved(false);
    setDraftFocalPoint(DEFAULT_FOCAL_POINT);
    setImageError(false);
  };

  const handleCancel = () => {
    resetDraft();
    setIsEditing(false);
  };

  const handleSave = async () => {
    const trimmedTitle = draftTitle.trim();
    if (!trimmedTitle) {
      toast.error("Title is required");
      return;
    }
    setIsSaving(true);
    try {
      const requests: Promise<unknown>[] = [];
      const fieldsChanged =
        trimmedTitle !== title ||
        draftDescription !== (description ?? "") ||
        draftIcon !== (icon ?? "notebook") ||
        draftFocalPoint.x !== (bannerFocalPoint?.x ?? 0.5) ||
        draftFocalPoint.y !== (bannerFocalPoint?.y ?? 0.5);

      if (fieldsChanged && !bannerFile) {
        requests.push(
          fetchApi(`/api/notebooks/${notebookId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: trimmedTitle,
              description: draftDescription,
              icon: draftIcon,
              bannerFocalPoint: draftFocalPoint,
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
              title: trimmedTitle,
              description: draftDescription,
              icon: draftIcon,
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
        body.append("focalPointX", draftFocalPoint.x.toString());
        body.append("focalPointY", draftFocalPoint.y.toString());
        body.append("focalPoint", JSON.stringify(draftFocalPoint));
        requests.push(
          fetchApi(`/api/notebooks/${notebookId}/banner`, { method: "POST", body }).then(
            (response: Response) => {
              if (!response.ok) throw new Error("Failed to upload banner");
            },
          ),
        );
      } else if (bannerRemoved && bannerUrl) {
        requests.push(
          fetchApi(`/api/notebooks/${notebookId}/banner`, { method: "DELETE" }).then((response: Response) => {
            if (!response.ok) throw new Error("Failed to remove banner");
          }),
        );
      }

      await Promise.all(requests);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notebooks", notebookId] }),
        queryClient.invalidateQueries({ queryKey: ["notebooks"] }),
      ]);
      toast.success("Notebook updated");
      setIsEditing(false);
      setBannerFile(null);
      setPreviewUrl(null);
      setBannerRemoved(false);
    } catch {
      toast.error("Failed to update notebook");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="group/header mb-6 flex flex-col gap-3">
      <div
        ref={focalPointDrag.containerRef}
        tabIndex={0}
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
        {visibleBannerUrl && !imageError ? (
          <img
            src={visibleBannerUrl}
            alt=""
            className="pointer-events-none absolute inset-0 size-full object-cover"
            style={{
              objectPosition: `${Math.round(visibleFocalPoint.x * 100)}% ${Math.round(visibleFocalPoint.y * 100)}%`,
            }}
            draggable={false}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            {imageError ? <AlertCircle className="size-6 text-muted-foreground/50" /> : null}
          </div>
        )}

        {isEditing ? (
          <>
            <div className="absolute left-3 top-3 flex items-center gap-1.5">
              <Button variant="secondary" size="sm" onClick={() => setImageDialogOpen(true)}>
                <ImagePlus data-icon="inline-start" />
                {visibleBannerUrl ? "Change" : "Add banner"}
              </Button>
              {visibleBannerUrl ? (
                <Button
                  variant="secondary"
                  size="icon-sm"
                  aria-label="Remove banner"
                  onClick={() => {
                    setBannerFile(null);
                    setPreviewUrl(null);
                    setBannerRemoved(true);
                  }}
                >
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
              <Button
                variant="secondary"
                size="icon-sm"
                aria-label="Cancel edits"
                onClick={handleCancel}
              >
                <X />
              </Button>
              <Button size="sm" disabled={isSaving} onClick={handleSave}>
                <Check data-icon="inline-start" />
                {isSaving ? "Saving…" : "Save"}
              </Button>
            </div>
          </>
        ) : (
          <Button
            variant="secondary"
            size="icon-sm"
            onClick={beginEditing}
            aria-label="Edit notebook"
            title="Edit notebook"
            className="absolute right-3 top-3 bg-background/80 opacity-0 shadow-sm backdrop-blur-sm transition-[opacity,background-color] hover:bg-background group-hover/header:opacity-100 group-focus-within/header:opacity-100"
          >
            <Pencil />
          </Button>
        )}

        <div
          className="absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] items-center gap-3 rounded-2xl border border-white/20 bg-background/85 p-3 shadow-lg backdrop-blur-md sm:bottom-4 sm:left-4"
          onMouseDown={(event) => event.stopPropagation()}
        >
          {isEditing ? (
            <IconPicker
              value={draftIcon}
              onChange={(value) => setDraftIcon(value ?? "notebook")}
              triggerVariant="minimal"
            />
          ) : (
            <NotebookIcon name={icon} className="size-10 shrink-0 text-foreground" />
          )}
          <div className="flex min-w-0 flex-col gap-0.5 pr-1">
            {isEditing ? (
              <Input
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
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
      </div>

      <NotebookDescription
        description={isEditing ? draftDescription : (description ?? "")}
        isEditing={isEditing}
        onChange={setDraftDescription}
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
