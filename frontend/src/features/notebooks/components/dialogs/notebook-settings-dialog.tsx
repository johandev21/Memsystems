import { Download, Eraser, Pencil, Settings, SlidersHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  CLEAR_NOTEBOOK_CHAT_EVENT,
  EDIT_NOTEBOOK_EVENT,
  useNotebookSettingsActions,
} from "../../hooks/use-notebook-settings-actions";
import { GROUNDING_MODES, type GroundingMode } from "../../model/grounding-mode";
import { NotebookDeleteDialog } from "../notebook-delete-dialog";

export { CLEAR_NOTEBOOK_CHAT_EVENT, EDIT_NOTEBOOK_EVENT };

export interface NotebookSettingsDialogProps {
  notebookId: string;
}

export function NotebookSettingsDialog({ notebookId }: NotebookSettingsDialogProps) {
  const { t } = useTranslation("notebooks");
  const [open, setOpen] = useState(false);

  const {
    notebook,
    groundingMode,
    isSavingMode,
    isDeleting,
    deleteDialogOpen,
    setDeleteDialogOpen,
    handleGroundingModeChange,
    handleEditNotebook,
    handleClearHistory,
    handleExportNotebook,
    handleOpenDelete,
    handleConfirmDelete,
  } = useNotebookSettingsActions(notebookId, { onAction: () => setOpen(false) });

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="size-7 cursor-pointer"
              aria-label={t("settings.ariaLabel")}
            />
          }
        >
          <Settings />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-72">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex flex-col gap-0.5 px-2 py-1.5">
              <span className="text-sm font-semibold text-foreground">{t("settings.title")}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {t("settings.description")}
              </span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={handleEditNotebook} className="cursor-pointer">
              <Pencil />
              <span>{t("settings.edit")}</span>
            </DropdownMenuItem>
            <GroundingModeSubMenu
              groundingMode={groundingMode}
              isSavingMode={isSavingMode}
              onGroundingModeChange={handleGroundingModeChange}
            />
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={handleClearHistory} className="cursor-pointer">
              <Eraser />
              <span>{t("settings.clearChat")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportNotebook} className="cursor-pointer">
              <Download />
              <span>{t("settings.export", "Export notebook")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={handleOpenDelete}
              className="cursor-pointer"
            >
              <Trash2 />
              <span>{t("settings.delete")}</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <NotebookDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        notebookTitle={notebook?.title}
        isDeleting={isDeleting}
        onDelete={handleConfirmDelete}
      />
    </>
  );
}

interface GroundingModeSubMenuProps {
  groundingMode: GroundingMode;
  isSavingMode: boolean;
  onGroundingModeChange: (mode: GroundingMode) => void;
}

function GroundingModeSubMenu({
  groundingMode,
  isSavingMode,
  onGroundingModeChange,
}: GroundingModeSubMenuProps) {
  const { t } = useTranslation("notebooks");

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="cursor-pointer whitespace-nowrap [&>svg:last-child]:ml-0">
        <SlidersHorizontal />
        <span>{t("groundingMode.label")}</span>
        <span className="ml-auto mr-1 text-xs text-muted-foreground font-normal capitalize">
          {t(`groundingMode.${groundingMode}`)}
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-72 p-1">
        <DropdownMenuRadioGroup
          value={groundingMode}
          onValueChange={(val) => onGroundingModeChange(val as GroundingMode)}
        >
          {GROUNDING_MODES.map((mode) => (
            <DropdownMenuRadioItem
              key={mode}
              value={mode}
              disabled={isSavingMode}
              className="cursor-pointer items-start py-2 pr-8 [&_[data-slot=dropdown-menu-radio-item-indicator]]:top-2.5"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-foreground">
                  {t(`groundingMode.${mode}`)}
                </span>
                <span className="text-xs text-muted-foreground font-normal leading-snug whitespace-normal">
                  {t(`groundingMode.descriptions.${mode}`)}
                </span>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
