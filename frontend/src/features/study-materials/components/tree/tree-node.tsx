import { ChevronRight, Folder, FolderOpen, MoreVertical, Trash2 } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/shared/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { cn } from "@/shared/lib/utils";
import { RESOURCE_ICONS } from "./resource-icons";
import type { FileTreeItem } from "./study-materials-tree";

export function FileTreeItemNode({
  item,
  depth,
  onToggleFolder,
  onSelectMaterial,
  onDeleteMaterial,
  onDeleteFolder,
  folderChildrenById,
}: {
  item: FileTreeItem;
  depth: number;
  onToggleFolder: (id: string) => void;
  onSelectMaterial?: (id: string) => void;
  onDeleteMaterial?: (id: string, name: string) => void;
  onDeleteFolder?: (id: string, name: string) => void;
  folderChildrenById: Map<string, FileTreeItem[]>;
}) {
  const isFolder = item.type === "folder";
  const paddingLeft = 8 + depth * 16;
  const config = RESOURCE_ICONS[item.type];
  const Icon = isFolder ? (item.isOpen ? FolderOpen : Folder) : config.icon;

  const handleClick = () => {
    if (isFolder) {
      onToggleFolder(item.id);
      return;
    }
    onSelectMaterial?.(item.id);
  };

  const nodeContent = (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      style={{ paddingLeft: `${paddingLeft}px` }}
      className={cn(
        "group relative flex w-full items-center gap-2.5 py-1.5 pr-4 text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer select-none rounded-xl w-max min-w-full",
        isFolder
          ? "text-foreground hover:bg-muted"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {isFolder && (
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform duration-200 text-muted-foreground",
            item.isOpen && "rotate-90",
          )}
        />
      )}
      {!isFolder && <span className="w-3.5 shrink-0" />}
      <Icon
        className={cn("h-4 w-4 shrink-0", isFolder ? "text-foreground" : config.className)}
        strokeWidth={2}
      />
      <span className="flex-1 pr-1 whitespace-nowrap">{item.name}</span>
      {isFolder && (
        <div className="ml-auto flex items-center gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          {typeof item.materialCount === "number" && item.materialCount > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums mr-1">
              {item.materialCount}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="h-6 w-6 flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Options for ${item.name}`}
                />
              }
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteFolder?.(item.id, item.name);
                }}
                className="cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {!isFolder && (
        <div className="ml-auto opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="h-6 w-6 flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Options for ${item.name}`}
                />
              }
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteMaterial?.(item.id, item.name);
                }}
                className="cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );

  if (isFolder) {
    return (
      <ContextMenu>
        <ContextMenuTrigger render={nodeContent} />
        <ContextMenuContent className="w-40">
          <ContextMenuItem
            variant="destructive"
            onClick={() => onDeleteFolder?.(item.id, item.name)}
            className="cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
        {item.isOpen && (
          <div className="flex flex-col gap-0.5 mt-0.5">
            {(folderChildrenById.get(item.id) ?? []).map((child) => (
              <FileTreeItemNode
                key={child.id}
                item={child}
                depth={depth + 1}
                onToggleFolder={onToggleFolder}
                onSelectMaterial={onSelectMaterial}
                onDeleteMaterial={onDeleteMaterial}
                onDeleteFolder={onDeleteFolder}
                folderChildrenById={folderChildrenById}
              />
            ))}
          </div>
        )}
      </ContextMenu>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger render={nodeContent} />
      <ContextMenuContent className="w-40">
        <ContextMenuItem
          variant="destructive"
          onClick={() => onDeleteMaterial?.(item.id, item.name)}
          className="cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5 mr-2" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
