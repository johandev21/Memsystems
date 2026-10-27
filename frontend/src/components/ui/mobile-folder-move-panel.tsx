import { ArrowLeft, Folder, FolderInput } from "lucide-react";
import {
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export interface MobileFolderMoveOption {
  id: string;
  name: string;
}

export interface MobileFolderMovePanelProps {
  folderName: string;
  title: string;
  backLabel: string;
  rootLabel: string;
  emptyLabel: string;
  folders: readonly MobileFolderMoveOption[];
  canMoveToRoot: boolean;
  onBack: () => void;
  onSelect: (folderId: string | null) => void;
}

export interface MobileMoveFolderPickerViewProps {
  rootLabel: string;
  emptyLabel: string;
  folders: readonly MobileFolderMoveOption[];
  canMoveToRoot: boolean;
  onSelect: (folderId: string | null) => void;
}

const TARGET_CLASS =
  "flex min-h-12 w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium text-foreground active:bg-muted active:scale-98 transition-transform touch-manipulation cursor-pointer [@media(hover:hover)]:hover:bg-muted";

export function MobileFolderMovePanel({
  folderName,
  title,
  backLabel,
  rootLabel,
  emptyLabel,
  folders,
  canMoveToRoot,
  onBack,
  onSelect,
}: MobileFolderMovePanelProps) {
  return (
    <>
      <DrawerHeader className="pb-3 text-left">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            aria-label={backLabel}
            className="flex size-11 items-center justify-center rounded-lg text-muted-foreground active:scale-97 transition-transform touch-manipulation cursor-pointer"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="min-w-0 flex-1">
            <DrawerTitle className="truncate text-base font-semibold">{title}</DrawerTitle>
            <DrawerDescription className="truncate text-xs">{folderName}</DrawerDescription>
          </div>
        </div>
      </DrawerHeader>

      <MobileMoveFolderPickerView
        rootLabel={rootLabel}
        emptyLabel={emptyLabel}
        folders={folders}
        canMoveToRoot={canMoveToRoot}
        onSelect={onSelect}
      />
    </>
  );
}

export function MobileMoveFolderPickerView({
  rootLabel,
  emptyLabel,
  folders,
  canMoveToRoot,
  onSelect,
}: MobileMoveFolderPickerViewProps) {
  return (
    <div className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto overscroll-contain py-1">
      {canMoveToRoot && (
        <button
          type="button"
          data-slot="mobile-move-target-root"
          onClick={() => onSelect(null)}
          className={TARGET_CLASS}
        >
          <FolderInput className="size-4.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{rootLabel}</span>
        </button>
      )}

      {folders.map((folder) => (
        <button
          key={folder.id}
          type="button"
          data-slot={`mobile-move-target-${folder.id}`}
          onClick={() => onSelect(folder.id)}
          className={TARGET_CLASS}
        >
          <Folder className="size-4.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{folder.name}</span>
        </button>
      ))}

      {!canMoveToRoot && folders.length === 0 && (
        <p className="py-4 text-center text-xs text-muted-foreground">{emptyLabel}</p>
      )}
    </div>
  );
}
