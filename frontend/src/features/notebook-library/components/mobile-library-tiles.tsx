import { Folder, MoreVertical, NotebookText } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LibraryFolder, LibraryNotebook } from "../model/types";

export interface MobileFolderTileProps {
  folder: LibraryFolder;
  onOpen: () => void;
  onActions: () => void;
}

export function MobileFolderTile({ folder, onOpen, onActions }: MobileFolderTileProps) {
  const { t } = useTranslation("notebooks");
  return (
    <div
      role="listitem"
      className="group relative flex w-full items-center justify-between rounded-2xl border border-border/20 bg-card p-3 shadow-2xs transition-transform transition-colors hover:bg-muted/40 active:scale-95 duration-150 ease-out touch-manipulation select-none"
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer"
      >
        <Folder className="size-10 shrink-0 text-primary/70 fill-primary/15" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-base font-medium leading-snug text-foreground">
            {folder.name}
          </span>
          <span className="text-xs text-muted-foreground">{t("library.folder")}</span>
        </div>
      </button>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onActions();
          }}
          aria-label={t("library.itemActions", {
            name: folder.name,
            defaultValue: `Actions for ${folder.name}`,
          })}
          className="flex size-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-transform touch-manipulation cursor-pointer"
        >
          <MoreVertical className="size-4" />
        </button>
      </div>
    </div>
  );
}

export interface MobileNotebookTileProps {
  notebook: LibraryNotebook;
  onOpen: () => void;
  onActions: () => void;
}

export function MobileNotebookTile({ notebook, onOpen, onActions }: MobileNotebookTileProps) {
  const { t } = useTranslation("notebooks");
  return (
    <div
      role="listitem"
      className="group relative flex w-full items-center justify-between rounded-2xl border border-border/20 bg-card p-3 shadow-2xs transition-transform transition-colors hover:bg-muted/40 active:scale-95 duration-150 ease-out touch-manipulation select-none"
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer"
      >
        <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-muted-foreground">
          {notebook.coverUrl ? (
            <img src={notebook.coverUrl} alt="" className="size-full object-cover" />
          ) : (
            <NotebookText className="size-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-base font-medium leading-snug text-foreground">
            {notebook.title}
          </span>
          <span className="text-xs text-muted-foreground">{t("library.notebook")}</span>
        </div>
      </button>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onActions();
          }}
          aria-label={t("library.itemActions", {
            name: notebook.title,
            defaultValue: `Actions for ${notebook.title}`,
          })}
          className="flex size-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-transform touch-manipulation cursor-pointer"
        >
          <MoreVertical className="size-4" />
        </button>
      </div>
    </div>
  );
}
