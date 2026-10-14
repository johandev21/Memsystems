import { Folder, MoreVertical, Notebook } from "lucide-react";
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
      data-slot="mobile-folder-tile"
      className="group relative flex w-full items-center justify-between text-text-secondary select-none"
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-2 text-left text-current transition-opacity active:opacity-70 touch-manipulation cursor-pointer"
      >
        <Folder className="size-8 shrink-0 text-current" />
        <span dir="auto" className="min-w-0 flex-1 truncate text-sm font-normal leading-5 text-current">
          {folder.name}
        </span>
      </button>

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
        className="relative flex size-5 shrink-0 items-center justify-center rounded-md text-current transition-opacity active:opacity-70 touch-manipulation cursor-pointer after:absolute after:-inset-2 after:content-['']"
      >
        <MoreVertical className="size-5 text-current" />
      </button>
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
      data-slot="mobile-notebook-tile"
      className="group relative flex w-full items-center justify-between text-text-secondary select-none"
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-2 text-left text-current transition-opacity active:opacity-70 touch-manipulation cursor-pointer"
      >
        {notebook.coverUrl ? (
          <div className="h-8 aspect-10/7 shrink-0 overflow-hidden rounded-xs bg-muted">
            <img src={notebook.coverUrl} alt="" className="size-full object-cover" />
          </div>
        ) : (
          <Notebook className="size-8 shrink-0 text-current" />
        )}
        <span dir="auto" className="min-w-0 flex-1 truncate text-sm font-normal leading-5 text-current">
          {notebook.title}
        </span>
      </button>

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
        className="relative flex size-5 shrink-0 items-center justify-center rounded-md text-current transition-opacity active:opacity-70 touch-manipulation cursor-pointer after:absolute after:-inset-2 after:content-['']"
      >
        <MoreVertical className="size-5 text-current" />
      </button>
    </div>
  );
}

