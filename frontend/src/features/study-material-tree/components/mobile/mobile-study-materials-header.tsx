import { ChevronLeft, FolderPlus } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface MobileStudyMaterialsHeaderProps {
  folderName?: string;
  onBack: () => void;
  onCreateFolder: () => void;
}

export function MobileStudyMaterialsHeader({
  folderName,
  onBack,
  onCreateFolder,
}: MobileStudyMaterialsHeaderProps) {
  const { t } = useTranslation(["tree", "sources"]);
  const newFolderLabel = t("tree:actions.newFolder", "New folder");

  if (!folderName) {
    return null;
  }

  return (
    <header
      data-slot="study-materials-panel-header"
      className="flex min-h-11 shrink-0 items-center justify-between gap-1 bg-background p-1.5"
    >
      <div className="flex min-w-0 items-center gap-1">
        <button
          type="button"
          onClick={onBack}
          aria-label={t("sources:mobile.back", "Back")}
          className="relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-transform active:scale-97 touch-manipulation after:absolute after:-inset-1.5 after:content-['']"
        >
          <ChevronLeft className="size-4" />
        </button>
        <h2 className="truncate text-sm font-semibold text-foreground">
          {folderName}
        </h2>
      </div>
      {onCreateFolder && (
        <button
          type="button"
          onClick={onCreateFolder}
          aria-label={newFolderLabel}
          title={newFolderLabel}
          className="relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-transform active:scale-97 touch-manipulation after:absolute after:-inset-1.5 after:content-['']"
        >
          <FolderPlus className="size-4" />
        </button>
      )}
    </header>
  );
}
