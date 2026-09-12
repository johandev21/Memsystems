import { ArrowLeft, Download, ExternalLink, Loader2, Maximize2, Minimize2, MoreVertical, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SourceWithContent } from "../../types";
import type { ReaderControls } from "./source-content-types";

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
  const { t } = useTranslation("sources");
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
            aria-label={t("reader.moreActions")}
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
                aria-label={t("reader.openOriginalWebpage")}
                className="cursor-pointer"
              />
            }
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t("reader.openWebpage")}
          </DropdownMenuItem>
        )}
        {showDownload && (
          <DropdownMenuItem onClick={onDownload} disabled={downloading} className="cursor-pointer">
            {downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {t("reader.downloadFile")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface SourceReaderHeaderProps {
  source: SourceWithContent;
  controls: ReaderControls;
  forceFullscreen?: boolean;
  onClose: () => void;
}

export function SourceReaderHeader({
  source,
  controls,
  forceFullscreen,
  onClose,
}: SourceReaderHeaderProps) {
  const { t } = useTranslation("sources");
  return (
    <div className="flex items-center justify-between gap-2 p-1.5 bg-panel-header-bg min-h-[44px] shrink-0 select-none">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg shrink-0"
          aria-label={t("reader.backToSources")}
          title={t("reader.backToSources")}
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
          downloading={controls.downloading}
          onDownload={controls.handleDownload}
          isFullscreen={controls.isEffectivelyFullscreen}
        />
        {!forceFullscreen && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={controls.toggleFullscreen}
            className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg"
            title={controls.isFullscreen ? t("reader.exitFullscreen") : t("reader.fullscreenMode")}
          >
            {controls.isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        )}
        {controls.isEffectivelyFullscreen && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg"
            title={t("reader.close")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
