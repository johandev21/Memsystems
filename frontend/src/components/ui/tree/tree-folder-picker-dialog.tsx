import { useState } from "react";
import { Folder, HardDrive, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/shared/utils/cn";

export interface FolderOption {
  id: string;
  name: string;
  parentId?: string | null;
}

export interface TreeFolderPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  folders: readonly FolderOption[];
  onConfirm: (targetFolderId: string | null) => void;
  isLoading?: boolean;
  disabledFolderIds?: Set<string>;
}

export function TreeFolderPickerDialog({
  open,
  onOpenChange,
  title = "Move items",
  description = "Select a destination folder:",
  folders,
  onConfirm,
  isLoading = false,
  disabledFolderIds,
}: TreeFolderPickerDialogProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // Group folders by hierarchy
  const folderTree = buildFolderHierarchy(folders);

  const handleConfirm = () => {
    onConfirm(selectedFolderId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-64 border rounded-lg p-2 bg-muted/20">
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => setSelectedFolderId(null)}
              className={cn(
                "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors text-left",
                selectedFolderId === null
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "hover:bg-muted text-foreground",
              )}
            >
              <HardDrive className="size-4 shrink-0" />
              <span>(Root / No folder)</span>
            </button>

            {folderTree.map((item) => (
              <FolderOptionRow
                key={item.id}
                item={item}
                depth={0}
                selectedFolderId={selectedFolderId}
                onSelect={setSelectedFolderId}
                disabledFolderIds={disabledFolderIds}
              />
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Move here
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface HierarchyFolderItem extends FolderOption {
  children: HierarchyFolderItem[];
}

function buildFolderHierarchy(folders: readonly FolderOption[]): HierarchyFolderItem[] {
  const map = new Map<string, HierarchyFolderItem>();
  const roots: HierarchyFolderItem[] = [];

  for (const f of folders) {
    map.set(f.id, { ...f, children: [] });
  }

  for (const f of folders) {
    const item = map.get(f.id)!;
    if (f.parentId && map.has(f.parentId)) {
      map.get(f.parentId)!.children.push(item);
    } else {
      roots.push(item);
    }
  }

  return roots;
}

function FolderOptionRow({
  item,
  depth,
  selectedFolderId,
  onSelect,
  disabledFolderIds,
}: {
  item: HierarchyFolderItem;
  depth: number;
  selectedFolderId: string | null;
  onSelect: (id: string) => void;
  disabledFolderIds?: Set<string>;
}) {
  const isDisabled = disabledFolderIds?.has(item.id) ?? false;
  const isSelected = selectedFolderId === item.id;

  return (
    <>
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => onSelect(item.id)}
        style={{ "--picker-item-pad": `${depth * 16 + 10}px` } as React.CSSProperties}
        className={cn(
          "pl-(--picker-item-pad) flex items-center gap-2 py-1.5 pr-2.5 rounded-md text-xs font-medium cursor-pointer transition-colors text-left",
          isSelected
            ? "bg-primary text-primary-foreground font-semibold"
            : isDisabled
              ? "opacity-40 cursor-not-allowed text-muted-foreground"
              : "hover:bg-muted text-foreground",
        )}
      >
        <Folder className="size-4 shrink-0" />
        <span className="truncate">{item.name}</span>
      </button>

      {item.children.map((child) => (
        <FolderOptionRow
          key={child.id}
          item={child}
          depth={depth + 1}
          selectedFolderId={selectedFolderId}
          onSelect={onSelect}
          disabledFolderIds={disabledFolderIds}
        />
      ))}
    </>
  );
}
