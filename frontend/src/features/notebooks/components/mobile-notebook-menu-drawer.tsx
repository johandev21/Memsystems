import {
  Check,
  ChevronRight,
  Download,
  Eraser,
  MoreVertical,
  Pencil,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/shared/components/ui/drawer";
import { cn } from "@/shared/utils/cn";
import { useNotebookSettingsActions } from "../hooks/use-notebook-settings-actions";
import { GROUNDING_MODES, type GroundingMode } from "../model/grounding-mode";
import { NotebookDeleteDialog } from "./notebook-delete-dialog";

export interface MobileNotebookMenuDrawerProps {
  notebookId: string;
}

export function MobileNotebookMenuDrawer({ notebookId }: MobileNotebookMenuDrawerProps) {
  const { t } = useTranslation("notebooks");
  const [open, setOpen] = useState(false);
  const [groundingDrawerOpen, setGroundingDrawerOpen] = useState(false);

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

  const handleOpenGroundingDrawer = () => {
    setOpen(false);
    setGroundingDrawerOpen(true);
  };

  const handleSelectGroundingMode = async (mode: GroundingMode) => {
    setGroundingDrawerOpen(false);
    if (mode !== groundingMode) {
      await handleGroundingModeChange(mode);
    }
  };

  return (
    <>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-full cursor-pointer active:scale-97 transition-transform touch-manipulation"
              aria-label={t("settings.ariaLabel")}
            />
          }
        >
          <MoreVertical className="size-4.5" />
        </DrawerTrigger>
        <DrawerContent className="p-4 pb-safe-lg max-h-[85vh]">
          <DrawerHeader className="pb-2 text-left">
            <DrawerTitle className="text-base font-semibold truncate">
              {notebook?.title ?? t("settings.title")}
            </DrawerTitle>
            <DrawerDescription className="text-xs">{t("settings.description")}</DrawerDescription>
          </DrawerHeader>

          <MobileNotebookMenuActionList
            groundingMode={groundingMode}
            onEdit={handleEditNotebook}
            onOpenGrounding={handleOpenGroundingDrawer}
            onClearChat={handleClearHistory}
            onExport={handleExportNotebook}
            onOpenDelete={handleOpenDelete}
          />
        </DrawerContent>
      </Drawer>

      <MobileGroundingModeDrawer
        open={groundingDrawerOpen}
        onOpenChange={setGroundingDrawerOpen}
        groundingMode={groundingMode}
        isSavingMode={isSavingMode}
        onSelectMode={handleSelectGroundingMode}
      />

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

interface MobileNotebookMenuActionListProps {
  groundingMode: GroundingMode;
  onEdit: () => void;
  onOpenGrounding: () => void;
  onClearChat: () => void;
  onExport: () => void;
  onOpenDelete: () => void;
}

function MobileNotebookMenuActionList({
  groundingMode,
  onEdit,
  onOpenGrounding,
  onClearChat,
  onExport,
  onOpenDelete,
}: MobileNotebookMenuActionListProps) {
  const { t } = useTranslation("notebooks");

  return (
    <div className="flex flex-col gap-1 py-2">
      <button
        type="button"
        onClick={onEdit}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted active:scale-97 transition-transform transition-colors touch-manipulation cursor-pointer"
      >
        <Pencil className="size-4 text-muted-foreground shrink-0" />
        <span>{t("settings.edit")}</span>
      </button>

      <button
        type="button"
        onClick={onOpenGrounding}
        className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted active:scale-97 transition-transform transition-colors touch-manipulation cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="size-4 text-muted-foreground shrink-0" />
          <span>{t("groundingMode.label")}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground font-normal">
          <span className="capitalize">{t(`groundingMode.${groundingMode}`)}</span>
          <ChevronRight className="size-3.5 text-muted-foreground/60 shrink-0" />
        </div>
      </button>

      <button
        type="button"
        onClick={onClearChat}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted active:scale-97 transition-transform transition-colors touch-manipulation cursor-pointer"
      >
        <Eraser className="size-4 text-muted-foreground shrink-0" />
        <span>{t("settings.clearChat")}</span>
      </button>

      <button
        type="button"
        onClick={onExport}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted active:scale-97 transition-transform transition-colors touch-manipulation cursor-pointer"
      >
        <Download className="size-4 text-muted-foreground shrink-0" />
        <span>{t("settings.export", "Export notebook")}</span>
      </button>

      <button
        type="button"
        onClick={onOpenDelete}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 active:scale-97 transition-transform transition-colors touch-manipulation cursor-pointer"
      >
        <Trash2 className="size-4 shrink-0" />
        <span>{t("settings.delete")}</span>
      </button>
    </div>
  );
}

interface MobileGroundingModeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groundingMode: GroundingMode;
  isSavingMode: boolean;
  onSelectMode: (mode: GroundingMode) => void;
}

function MobileGroundingModeDrawer({
  open,
  onOpenChange,
  groundingMode,
  isSavingMode,
  onSelectMode,
}: MobileGroundingModeDrawerProps) {
  const { t } = useTranslation("notebooks");

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="p-4 pb-safe-lg max-h-[85vh]">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="text-base font-semibold">{t("groundingMode.label")}</DrawerTitle>
          <DrawerDescription className="text-xs text-muted-foreground">
            {t("groundingMode.drawerDescription")}
          </DrawerDescription>
        </DrawerHeader>

        <div
          className="flex flex-col gap-1 py-2"
          role="radiogroup"
          aria-label={t("groundingMode.label")}
        >
          {GROUNDING_MODES.map((mode) => {
            const isSelected = mode === groundingMode;
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={isSavingMode}
                onClick={() => onSelectMode(mode)}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between rounded-xl px-3.5 py-3 text-left transition-colors active:scale-98 touch-manipulation",
                  isSelected ? "bg-muted font-medium" : "hover:bg-muted/60",
                )}
              >
                <div className="flex flex-col gap-0.5 pr-3 min-w-0 flex-1">
                  <span className="text-sm font-medium text-foreground">
                    {t(`groundingMode.${mode}`)}
                  </span>
                  <span className="text-xs text-muted-foreground leading-normal">
                    {t(`groundingMode.descriptions.${mode}`)}
                  </span>
                </div>
                {isSelected && <Check className="size-4.5 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
