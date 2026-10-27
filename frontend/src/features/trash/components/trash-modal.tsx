import { RotateCcw, Trash2 } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import { ConfirmDeleteDialog } from "@/shared/components/ui/confirm-delete-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/shared/components/ui/drawer";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Spinner } from "@/shared/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import { cn } from "@/shared/utils/cn";
import type { TrashItem } from "../api/trash";
import { useTrashModalController } from "../hooks/use-trash-modal-controller";
import { TrashItemIcon } from "./trash-item-icon";

export interface TrashModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore?: (item: TrashItem) => void;
  onDeleteForever?: (item: TrashItem) => void;
  onEmptyTrash?: () => void;
}

export function TrashModal({
  open,
  onOpenChange,
  onRestore,
  onDeleteForever,
  onEmptyTrash,
}: TrashModalProps) {
  const { t } = useTranslation("settings");
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const controller = useTrashModalController({
    open,
    onRestore,
    onDeleteForever,
    onEmptyTrash,
  });

  return (
    <>
      <TrashModalSurface
        isDesktop={isDesktop}
        open={open}
        onOpenChange={onOpenChange}
        title={t("trash.modal.title")}
        subtitle={t("trash.modal.subtitle")}
        headerContent={
          <TrashModalHeader
            hasItems={controller.allItems.length > 0}
            isHoldingEmpty={controller.holdToEmpty.isHoldingEmpty}
            onStartHold={controller.holdToEmpty.startHold}
            onCancelHold={controller.holdToEmpty.cancelHold}
          />
        }
        bodyContent={
          <TrashModalBody
            searchQuery={controller.searchQuery}
            onSearchChange={controller.setSearchQuery}
            isLoading={controller.isLoading}
            isError={controller.isError}
            allItems={controller.allItems}
            filteredItems={controller.filteredItems}
            expiringSoon={controller.expiringSoon}
            recentlyDeleted={controller.recentlyDeleted}
            sentinelRef={controller.sentinelRef}
            isFetchingNextPage={controller.isFetchingNextPage}
            isRestoring={controller.isRestoring}
            isDeleting={controller.isDeleting}
            onRestore={controller.handleRestore}
            onDeleteForever={controller.setPendingHardDelete}
          />
        }
      />
      <ConfirmDeleteDialog
        open={controller.pendingHardDelete !== null}
        onOpenChange={(openConfirm) => !openConfirm && controller.setPendingHardDelete(null)}
        title={t("trash.modal.confirmDeleteTitle")}
        description={t("trash.modal.confirmDeleteDescription", {
          name: controller.pendingHardDelete?.name ?? "",
        })}
        onConfirm={() => {
          if (controller.pendingHardDelete) {
            controller.handleDeleteForever(controller.pendingHardDelete);
            controller.setPendingHardDelete(null);
          }
        }}
      />
    </>
  );
}

function TrashModalSurface({
  isDesktop,
  open,
  onOpenChange,
  title,
  subtitle,
  headerContent,
  bodyContent,
}: {
  isDesktop: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle: string;
  headerContent: ReactNode;
  bodyContent: ReactNode;
}) {
  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent showCloseButton={true} className="sm:max-w-2xl gap-0 p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-3 border-b border-border/50">
            <DialogTitle className="sr-only">{title}</DialogTitle>
            <DialogDescription className="sr-only">{subtitle}</DialogDescription>
            {headerContent}
          </DialogHeader>
          {bodyContent}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="p-0 max-h-[85vh] overflow-hidden">
        <DrawerHeader className="p-4 pb-3 border-b border-border/50 text-left">
          <DrawerTitle className="sr-only">{title}</DrawerTitle>
          <DrawerDescription className="sr-only">{subtitle}</DrawerDescription>
          {headerContent}
        </DrawerHeader>
        {bodyContent}
      </DrawerContent>
    </Drawer>
  );
}

function TrashModalHeader({
  hasItems,
  isHoldingEmpty,
  onStartHold,
  onCancelHold,
}: {
  hasItems: boolean;
  isHoldingEmpty: boolean;
  onStartHold: () => void;
  onCancelHold: () => void;
}) {
  const { t } = useTranslation("settings");

  return (
    <div className="flex items-center justify-between gap-3 min-w-0 pr-10">
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold leading-none tracking-tight text-foreground">
          {t("trash.modal.title")}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground truncate">{t("trash.modal.subtitle")}</p>
      </div>
      {hasItems && (
        <HoldToEmptyButton
          isHolding={isHoldingEmpty}
          onStartHold={onStartHold}
          onCancelHold={onCancelHold}
        />
      )}
    </div>
  );
}

