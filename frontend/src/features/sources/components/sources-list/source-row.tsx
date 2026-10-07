import type React from "react";
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
import { InlineRename, getTreeRowClassName, useTreeRowDragDrop } from "@/components/ui/tree";
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
import { SourceIcon } from "./source-icon";

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
  isFocused?: boolean;
  treeHasFocus?: boolean;
  tabIndex?: number;
  registerNode?: (id: string, el: HTMLElement | null) => void;
  onFocusRow?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLElement>) => void;
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
  isFocused = false,
  treeHasFocus = true,
  tabIndex = -1,
  registerNode,
  onFocusRow,
  onKeyDown,
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
    registerNode: registerNode ?? (() => {}),
    dragIdPrefix: "tree-drag:",
    folderDropIdPrefix: "tree-folder:",
    dragType: "sources-tree-item",
    folderDropType: "sources-tree-folder",
  });

  const validTargetFolders = (allFolders ?? []).filter((f) =>
    canMove ? canMove(source.id, f.id) : f.id !== source.folderId,
  );

  const statusText = degraded
    ? [sourceQualityReasonLabel(source) ?? statusLabel, sourceQualityCorrectiveAction(source)]
        .filter(Boolean)
        .join(" · ")
    : status !== "ready"
      ? statusLabel
      : undefined;

  const rowContainer = (
    <div
      ref={setNodeRefs}
      {...rowDragProps}
      role="treeitem"
      aria-level={depth + 1}
      aria-selected={isFocused}
      aria-label={source.title}
      data-slot="sources-tree-source-row"
      data-size="sm"
      data-selected={isFocused ? "true" : undefined}
      data-focused={isFocused ? "true" : undefined}
      data-renaming={isEditing ? "true" : undefined}
      data-dragging={isDragging ? "true" : undefined}
      tabIndex={tabIndex}
      style={{ "--tree-row-pad": `calc(var(--tree-root-inset) + ${depth} * var(--tree-indent-step))` } as React.CSSProperties}
      title={tooltip}
      className={cn(
        getTreeRowClassName({
          isSelected: isFocused,
          treeHasFocus,
          isDragging,
          isRenaming: isEditing,
        }),
        // Reserve room for the hover action cluster so labels never slide under it.
        "pr-14",
      )}
      onFocus={(e) => {
        if (e.target === e.currentTarget) {
          onFocusRow?.();
        }
      }}
      onClick={
        isEditing
          ? undefined
          : (e) => {
              (e.currentTarget as HTMLElement).focus();
              onClick();
            }
      }
      onKeyDown={(e) => {
        if (isEditing) return;
        onKeyDown?.(e);
      }}
    >
      {active ? (
        <Loader2 className="size-(--tree-icon-size) shrink-0 animate-spin text-primary" />
      ) : failed ? (
        <AlertCircle className="size-(--tree-icon-size) shrink-0 text-destructive" strokeWidth={1.7} />
      ) : degraded ? (
        <AlertTriangle className="size-(--tree-icon-size) shrink-0 text-warning" strokeWidth={1.7} />
      ) : (
        <SourceIcon source={source} className="size-(--tree-icon-size) shrink-0" />
      )}
      {isEditing ? (
        <InlineRename
          initialValue={source.title}
          onCommit={(val) => onRenameCommit?.(source.id, val)}
          onCancel={() => onRenameCancel?.()}
          ariaLabel={source.title}
          size="sm"
        />
      ) : (
        <span className="min-w-0 flex-1 truncate leading-none" title={source.title}>
          {source.title}
        </span>
      )}
      {statusText && (
        <span className="max-w-36 shrink-0 truncate text-xs opacity-75">{statusText}</span>
      )}

      <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-1 opacity-0 transition-opacity group-hover/tree-row:opacity-100 group-focus-within/tree-row:opacity-100">
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
