import { createElement } from "react";
import { MoreVertical } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TreeNode } from "../model/tree";
import { getTreeIcon } from "../ui/tree/row-icon";
import { MobileTileActionsButton, MOBILE_TILE_CLASS } from "./mobile-tile-parts";

export interface MobileMaterialTileProps {
  node: TreeNode;
  onOpen: () => void;
  onActions: () => void;
}

export function MobileMaterialTile({ node, onOpen, onActions }: MobileMaterialTileProps) {
  const { t } = useTranslation(["viewer", "tree"]);
  const icon = getTreeIcon(node, false);
  const kindLabel = node.materialKind
    ? t(`viewer:kinds.${node.materialKind}`, node.materialKind)
    : undefined;

  return (
    <div role="listitem" data-slot="mobile-material-tile" className={MOBILE_TILE_CLASS}>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-3 py-2 pl-3 text-left touch-manipulation"
      >
        {createElement(icon, {
          className: "size-5 shrink-0 text-muted-foreground",
          strokeWidth: 1.7,
        })}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="line-clamp-2 text-sm leading-snug text-foreground">{node.name}</span>
          {kindLabel && (
            <span className="truncate text-xs text-muted-foreground">{kindLabel}</span>
          )}
        </span>
      </button>
      <MobileTileActionsButton
        label={t("tree:row.actionsFor", { name: node.name })}
        icon={MoreVertical}
        onClick={onActions}
      />
    </div>
  );
}
