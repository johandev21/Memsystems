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
} from "@/shared/components/ui/context-menu";
import { HighlightMatch, InlineRename, getTreeRowClassName, useTreeRowDragDrop } from "@/shared/components/ui/tree";
import { cn } from "@/shared/utils/cn";
import { sourceDisplayTitle } from "../../utils/source-display-title";
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
  searchQuery?: string;
}

type SourceRowPresentation = {
  active: boolean;
  failed: boolean;
  degraded: boolean;
  tooltip: string;
  statusText?: string;
};

export function SourceRow(props: SourceRowProps) {
  const presentation = getSourceRowPresentation(props.source);
  const validTargetFolders = getValidTargetFolders(
    props.source,
    props.allFolders,
    props.canMove,
  );

  return (
    <SourceRowItem
      {...props}
      presentation={presentation}
      validTargetFolders={validTargetFolders}
    />
  );
}

function getSourceRowPresentation(source: Source): SourceRowPresentation {
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

  const statusText = degraded
    ? [sourceQualityReasonLabel(source) ?? statusLabel, sourceQualityCorrectiveAction(source)]
        .filter(Boolean)
        .join(" · ")
    : status !== "ready"
      ? statusLabel
      : undefined;

  return { active, failed, degraded, tooltip, statusText };
}

function getValidTargetFolders(
  source: Source,
  allFolders: readonly SourceFolder[] | undefined,
  canMove: SourceRowProps["canMove"],
): SourceFolder[] {
  return (allFolders ?? []).filter((folder) =>
    canMove ? canMove(source.id, folder.id) : folder.id !== source.folderId,
  );
}

type SourceRowItemProps = SourceRowProps & {
  presentation: SourceRowPresentation;
  validTargetFolders: SourceFolder[];
};

function SourceRowItem({
  source,
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
  searchQuery,
  presentation,
  validTargetFolders,
}: SourceRowItemProps) {
  const { active, failed, degraded, tooltip, statusText } = presentation;
  const { isDragging, setNodeRefs, rowDragProps } = useTreeRowDragDrop({
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

  const rowContainer = (
    <div
      ref={setNodeRefs}
      {...rowDragProps}
      role="treeitem"
      aria-level={depth + 1}
      aria-selected={isFocused}
      aria-label={sourceDisplayTitle(source)}
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
      <SourceStatusIcon source={source} active={active} failed={failed} degraded={degraded} />
      <SourceRowText
        source={source}
        isEditing={isEditing}
        searchQuery={searchQuery}
        statusText={statusText}
        onRenameCommit={onRenameCommit}
        onRenameCancel={onRenameCancel}
      />

      <SourceRowActions
        failed={failed}
        active={active}
        retrying={retrying}
        cancelling={cancelling}
        deleting={deleting}
        onRetry={onRetry}
        onCancel={onCancel}
        onDelete={onDelete}
      />
    </div>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger data-slot="source-row-trigger" render={rowContainer} />
      <SourceRowContextMenu
        source={source}
        validTargetFolders={validTargetFolders}
        failed={failed}
        active={active}
        onBeginRename={onBeginRename}
        onMove={onMove}
        onRetry={onRetry}
        onCancel={onCancel}
        onDelete={onDelete}
      />
    </ContextMenu>
  );
}

function SourceRowText({
  source,
  isEditing,
  searchQuery,
  statusText,
  onRenameCommit,
  onRenameCancel,
}: {
  source: Source;
  isEditing: boolean;
  searchQuery?: string;
  statusText?: string;
  onRenameCommit?: (id: string, nextName: string) => void;
  onRenameCancel?: () => void;
}) {
  return (
    <>
      {isEditing ? (
        <InlineRename
          initialValue={source.title}
          onCommit={(value) => onRenameCommit?.(source.id, value)}
          onCancel={() => {
            onRenameCancel?.();
          }}
          ariaLabel={sourceDisplayTitle(source)}
          size="sm"
        />
      ) : (
        <HighlightMatch
          text={sourceDisplayTitle(source)}
          query={searchQuery}
          className="flex-1 whitespace-nowrap leading-none"
        />
      )}
      {statusText && (
        <span className="max-w-20 sm:max-w-24 shrink-0 truncate text-xs opacity-75">
          {statusText}
        </span>
      )}
    </>
  );
}

function SourceStatusIcon({
  source,
  active,
  failed,
  degraded,
}: {
  source: Source;
  active: boolean;
  failed: boolean;
  degraded: boolean;
}) {
  if (active) return <Loader2 className="size-(--tree-icon-size) shrink-0 animate-spin text-primary" />;
  if (failed) return <AlertCircle className="size-(--tree-icon-size) shrink-0 text-destructive" strokeWidth={1.7} />;
  if (degraded) return <AlertTriangle className="size-(--tree-icon-size) shrink-0 text-warning" strokeWidth={1.7} />;
  return <SourceIcon source={source} className="size-(--tree-icon-size) shrink-0" />;
}

function SourceRowActions({
  failed,
  active,
  retrying,
  cancelling,
  deleting,
  onRetry,
  onCancel,
  onDelete,
}: {
  failed: boolean;
  active: boolean;
  retrying: boolean;
  cancelling: boolean;
  deleting: boolean;
  onRetry: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("sources");
  return (
    <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-1 opacity-0 transition-opacity group-hover/tree-row:opacity-100 group-focus-within/tree-row:opacity-100">
      {failed && (
        <button
          type="button"
          aria-label={t("sourceRow.retryProcessing")}
          title={t("sourceRow.retryProcessing")}
          onClick={(event) => {
            event.stopPropagation();
            onRetry();
          }}
          className="flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {retrying ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
        </button>
      )}
      {active && (
        <button
          type="button"
          aria-label={t("pendingUpload.cancelProcessing")}
          title={t("pendingUpload.cancelProcessing")}
          onClick={(event) => {
            event.stopPropagation();
            onCancel();
          }}
          className="flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {cancelling ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
        </button>
      )}
      <button
        type="button"
        aria-label={t("sourceRow.delete")}
        title={t("sourceRow.delete")}
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        className="flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-destructive"
      >
        {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
      </button>
    </div>
  );
}

function SourceRowContextMenu({
  source,
  validTargetFolders,
  failed,
  active,
  onBeginRename,
  onMove,
  onRetry,
  onCancel,
  onDelete,
}: {
  source: Source;
  validTargetFolders: SourceFolder[];
  failed: boolean;
  active: boolean;
  onBeginRename?: (id: string) => void;
  onMove?: (itemId: string, targetFolderId: string | null) => void;
  onRetry: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation(["sources", "tree"]);
  return (
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
                {validTargetFolders.map((folder) => (
                  <ContextMenuItem
                    key={folder.id}
                    data-slot={`move-source-target-${folder.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMove?.(source.id, folder.id);
                    }}
                  >
                    <Folder className="size-4 mr-2 text-muted-foreground" />
                    <span className="truncate">{folder.name}</span>
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
              <ContextMenuItem onClick={(e) => { e.stopPropagation(); onRetry(); }}>
                <RotateCcw className="size-4 mr-2" />
                {t("sources:sourceRow.retryProcessing", "Retry processing")}
              </ContextMenuItem>
            )}
            {active && (
              <ContextMenuItem onClick={(e) => { e.stopPropagation(); onCancel(); }}>
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
  );
}