function HoldToEmptyButton({
  isHolding,
  onStartHold,
  onCancelHold,
}: {
  isHolding: boolean;
  onStartHold: () => void;
  onCancelHold: () => void;
}) {
  const { t } = useTranslation("settings");

  return (
    <button
      type="button"
      data-holding={isHolding ? "true" : "false"}
      onPointerDown={onStartHold}
      onPointerUp={onCancelHold}
      onPointerLeave={onCancelHold}
      onPointerCancel={onCancelHold}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
          onStartHold();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onCancelHold();
        }
      }}
      aria-label={t("trash.modal.holdToEmptyAria")}
      className="hold-delete-btn shrink-0 cursor-pointer rounded-lg bg-muted px-2.5 py-1.5 text-xs font-medium text-foreground select-none touch-manipulation"
    >
      <span className="flex items-center gap-1.5">
        <Trash2 className="size-3 text-muted-foreground" />
        <span>{t("trash.modal.holdToEmpty")}</span>
      </span>
      <span
        aria-hidden="true"
        className="hold-delete-overlay rounded-lg bg-destructive px-2.5 py-1.5 text-xs font-medium text-destructive-foreground"
      >
        <Trash2 className="size-3" />
        <span>{t("trash.modal.holdToEmpty")}</span>
      </span>
    </button>
  );
}

interface TrashModalBodyProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isLoading: boolean;
  isError: boolean;
  allItems: TrashItem[];
  filteredItems: TrashItem[];
  expiringSoon: TrashItem[];
  recentlyDeleted: TrashItem[];
  sentinelRef: RefObject<HTMLDivElement | null>;
  isFetchingNextPage: boolean;
  isRestoring: (itemId: string) => boolean;
  isDeleting: (itemId: string) => boolean;
  onRestore: (item: TrashItem) => void;
  onDeleteForever: (item: TrashItem) => void;
}

function TrashModalBody({ searchQuery, onSearchChange, ...resultsProps }: TrashModalBodyProps) {
  const { t } = useTranslation("settings");

  return (
    <Command
      shouldFilter={false}
      className="flex size-full flex-col overflow-hidden bg-transparent"
    >
      <CommandInput
        placeholder={t("trash.modal.searchPlaceholder")}
        value={searchQuery}
        onValueChange={onSearchChange}
        className="h-10 text-xs"
      />
      <CommandList className="max-h-[60vh] overflow-y-auto px-2 py-2">
        <TrashItemsResult {...resultsProps} searchQuery={searchQuery} />
      </CommandList>
    </Command>
  );
}

type TrashItemsResultProps = Omit<TrashModalBodyProps, "onSearchChange">;

function TrashItemsResult({
  searchQuery,
  isLoading,
  isError,
  allItems,
  filteredItems,
  expiringSoon,
  recentlyDeleted,
  sentinelRef,
  isFetchingNextPage,
  isRestoring,
  isDeleting,
  onRestore,
  onDeleteForever,
}: TrashItemsResultProps) {
  const { t } = useTranslation("settings");

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="size-5 text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={<Trash2 className="size-5 text-muted-foreground" />}
        title={t("trash.modal.loadFailedTitle")}
        description={t("trash.modal.loadFailedDescription")}
        className="py-10"
      />
    );
  }

  if (allItems.length === 0) {
    return (
      <EmptyState
        icon={<Trash2 className="size-5 text-muted-foreground" />}
        title={t("trash.modal.emptyTitle")}
        description={t("trash.modal.emptyDescription")}
        className="py-10"
      />
    );
  }

  if (filteredItems.length === 0) {
    return (
      <CommandEmpty className="py-8 text-center text-xs text-muted-foreground">
        {t("trash.modal.noResults", { query: searchQuery })}
      </CommandEmpty>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {expiringSoon.length > 0 && (
        <TrashItemGroup
          items={expiringSoon}
          heading={t("trash.modal.expiringSoonHeading")}
          isExpiringSoon
          isRestoring={isRestoring}
          isDeleting={isDeleting}
          onRestore={onRestore}
          onDeleteForever={onDeleteForever}
        />
      )}
      {recentlyDeleted.length > 0 && (
        <TrashItemGroup
          items={recentlyDeleted}
          heading={t("trash.modal.recentlyDeletedHeading")}
          isExpiringSoon={false}
          isRestoring={isRestoring}
          isDeleting={isDeleting}
          onRestore={onRestore}
          onDeleteForever={onDeleteForever}
        />
      )}
      <div ref={sentinelRef} className="py-1 flex justify-center">
        {isFetchingNextPage && <Spinner className="size-4 text-muted-foreground" />}
      </div>
    </div>
  );
}

