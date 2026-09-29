import { createElement } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Folder,
  FolderInput,
  Loader2,
  Pencil,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { InlineRename, useTreeRowDragDrop } from "@/components/ui/tree";
import { cn } from "@/shared/utils/cn";
import type { Source } from "../../api/sources";
import type { SourceFolder } from "../../types/source-folder.types";
import {
  isSourceDegraded,
  isSourceProcessing,
  processingStageLabel,
  sourceProcessingError,
  sourceProcessingStatus,
  sourceQualityCorrectiveAction,
  sourceQualityReasonLabel,
} from "../../utils/source-processing";
import { getSourceIcon } from "./source-icon";

export interface SourceRowProps {
  source: Source;
  allFolders?: readonly SourceFolder[];
  depth?: number;
  onClick: () => void;
  onDelete: () => void;
  onRetry: () => void;
  onCancel: () => void;
  onMove?: (itemId: string, targetFolderId: string | null) => void;
  canMove?: (draggedItemId: string, targetFolderId: string | null) => boolean;
  deleting: boolean;
  retrying: boolean;
  cancelling: boolean;
  isEditing?: boolean;
  onBeginRename?: (id: string) => void;
  onRenameCommit?: (id: string, nextName: string) => void;
  onRenameCancel?: () => void;
}

