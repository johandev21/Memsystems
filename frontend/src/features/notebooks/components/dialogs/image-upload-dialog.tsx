import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/shared/utils/cn";

const MAX_BANNER_BYTES = 2 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export interface ImageUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectFile: (file: File) => void;
}

async function resizeBannerImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 600,
  quality = 0.85,
): Promise<File> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(file);
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => resolve(file);
      img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const resizedFile = new File([blob], file.name, {
            type: outputType,
            lastModified: Date.now(),
          });
          resolve(resizedFile);
        },
        outputType,
        quality,
      );
    };
    img.src = reader.result as string;
  };
  reader.readAsDataURL(file);
});
}

export function ImageUploadDialog({ open, onOpenChange, onSelectFile }: ImageUploadDialogProps) {
  const { t } = useTranslation("notebooks");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openFileDialog = () => fileInputRef.current?.click();

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openFileDialog();
    }
  };

  const handleFileSelect = async (file: File) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error(t("upload.unsupportedFormat", { type: file.type }));
      return;
    }
    if (file.size > MAX_BANNER_BYTES) {
      toast.error(
        t("upload.tooLarge", { size: (file.size / (1024 * 1024)).toFixed(1) }),
      );
      return;
    }
    const processedFile = await resizeBannerImage(file);
    onSelectFile(processedFile);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-6 gap-5 rounded-3xl border border-border bg-popover text-popover-foreground shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight">
            {t("upload.title")}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t("upload.description")}
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          aria-label={t("upload.inputAria")}
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
          }}
        />

        <div
          role="button"
          tabIndex={0}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={() => setIsDragging(false)}
          onClick={openFileDialog}
          onKeyDown={handleKeyDown}
          className={cn(
            "relative flex h-48 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed transition-all bg-muted/30 outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isDragging
              ? "border-primary bg-primary/5 scale-[0.99]"
              : "border-border hover:border-primary/50 hover:bg-muted/50",
          )}
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-background border border-border shadow-xs">
            <Upload className="size-5 text-foreground" />
          </div>

          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-xs font-semibold text-foreground">
              {t("upload.browseOrDrop")}
            </p>
            <p className="text-xs text-muted-foreground">{t("upload.formats")}</p>
          </div>

          <span className="mt-1 inline-flex items-center justify-center rounded-md bg-secondary text-secondary-foreground text-xs font-medium px-3 py-1.5 shadow-xs pointer-events-none">
            {t("upload.browse")}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
