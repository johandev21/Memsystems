import { ArrowUpDown, ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LibrarySortKey } from "../model/library-sort";
import type { LibraryFolder } from "../model/types";

export interface MobileLibraryHeaderProps {
  activeFolder?: LibraryFolder;
  parentFolder?: LibraryFolder | null;
  sortKey: LibrarySortKey;
  sortOptions: { value: LibrarySortKey; label: string; description: string }[];
  onSortChange: (sortKey: LibrarySortKey) => void;
  onOpenFolder: (id: string | null) => void;
}

export function MobileLibraryHeader({
  activeFolder,
  parentFolder,
  sortKey,
  sortOptions,
  onSortChange,
  onOpenFolder,
}: MobileLibraryHeaderProps) {
  const { t } = useTranslation("notebooks");

  const sortSelect = (
    <Select
      items={sortOptions}
      value={sortKey}
      onValueChange={(value) => onSortChange(value as LibrarySortKey)}
    >
      <SelectTrigger
        size="sm"
        className="h-8 gap-1.5 rounded-full px-2.5 text-xs touch-manipulation shrink-0"
        aria-label={t("library.sort.aria")}
      >
        <ArrowUpDown className="size-3.5" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="w-56" align="end">
        {sortOptions.map((option) => (
          <SelectItem key={option.value} value={option.value} className="items-start py-2">
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.description}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <header className="sticky top-0 z-20 flex flex-col gap-2 bg-background/95 pb-2 pt-1.5 backdrop-blur-xs w-full">
      {activeFolder ? (
        <>
          <div className="flex items-center justify-between gap-2 w-full">
            <button
              type="button"
              onClick={() => onOpenFolder(parentFolder?.id ?? null)}
              className="group inline-flex items-center gap-1.5 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground active:scale-97 touch-manipulation cursor-pointer"
              aria-label={t("library.back", "Back")}
            >
              <ChevronLeft className="size-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
              <span className="max-w-[180px] truncate" aria-hidden="true">
                {parentFolder?.name ?? t("library.library")}
              </span>
            </button>

            {sortSelect}
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground truncate">
            {activeFolder.name}
          </h1>
        </>
      ) : (
        <div className="flex items-center justify-between gap-2 w-full">
          <h1 className="text-2xl font-bold tracking-tight text-foreground truncate">
            {t("library.library")}
          </h1>

          {sortSelect}
        </div>
      )}
    </header>
  );
}
