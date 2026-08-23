import { ImageIcon, Move, Trash2, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/shared/ui/button";
import { IconPicker } from "@/shared/ui/icon-picker";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/lib/utils";

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
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const bannerContainerRef = useRef<HTMLDivElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    initialX: number;
    initialY: number;
  } | null>(null);

  const formattedDate = useMemo(() => {
    const date = createdAt ? new Date(createdAt) : new Date();
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [createdAt]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!bannerPreviewUrl) return;
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialX: focalPoint.x,
      initialY: focalPoint.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStartRef.current || !bannerContainerRef.current) return;
    const rect = bannerContainerRef.current.getBoundingClientRect();

    const deltaX = (e.clientX - dragStartRef.current.mouseX) / rect.width;
    const deltaY = (e.clientY - dragStartRef.current.mouseY) / rect.height;

    const newX = Math.max(0, Math.min(1, dragStartRef.current.initialX - deltaX));
    const newY = Math.max(0, Math.min(1, dragStartRef.current.initialY - deltaY));

    setFocalPoint({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-sm transition-all",
        className,
      )}
    >
      <div
        ref={bannerContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={cn(
          "group relative h-52 sm:h-60 w-full overflow-hidden rounded-2xl border border-border bg-muted/60 select-none",
          bannerPreviewUrl ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-default",
        )}
      >
        {bannerPreviewUrl ? (
          <>
            <img
              src={bannerPreviewUrl}
              alt="Notebook Banner Preview"
              className="h-full w-full object-cover pointer-events-none transition-all duration-75"
              style={{
                objectPosition: `${Math.round(focalPoint.x * 100)}% ${Math.round(focalPoint.y * 100)}%`,
              }}
            />

            <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-foreground bg-card/70 backdrop-blur-md">
              <Move className="size-3" />
              <span>Drag to reposition</span>
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
                <span>Upload</span>
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
                title="Remove Banner"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-primary/10 via-muted to-accent/20 text-muted-foreground p-6 text-center">
            <ImageIcon className="size-9 stroke-1 opacity-60" />
            <div className="flex flex-col items-center gap-1">
              <p className="text-xs font-medium">No banner image set</p>
              <p className="text-xs opacity-75">Upload an image to customize your notebook</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenImageUpload}
              className="gap-1.5 rounded-full border-border bg-background shadow-xs hover:bg-muted cursor-pointer"
            >
              <Upload className="size-3.5" />
              <span>Upload Banner Image</span>
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
              placeholder="Notebook Title"
              maxLength={200}
              className="h-7 border-none bg-transparent p-0 text-base sm:text-lg font-semibold tracking-tight text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60"
            />
            <span className="text-xs text-muted-foreground/80 font-medium">{formattedDate}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 px-1">
        <Label htmlFor="notebook-description" className="text-xs font-medium text-muted-foreground">
          Description
        </Label>
        <Textarea
          id="notebook-description"
          ref={descriptionRef}
          value={description ?? ""}
          onChange={(e) => setDescription(e.target.value || null)}
          placeholder="Add a detailed description for your notebook..."
          rows={3}
          maxLength={500}
          className="border-border bg-muted/20 text-xs sm:text-sm text-foreground focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
    </div>
  );
}
