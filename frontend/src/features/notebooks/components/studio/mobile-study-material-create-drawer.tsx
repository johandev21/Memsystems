import { FolderPlus, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  RESOURCES,
  KIND_LABEL_KEYS,
  isInScope,
} from "@/features/notebooks/components/shared/studio-resources-config";
import type { StudyMaterialKind } from "@/features/study-material-viewer";

export interface MobileStudyMaterialCreateDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (kind: StudyMaterialKind) => void;
  onCreateFolder: () => void;
}

export function MobileStudyMaterialCreateDrawer({
  open,
  onOpenChange,
  onGenerate,
  onCreateFolder,
}: MobileStudyMaterialCreateDrawerProps) {
  const { t } = useTranslation(["notebooks", "tree", "sources"]);

  const handleSelectMaterial = (kind: StudyMaterialKind) => {
    onOpenChange(false);
    onGenerate(kind);
  };

  const handleCreateFolder = () => {
    onOpenChange(false);
    onCreateFolder();
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh] p-4 pb-safe-lg" showCloseButton={false}>
        <DrawerHeader className="sr-only">
          <DrawerTitle>
            {t("notebooks:studio.newMaterial", "New study material")}
          </DrawerTitle>
        </DrawerHeader>

        <div className="flex flex-col gap-1 py-1 overflow-y-auto overscroll-contain">
          {/* First option: New Folder */}
          <button
            type="button"
            data-slot="mobile-create-option-folder"
            onClick={handleCreateFolder}
            className="flex w-full items-center gap-3.5 rounded-xl px-3.5 py-3 text-left transition-colors active:bg-muted active:scale-98 touch-manipulation cursor-pointer select-none [@media(hover:hover)]:hover:bg-muted"
          >
            <FolderPlus className="size-5 shrink-0 text-foreground" />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-semibold text-foreground">
                {t("tree:actions.newFolder", "New folder")}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {t("tree:mobile.newFolderDescription", "Organize study materials into folders.")}
              </span>
            </div>
          </button>

          <div className="my-1.5 h-px bg-border/40" />

          {/* 8 Study Material Types */}
          {RESOURCES.map((resource) => {
            const inScope = isInScope(resource.kind);
            const label = t(`notebooks:${KIND_LABEL_KEYS[resource.kind]}`, resource.key);
            const Icon: LucideIcon = resource.icon;

            return (
              <button
                key={resource.key}
                type="button"
                data-slot={`mobile-create-option-${resource.kind}`}
                disabled={!inScope}
                onClick={() => inScope && handleSelectMaterial(resource.kind)}
                className={`flex w-full items-center gap-3.5 rounded-xl px-3.5 py-3 text-left transition-colors active:bg-muted active:scale-98 touch-manipulation select-none ${
                  inScope
                    ? "cursor-pointer text-foreground [@media(hover:hover)]:hover:bg-muted"
                    : "opacity-40 cursor-not-allowed text-muted-foreground"
                }`}
              >
                <Icon className="size-5 shrink-0 text-foreground" />
                <span className="text-sm font-medium text-foreground truncate flex-1">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
