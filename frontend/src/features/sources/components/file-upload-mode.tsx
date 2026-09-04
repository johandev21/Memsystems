import { Link as LinkIcon, Loader2, Type, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

import {
  ACCEPTED_SOURCE_EXTENSIONS,
  ACCEPTED_SOURCE_MIME_TYPES,
  isClientSupportedSourceFile,
} from "../utils";

interface FileUploadModeProps {
  onSelectUrlMode: () => void;
  onSelectTextMode: () => void;
  onUploadFile: (file: File) => void;
  isUploading: boolean;
  busy: boolean;
}

export function FileUploadMode({
  onSelectUrlMode,
  onSelectTextMode,
  onUploadFile,
  isUploading,
  busy,
}: FileUploadModeProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (busy) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!isClientSupportedSourceFile(file)) {
        toast.error("Unsupported file type. Use PDF, DOCX, TXT, Markdown, Images, Audio, Video, PPTX, EPUB, TeX, or BibTeX files.");
        return;
      }
      onUploadFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragEnter = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const openFileDialog = () => fileInputRef.current?.click();

  const handleDragLeave = (e: React.DragEvent<HTMLElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!isClientSupportedSourceFile(file)) {
        toast.error("Unsupported file type. Use PDF, DOCX, TXT, Markdown, Images, Audio, Video, PPTX, EPUB, TeX, or BibTeX files.");
        e.target.value = "";
        return;
      }
      onUploadFile(file);
    }
    e.target.value = "";
  };

  return (
    <div
      className={`relative flex flex-col items-center justify-center border-2 border-dashed py-10 px-6 rounded-xl ${
        isDragging
          ? "border-primary bg-primary/5"
          : "border-border/60 bg-muted/20 hover:bg-primary/5 hover:border-primary/40"
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_SOURCE_EXTENSIONS.join(",") + "," + ACCEPTED_SOURCE_MIME_TYPES.join(",")}
        className="hidden"
        onChange={handleFileChange}
      />

      <h3 className="mb-1.5 flex items-center gap-2 text-lg font-medium text-foreground">
        {isUploading && <Loader2 className="size-4 animate-spin text-primary" />}
        {isUploading ? "Uploading file..." : "Drop your files here"}
      </h3>
      <p className="text-xs text-muted-foreground mb-4 text-center max-w-[340px]">
        Supports PDF, DOCX, TXT, Markdown, Images, Audio, Video, Presentations, eBooks, LaTeX, and BibTeX.
      </p>

      <div className="flex flex-wrap justify-center gap-2.5 w-full relative z-10">
        <Button
          type="button"
          variant="outline"
          className="h-10 cursor-pointer bg-background px-5 transition-none active:translate-y-0 hover:bg-muted/50"
          onClick={openFileDialog}
          disabled={busy}
        >
          <Upload className="h-4 w-4 mr-2 text-muted-foreground" />
          Upload Files
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10 cursor-pointer bg-background px-5 transition-none active:translate-y-0 hover:bg-muted/50"
          onClick={onSelectUrlMode}
          disabled={busy}
        >
          <LinkIcon className="h-4 w-4 mr-2 text-info" />
          Websites
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10 cursor-pointer bg-background px-5 transition-none active:translate-y-0 hover:bg-muted/50"
          onClick={onSelectTextMode}
          disabled={busy}
        >
          <Type className="h-4 w-4 mr-2 text-warning" />
          Copied Text
        </Button>
      </div>

      <button
        type="button"
        aria-label="Upload a file"
        onClick={openFileDialog}
        disabled={busy}
        className="absolute inset-0 z-0 cursor-pointer disabled:cursor-progress"
      />
    </div>
  );
}
