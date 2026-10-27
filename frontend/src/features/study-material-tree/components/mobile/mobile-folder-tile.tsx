import { MoreVertical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MobileFolderTileView } from "@/components/ui/mobile-folder-tile";
import { MobileTileActionsButton } from "./mobile-tile-parts";

export interface MobileFolderTileProps {
  name: string;
  itemCount: number;
  onOpen: () => void;
  onActions: () => void;
}

export function MobileFolderTile({ name, itemCount, onOpen, onActions }: MobileFolderTileProps) {
  const { t } = useTranslation(["sources", "tree"]);

  return (
    <MobileFolderTileView
      name={name}
      itemCountLabel={t("sources:mobile.itemCount", { count: itemCount })}
      onOpen={onOpen}
      actions={
        <MobileTileActionsButton
          label={t("tree:row.actionsFor", { name })}
          icon={MoreVertical}
          onClick={onActions}
        />
      }
    />
  );
}
