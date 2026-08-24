import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  File,
  Loader2,
  Maximize2,
  Minimize2,
  MoreVertical,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { sourceQueryOptions, type SourceWithContent } from "@/shared/api/sources";
import { cn, fetchApi } from "@/shared/lib/utils";
import {
  ArticleDocumentViewer,
  CodeDocumentViewer,
  detectDocumentType,
  MarkdownDocumentViewer,
  PlainTextDocumentViewer,
} from "./renderers";

interface SourceContentViewerProps {
  sourceId: string;
  onClose: () => void;
  defaultFullscreen?: boolean;
  forceFullscreen?: boolean;
}

function ReaderMoreMenu({
  source,
  downloading,
  onDownload,
  isFullscreen,
}: {
  source: SourceWithContent;
  downloading: boolean;
  onDownload: () => void;
  isFullscreen: boolean;
}) {
  const showWebpage = source.kind === "url" && !!source.url;
  const showDownload = source.kind === "file";

  if (!showWebpage && !showDownload) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label="More actions"
          />
        }
      >
        <MoreVertical className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        layerClassName={isFullscreen ? "z-viewer-popover" : undefined}
        className="w-48"
      >
        {showWebpage && (
          <DropdownMenuItem
            render={
              <a
                href={source.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer"
              />
            }
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open Webpage
          </DropdownMenuItem>
        )}
        {showDownload && (
          <DropdownMenuItem onClick={onDownload} disabled={downloading} className="cursor-pointer">
            {downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Download File
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SourceContentViewer({
  sourceId,
  onClose,
  defaultFullscreen,
  forceFullscreen,
}: SourceContentViewerProps) {
  const { data: source, isPending, isError } = useQuery(sourceQueryOptions(sourceId));

  const [downloading, setDownloading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(() =>
    Boolean(defaultFullscreen || forceFullscreen),
  );
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const isEffectivelyFullscreen = forceFullscreen || isFullscreen;

  useEffect(() => {
    if (!isEffectivelyFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (forceFullscreen) {
          onClose();
        } else {
          setIsFullscreen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEffectivelyFullscreen, forceFullscreen, onClose]);

  const handleDownload = async () => {
    if (!source || source.kind !== "file") return;
    setDownloading(true);
    try {
      const res = await fetchApi(`/api/sources/${source.id}/download`);
      if (!res.ok) throw new Error("Failed to retrieve download link");
      const { url } = await res.json();
      window.open(url, "_blank");
      toast.success("Download started");
    } catch {
      toast.error("Download failed");
    } finally {
      setDownloading(false);
    }
  };

  if (isPending) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-muted-foreground animate-pulse">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm font-medium">Loading document reader...</p>
      </div>
    );
  }

  if (isError || !source) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
          <File className="size-6" />
        </div>
        <h2 className="text-lg font-bold">Failed to load document</h2>
        <p className="max-w-xs text-xs text-muted-foreground">
          Unable to load source details. Please try again.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          className="mt-2 cursor-pointer text-xs"
        >
          Back to Sources
        </Button>
      </div>
    );
  }

  const docType = detectDocumentType(source);

  const header = (
    <div className="flex items-center justify-between gap-2 p-1.5 bg-panel-header-bg min-h-[44px] shrink-0 select-none">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg shrink-0"
          aria-label="Back to sources"
          title="Back to sources"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-sm font-semibold truncate text-foreground min-w-0 flex-1">
          {source.title}
        </h3>
      </div>

      <div className="flex items-center gap-1">
        <ReaderMoreMenu
          source={source}
          downloading={downloading}
          onDownload={handleDownload}
          isFullscreen={isEffectivelyFullscreen}
        />
        {!forceFullscreen && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setIsFullscreen((v) => !v)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg"
            title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen Mode"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        )}
        {isEffectivelyFullscreen && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg"
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  const body = (
    <div className="flex-1 min-h-0 overflow-hidden">
      <div ref={setScrollElement} className="h-full w-full overflow-y-auto overscroll-contain">
        <div
          className={cn(
            "w-full flex flex-col",
            isEffectivelyFullscreen
              ? "px-4 sm:px-8 py-4 sm:py-6 max-w-4xl mx-auto gap-4"
              : "p-3 sm:p-4",
          )}
        >
          {docType === "markdown" && (
            <MarkdownDocumentViewer content={source.rawText} scrollElement={scrollElement} />
          )}

          {docType === "code" && (
            <CodeDocumentViewer title={source.title} content={source.rawText} />
          )}

          {docType === "article" && (
            <ArticleDocumentViewer content={source.rawText} scrollElement={scrollElement} />
          )}

          {docType === "plaintext" && <PlainTextDocumentViewer content={source.rawText} />}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={
        isEffectivelyFullscreen
          ? "fixed inset-0 z-viewer flex h-[100dvh] w-screen flex-col bg-panel-bg text-foreground overflow-hidden animate-in fade-in duration-150"
          : "flex h-full flex-col bg-panel-bg text-foreground overflow-hidden"
      }
    >
      {header}
      {body}
    </div>
  );
}
