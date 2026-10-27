import type { ReactNode } from "react";
import { Folder } from "lucide-react";

export interface MobileFolderTileViewProps {
  name: string;
  itemCountLabel: string;
  onOpen: () => void;
  actions: ReactNode;
}

export function MobileFolderTileView({
  name,
  itemCountLabel,
  onOpen,
  actions,
}: MobileFolderTileViewProps) {
  return (
    <li
      data-slot="mobile-folder-tile"
      className="flex w-full items-center rounded-xl transition-colors duration-150 ease-out active:bg-muted/60 select-none"
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-3 py-2 pl-3 text-left touch-manipulation"
      >
        <Folder className="size-5 shrink-0 text-primary/70" strokeWidth={1.7} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
            {name}
          </span>
          <span className="text-xs text-muted-foreground">{itemCountLabel}</span>
        </span>
      </button>
      {actions}
    </li>
  );
}
