import { AlertCircle, Check, ImagePlus, Move, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import type React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { IconPicker } from "@/components/ui/icon-picker";
import { Input } from "@/components/ui/input";
import { NotebookIcon } from "../notebook-icon";
import type { useBannerFocalPointDrag } from "../../hooks/use-banner-focal-point-drag";
import { buildBannerSrcSet } from "../../utils/banner-variants";
import { cn } from "@/shared/utils/cn";

export interface BannerCanvasProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  isEditing: boolean;
  visibleBannerUrl: string | null;
  visibleBannerVariants?: { w480: string | null; w960: string | null; w1920: string | null } | null;
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

export function BannerImage({
  visibleBannerUrl,
  visibleBannerVariants,
  visibleFocalPoint,
  imageError,
  onImageError,
}: {
  visibleBannerUrl: string | null | undefined;
  visibleBannerVariants?: { w480: string | null; w960: string | null; w1920: string | null } | null;
  visibleFocalPoint: { x: number; y: number };
  imageError: boolean;
  onImageError: () => void;
}) {
  // Keyed by URL so a changed banner (e.g. an edit preview) fades in again
  // instead of reusing the previous image's "loaded" state.
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const isLoaded = loadedUrl === visibleBannerUrl;

  if (visibleBannerUrl && !imageError) {
    return (
      <img
        src={visibleBannerUrl}
        srcSet={buildBannerSrcSet(visibleBannerVariants)}
        sizes="(min-width: 928px) 896px, 100vw"
        alt=""
        className={cn(
          "pointer-events-none absolute inset-0 size-full object-cover transition-opacity duration-200 motion-reduce:transition-none",
          isLoaded ? "opacity-100" : "opacity-0",
        )}
        style={{
          objectPosition: `${Math.round(visibleFocalPoint.x * 100)}% ${Math.round(visibleFocalPoint.y * 100)}%`,
        }}
        draggable={false}
        fetchPriority="high"
        decoding="async"
        ref={(element) => {
          if (element?.complete && element.naturalWidth > 0) setLoadedUrl(visibleBannerUrl);
        }}
        onLoad={() => setLoadedUrl(visibleBannerUrl)}
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

export function BannerEditToolbar({
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
  const { t } = useTranslation("notebooks");

  return (
    <>
      <div className="absolute left-3 top-3 flex items-center gap-1.5">
        <Button variant="secondary" size="sm" onClick={onOpenImageDialog}>
          <ImagePlus data-icon="inline-start" />
          {visibleBannerUrl ? t("banner.change") : t("banner.add")}
        </Button>
        {visibleBannerUrl ? (
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label={t("banner.remove")}
            onClick={onRemoveBanner}
          >
            <Trash2 />
          </Button>
        ) : null}
        {visibleBannerUrl ? (
          <span className="pointer-events-none hidden items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-1 text-xs backdrop-blur-sm sm:flex">
            <Move className="size-3" /> {t("banner.dragToReposition")}
          </span>
        ) : null}
      </div>
      <div className="absolute right-3 top-3 flex items-center gap-1.5">
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label={t("banner.cancelEdits")}
          onClick={onCancel}
        >
          <X />
        </Button>
        <Button size="sm" disabled={isSaving} onClick={onSave}>
          <Check data-icon="inline-start" />
          {isSaving ? t("banner.saving") : t("banner.save")}
        </Button>
      </div>
    </>
  );
}

export function BannerTitleCard({
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
  const { t } = useTranslation("notebooks");

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
            aria-label={t("banner.titleAria")}
            className="h-7 min-w-0 rounded-none border-x-0 border-t-0 border-b border-transparent bg-transparent p-0 text-sm font-medium shadow-none selection:bg-primary/25 selection:text-foreground focus-visible:border-x-0 focus-visible:border-t-0 focus-visible:border-b-foreground/40 focus-visible:ring-0"
          />
        ) : (
          <span className="truncate text-sm font-medium tracking-tight">
            {isUntitled ? t("banner.untitledNotebook") : title}
          </span>
        )}
        <span className="text-xs font-medium text-muted-foreground/80">{formattedDate}</span>
      </div>
    </div>
  );
}

export function BannerCanvas({
  containerRef,
  isEditing,
  visibleBannerUrl,
  visibleBannerVariants,
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
  const { t } = useTranslation("notebooks");

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={t("banner.canvas")}
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
        visibleBannerVariants={visibleBannerVariants}
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
          aria-label={t("banner.editNotebook")}
          title={t("banner.editNotebook")}
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
