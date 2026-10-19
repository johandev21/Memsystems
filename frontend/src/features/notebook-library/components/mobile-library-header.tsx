import { ChevronLeft } from "lucide-react";
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
}

export function MobileLibraryHeader({
  activeFolder,
  parentFolder,
  onOpenFolder,
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
      </div>
    </header>
  );
}