export function SourceRow({
  source,
  allFolders,
  depth = 0,
  onClick,
  onDelete,
  onRetry,
  onCancel,
  onMove,
  canMove,
  deleting,
  retrying,
  cancelling,
  isEditing = false,
  onBeginRename,
  onRenameCommit,
  onRenameCancel,
}: SourceRowProps) {
  const { t } = useTranslation(["sources", "tree"]);
  const status = sourceProcessingStatus(source);
  const active = isSourceProcessing(source);
  const failed = status === "failed";
  const degraded = isSourceDegraded(source);
  const statusLabel = processingStageLabel(status, source.processingStage, source.modality);
  const error = sourceProcessingError(source);
  const degradedDetail = degraded
    ? [sourceQualityReasonLabel(source), sourceQualityCorrectiveAction(source)]
        .filter(Boolean)
        .join(" — ")
    : undefined;
  const tooltip = degraded ? (degradedDetail ?? statusLabel) : (error ?? statusLabel);

  const {
    isDragging,
    setNodeRefs,
    rowDragProps,
  } = useTreeRowDragDrop({
    nodeId: source.id,
    isFolder: false,
    isRenaming: isEditing,
    isOpen: false,
    canMove: (draggedItemId, targetFolderId) =>
      canMove ? canMove(draggedItemId, targetFolderId) : true,
    setFolderOpen: () => {},
    registerNode: () => {},
    dragIdPrefix: "tree-drag:",
    folderDropIdPrefix: "tree-folder:",
    dragType: "sources-tree-item",
    folderDropType: "sources-tree-folder",
  });

  const validTargetFolders = (allFolders ?? []).filter((f) =>
    canMove ? canMove(source.id, f.id) : f.id !== source.folderId,
  );

  const rowContainer = (
    <div
      ref={setNodeRefs}
      {...rowDragProps}
      data-slot="sources-tree-source-row"
      data-dragging={isDragging ? "true" : undefined}
      className={cn("group relative w-max min-w-full", isDragging && "opacity-50")}
    >
      <button
        type="button"
        onClick={isEditing ? undefined : onClick}
        style={
          depth > 0
            ? ({
                "--tree-row-pad": `calc(var(--tree-root-inset) + ${depth} * var(--tree-indent-step))`,
              } as React.CSSProperties)
            : undefined
        }
        className={cn(
          "group/row relative flex w-max min-w-full cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl py-2 pr-16 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:text-foreground",
          depth > 0 ? "pl-(--tree-row-pad)" : "pl-2",
          failed
            ? "text-destructive hover:bg-destructive/5"
            : degraded
              ? "text-warning hover:bg-warning/5"
              : active
                ? "text-primary hover:bg-primary/5"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        title={tooltip}
      >
        <span className="w-3.5 shrink-0" />
        {active ? (
          <Loader2 className="size-4 shrink-0 animate-spin" />
        ) : failed ? (
          <AlertCircle className="size-4 shrink-0" />
        ) : degraded ? (
          <AlertTriangle className="size-4 shrink-0" />
        ) : (
          createElement(getSourceIcon(source), { className: "size-4 shrink-0" })
        )}
        <span className="flex min-w-0 flex-col">
          {isEditing ? (
            <InlineRename
              initialValue={source.title}
              onCommit={(val) => onRenameCommit?.(source.id, val)}
              onCancel={() => onRenameCancel?.()}
              ariaLabel={source.title}
              size="sm"
            />
          ) : (
            <span className="truncate">{source.title}</span>
          )}
          {degraded && (
            <span className="max-w-80 truncate text-xs text-warning">
              {sourceQualityReasonLabel(source) ?? statusLabel} ·{" "}
              {sourceQualityCorrectiveAction(source)}
            </span>
          )}
        </span>
        {status !== "ready" && !degraded && (
          <span className="max-w-36 truncate text-xs opacity-75">{statusLabel}</span>
        )}
      </button>

      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {failed && (
          <button
            type="button"
            aria-label={t("sources:sourceRow.retryProcessing")}
            title={t("sources:sourceRow.retryProcessing")}
            onClick={(event) => {
              event.stopPropagation();
              onRetry();
            }}
            className="flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {retrying ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RotateCcw className="size-3.5" />
            )}
          </button>
        )}
        {active && (
          <button
            type="button"
            aria-label={t("sources:pendingUpload.cancelProcessing")}
            title={t("sources:pendingUpload.cancelProcessing")}
            onClick={(event) => {
              event.stopPropagation();
              onCancel();
            }}
            className="flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {cancelling ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <X className="size-3.5" />
            )}
          </button>
        )}
        <button
          type="button"
          aria-label={t("sources:sourceRow.delete")}
          title={t("sources:sourceRow.delete")}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className="flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-destructive"
        >
          {deleting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger data-slot="source-row-trigger" render={rowContainer} />
      <ContextMenuContent className="min-w-48">
        <ContextMenuGroup>
          <ContextMenuItem
            data-slot="source-menu-rename"
            onClick={(e) => {
              e.stopPropagation();
              onBeginRename?.(source.id);
            }}
          >
            <Pencil className="size-4 mr-2" />
            {t("tree:actions.rename", "Rename")}
          </ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        {(source.folderId !== null || validTargetFolders.length > 0) && (
          <ContextMenuGroup>
            {source.folderId !== null && (
              <ContextMenuItem
                data-slot="source-menu-move-root"
                onClick={(e) => {
                  e.stopPropagation();
                  onMove?.(source.id, null);
                }}
              >
                <FolderInput className="size-4 mr-2" />
                {t("tree:actions.moveToSourcesRoot", "Move to Sources root")}
              </ContextMenuItem>
            )}
            {validTargetFolders.length > 0 && (
              <ContextMenuSub>
                <ContextMenuSubTrigger data-slot="source-menu-move-folder">
                  <FolderInput className="size-4 mr-2" />
                  {t("tree:actions.moveToFolder", "Move to folder")}
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="min-w-44">
                  {validTargetFolders.map((f) => (
                    <ContextMenuItem
                      key={f.id}
                      data-slot={`move-source-target-${f.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMove?.(source.id, f.id);
                      }}
                    >
                      <Folder className="size-4 mr-2 text-muted-foreground" />
                      <span className="truncate">{f.name}</span>
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
            )}
          </ContextMenuGroup>
        )}
        {(source.folderId !== null || validTargetFolders.length > 0) && <ContextMenuSeparator />}
        {(failed || active) && (
          <>
            <ContextMenuGroup>
              {failed && (
                <ContextMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onRetry();
                  }}
                >
                  <RotateCcw className="size-4 mr-2" />
                  {t("sources:sourceRow.retryProcessing", "Retry processing")}
                </ContextMenuItem>
              )}
              {active && (
                <ContextMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel();
                  }}
                >
                  <X className="size-4 mr-2" />
                  {t("sources:pendingUpload.cancelProcessing", "Cancel")}
                </ContextMenuItem>
              )}
            </ContextMenuGroup>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuGroup>
          <ContextMenuItem
            variant="destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="size-4 mr-2" />
            {t("sources:sourceRow.delete", "Delete")}
          </ContextMenuItem>
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
}
