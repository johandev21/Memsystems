import { ImageIcon, Move, Trash2, Upload } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { IconPicker } from "@/components/ui/icon-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/shared/utils/cn";
import { useBannerFocalPointDrag } from "../../hooks/use-banner-focal-point-drag";

export interface NotebookCardPreviewProps {
  title: string;
  setTitle: (value: string) => void;
  description: string | null;
  setDescription: (value: string | null) => void;
  icon: string | null;
  setIcon: (value: string | null) => void;
  bannerPreviewUrl: string | null;
  focalPoint: { x: number; y: number };
  setFocalPoint: (point: { x: number; y: number }) => void;
  createdAt?: string | Date;
  onOpenImageUpload: () => void;
  onRemoveBanner: () => void;
  className?: string;
}

export function NotebookCardPreview({
  title,
  setTitle,
  description,
  setDescription,
  icon,
  setIcon,
  bannerPreviewUrl,
  focalPoint,
  setFocalPoint,
  createdAt,
  onOpenImageUpload,
  onRemoveBanner,
  className,
}: NotebookCardPreviewProps) {
  const { t, i18n } = useTranslation("notebooks");
  const formattedDate = useMemo(() => {
    const date = createdAt ? new Date(createdAt) : new Date();
    return date.toLocaleDateString(i18n.resolvedLanguage ?? "en", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [createdAt, i18n.resolvedLanguage]);

  const focalPointDrag = useBannerFocalPointDrag({
    enabled: !!bannerPreviewUrl,
    focalPoint,
    onChange: setFocalPoint,
  });
  const handleBannerKeyDown = (e: React.KeyboardEvent) => {
    if (!bannerPreviewUrl) return;
    const STEP = 0.05;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocalPoint({ ...focalPoint, y: Math.max(0, focalPoint.y - STEP) });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocalPoint({ ...focalPoint, y: Math.min(1, focalPoint.y + STEP) });
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setFocalPoint({ ...focalPoint, x: Math.max(0, focalPoint.x - STEP) });
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setFocalPoint({ ...focalPoint, x: Math.min(1, focalPoint.x + STEP) });
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-sm transition-all",
        className,
      )}
    >
      <div
        ref={focalPointDrag.containerRef}
        role="region"
        aria-label={t("banner.previewRegion")}
        tabIndex={0}
        onKeyDown={handleBannerKeyDown}
        onMouseDown={focalPointDrag.handleMouseDown}
        onMouseMove={focalPointDrag.handleMouseMove}
        onMouseUp={focalPointDrag.stopDragging}
        onMouseLeave={focalPointDrag.stopDragging}
        className={cn(
          "group relative h-52 sm:h-60 w-full overflow-hidden rounded-2xl border border-border bg-muted/60 select-none outline-none focus-visible:ring-2 focus-visible:ring-ring",
          bannerPreviewUrl
            ? focalPointDrag.isDragging
              ? "cursor-grabbing"
              : "cursor-grab"
            : "cursor-default",
        )}
      >
        {bannerPreviewUrl ? (
          <>
            <img
              src={bannerPreviewUrl}
              alt={t("banner.previewAlt")}
              className="h-full w-full object-cover pointer-events-none transition-[object-position] duration-75"
              style={{
                objectPosition: `${Math.round(focalPoint.x * 100)}% ${Math.round(focalPoint.y * 100)}%`,
              }}
              decoding="async"
            />

            <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-foreground bg-card/70 backdrop-blur-md">
              <Move className="size-3" />
              <span>{t("banner.dragToReposition")}</span>
            </div>

            <div className="absolute top-3 right-3 flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenImageUpload();
                }}
                className="gap-1.5 cursor-pointer"
              >
                <Upload className="size-3.5" />
                <span>{t("banner.upload")}</span>
              </Button>

              <Button
                type="button"
                variant="destructive"
                size="icon-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveBanner();
                }}
                className="rounded-full cursor-pointer"
                title={t("banner.removeBanner")}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-primary/10 via-muted to-accent/20 text-muted-foreground p-6 text-center">
            <ImageIcon className="size-9 stroke-1 opacity-60" />
            <div className="flex flex-col items-center gap-1">
              <p className="text-xs font-medium">{t("banner.noImage")}</p>
              <p className="text-xs opacity-75">{t("banner.uploadHint")}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenImageUpload}
              className="gap-1.5 rounded-full border-border bg-background shadow-xs hover:bg-muted cursor-pointer"
            >
              <Upload className="size-3.5" />
              <span>{t("banner.uploadImage")}</span>
            </Button>
          </div>
        )}

        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute bottom-3 left-3 right-3 sm:right-auto flex items-center gap-3 rounded-2xl border border-white/30 bg-background/85 p-3 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-background/80"
        >
          <IconPicker
            value={icon}
            onChange={setIcon}
            className="size-10 shrink-0 border-transparent bg-transparent shadow-none hover:border-transparent hover:bg-transparent [&_svg]:size-10"
          />

          <div className="flex flex-1 flex-col gap-0.5 min-w-0 pr-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("banner.titlePlaceholder")}
              maxLength={200}
              className="h-7 border-none bg-transparent p-0 text-base sm:text-lg font-semibold tracking-tight text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60"
            />
            <span className="text-xs text-muted-foreground/80 font-medium">{formattedDate}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 px-1">
        <Label htmlFor="notebook-description" className="text-xs font-medium text-muted-foreground">
          {t("description.label")}
        </Label>
        <Textarea
          id="notebook-description"
          value={description ?? ""}
          onChange={(e) => setDescription(e.target.value || null)}
          placeholder={t("description.addDetailed")}
          rows={3}
          maxLength={500}
          className="border-border bg-muted/20 text-xs sm:text-sm text-foreground focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
    </div>
  );
}
