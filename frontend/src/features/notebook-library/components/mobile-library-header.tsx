import { ChevronLeft, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LibrarySortKey } from "../model/library-sort";
import type { LibraryFolder } from "../model/types";

export interface MobileLibraryHeaderProps {
  activeFolder?: LibraryFolder;
  parentFolder?: LibraryFolder | null;
  sortKey?: LibrarySortKey;
  sortOptions?: { value: LibrarySortKey; label: string; description: string }[];
  onSortChange?: (sortKey: LibrarySortKey) => void;
  onOpenFolder: (id: string | null) => void;
  onOpenTrash?: () => void;
}

export function MobileLibraryHeader({
  activeFolder,
  parentFolder,
  onOpenFolder,
  onOpenTrash,
}: MobileLibraryHeaderProps) {
  const { t } = useTranslation("notebooks");

  return (
    <header className="sticky top-0 z-20 relative flex flex-col pt-5 bg-background/95 backdrop-blur-xs w-full">
      {activeFolder && (
        <button
          type="button"
          onClick={() => onOpenFolder(parentFolder?.id ?? null)}
          className="group absolute top-0 left-0 inline-flex w-fit items-center gap-1 text-xs font-normal leading-none text-muted-foreground transition-colors hover:text-foreground active:scale-97 touch-manipulation cursor-pointer select-none after:absolute after:-inset-2 after:content-['']"
          aria-label={t("library.back", "Back")}
        >
          <ChevronLeft className="size-3 shrink-0 transition-transform group-hover:-translate-x-0.5" />
          <span className="max-w-48 truncate" aria-hidden="true" dir="auto">
            {parentFolder?.name ?? t("library.library")}
          </span>
        </button>
      )}

      <div className="flex items-center justify-between gap-3 min-w-0">
        <h1
          dir="auto"
          className="text-base font-medium leading-snug text-foreground min-w-0 line-clamp-2 break-words [overflow-wrap:anywhere]"
        >
          {activeFolder ? activeFolder.name : t("library.library")}
        </h1>
        {onOpenTrash && (
          <button
            type="button"
            onClick={onOpenTrash}
            aria-label="Trash"
            className="flex items-center gap-1.5 h-7 px-2 rounded-lg text-xs font-medium cursor-pointer text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors active:scale-97 select-none touch-manipulation shrink-0"
          >
            <Trash2 className="size-3.5" />
            <span>Trash</span>
          </button>
        )}
      </div>
    </header>
  );
}

