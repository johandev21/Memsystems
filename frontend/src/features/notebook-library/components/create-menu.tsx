import { FolderPlus, NotebookPen, Plus, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function CreateMenu({
  onCreateNotebook,
  onCreateFolder,
  onImportNotebook,
}: {
  onCreateNotebook: () => void;
  onCreateFolder: () => void;
  onImportNotebook?: () => void;
}) {
  const { t } = useTranslation("notebooks");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="icon-lg"
            className="rounded-full cursor-pointer"
            aria-label={t("library.create.aria")}
          >
            <Plus className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("library.create.label")}</DropdownMenuLabel>
          <DropdownMenuItem
            className="cursor-pointer items-start gap-3 rounded-xl px-2 py-2"
            onClick={onCreateNotebook}
          >
            <NotebookPen className="mt-0.5 size-6 shrink-0" />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">{t("library.create.notebook")}</span>
              <span className="text-xs text-muted-foreground">
                {t("library.create.notebookDescription")}
              </span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer items-start gap-3 rounded-xl px-2 py-2"
            onClick={onCreateFolder}
          >
            <FolderPlus className="mt-0.5 size-6 shrink-0" />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">{t("library.create.folder")}</span>
              <span className="text-xs text-muted-foreground">
                {t("library.create.folderDescription")}
              </span>
            </span>
          </DropdownMenuItem>
          {onImportNotebook && (
            <DropdownMenuItem
              className="cursor-pointer items-start gap-3 rounded-xl px-2 py-2"
              onClick={onImportNotebook}
            >
              <Upload className="mt-0.5 size-6 shrink-0" />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">{t("library.create.importNotebook")}</span>
                <span className="text-xs text-muted-foreground">
                  {t("library.create.importNotebookDescription")}
                </span>
              </span>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