interface TrashItemGroupProps {
  items: TrashItem[];
  heading: string;
  isExpiringSoon: boolean;
  isRestoring: (itemId: string) => boolean;
  isDeleting: (itemId: string) => boolean;
  onRestore: (item: TrashItem) => void;
  onDeleteForever: (item: TrashItem) => void;
}

function TrashItemGroup({
  items,
  heading,
  isExpiringSoon,
  isRestoring,
  isDeleting,
  onRestore,
  onDeleteForever,
}: TrashItemGroupProps) {
  return (
    <CommandGroup
      heading={heading}
      className="[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground"
    >
      {items.map((item) => (
        <TrashItemRow
          key={item.id}
          item={item}
          isExpiringSoon={isExpiringSoon}
          isRestoring={isRestoring(item.id)}
          isDeleting={isDeleting(item.id)}
          onRestore={onRestore}
          onDeleteForever={onDeleteForever}
        />
      ))}
    </CommandGroup>
  );
}

function TrashItemRow({
  item,
  isExpiringSoon,
  isRestoring,
  isDeleting,
  onRestore,
  onDeleteForever,
}: {
  item: TrashItem;
  isExpiringSoon: boolean;
  isRestoring: boolean;
  isDeleting: boolean;
  onRestore: (item: TrashItem) => void;
  onDeleteForever: (item: TrashItem) => void;
}) {
  const { t } = useTranslation("settings");

  return (
    <CommandItem
      value={item.id}
      className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 hover:bg-muted/60 data-[selected=true]:bg-muted/80"
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <div className="mt-0.5 shrink-0">
          <TrashItemIcon kind={item.kind} />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="text-xs font-medium leading-4 text-foreground truncate"
            title={item.name}
          >
            <bdi>{item.name}</bdi>
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {item.notebookTitle ? `${item.notebookTitle} · ` : ""}
            {item.subtypeLabel ?? t("trash.modal.itemFallback")}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span
          className={cn(
            "w-12 text-right text-xs tabular-nums",
            isExpiringSoon ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {t("trash.modal.daysRemaining", { count: item.daysRemaining })}
        </span>
        <TrashRowActions
          item={item}
          isRestoring={isRestoring}
          isDeleting={isDeleting}
          onRestore={onRestore}
          onDeleteForever={onDeleteForever}
        />
      </div>
    </CommandItem>
  );
}

interface TrashRowActionsProps {
  item: TrashItem;
  isRestoring: boolean;
  isDeleting: boolean;
  onRestore: (item: TrashItem) => void;
  onDeleteForever: (item: TrashItem) => void;
}

function TrashRowActions({
  item,
  isRestoring,
  isDeleting,
  onRestore,
  onDeleteForever,
}: TrashRowActionsProps) {
  const { t } = useTranslation("settings");
  const isPending = isRestoring || isDeleting;
  return (
    <div className="flex items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={isPending}
              onClick={(e) => {
                e.stopPropagation();
                onRestore(item);
              }}
              aria-label={t("trash.modal.restore")}
              className="size-6.5 cursor-pointer rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:scale-97 touch-manipulation disabled:opacity-50"
            >
              {isRestoring ? (
                <Spinner className="size-3.5 shrink-0" />
              ) : (
                <RotateCcw className="size-3.5 shrink-0" />
              )}
            </Button>
          }
        />
        <TooltipContent>{t("trash.modal.restore")}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={isPending}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteForever(item);
              }}
              aria-label={t("trash.modal.deleteForever")}
              className="size-6.5 cursor-pointer rounded-md text-muted-foreground hover:bg-muted hover:text-destructive active:scale-97 touch-manipulation disabled:opacity-50"
            >
              {isDeleting ? (
                <Spinner className="size-3.5 shrink-0" />
              ) : (
                <Trash2 className="size-3.5 shrink-0" />
              )}
            </Button>
          }
        />
        <TooltipContent>{t("trash.modal.deleteForever")}</TooltipContent>
      </Tooltip>
    </div>
  );
}
