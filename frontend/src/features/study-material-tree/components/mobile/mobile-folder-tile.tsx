import { Folder, MoreVertical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MobileTileActionsButton, MOBILE_TILE_CLASS } from "./mobile-tile-parts";

export interface MobileFolderTileProps {
  name: string;
  itemCount: number;
  onOpen: () => void;
  onActions: () => void;
}

export function MobileFolderTile({ name, itemCount, onOpen, onActions }: MobileFolderTileProps) {
  const { t } = useTranslation(["sources", "tree"]);

  return (
    <div role="listitem" data-slot="mobile-folder-tile" className={MOBILE_TILE_CLASS}>
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
          <span className="text-xs text-muted-foreground">
            {t("sources:mobile.itemCount", { count: itemCount })}
          </span>
        </span>
      </button>
      <MobileTileActionsButton
        label={t("tree:row.actionsFor", { name })}
        icon={MoreVertical}
        onClick={onActions}
      />
    </div>
  );
}
