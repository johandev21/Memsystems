import type React from "react";
import type { SourcesTreeNode } from "../model/sources-tree";
import type { Source } from "../api/sources";
import type { SourceFolder } from "../types/source-folder.types";
import { SourceFolderRow } from "./source-folder-row";
import { SourceRow } from "./sources-list/source-row";

export interface SourcesTreeBranchProps {
  node: SourcesTreeNode;
  allFolders?: readonly SourceFolder[];
  depth: number;
  openFolderIds: Set<string>;
  onToggleFolder: (folderId: string) => void;
  onCreateFolder: (parentId: string | null) => void;
  onMove?: (itemId: string, targetFolderId: string | null) => void;
  canMove?: (draggedItemId: string, targetFolderId: string | null) => boolean;
  setFolderOpen?: (folderId: string, open: boolean) => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  onSelectSource: (id: string) => void;
  onDeleteSource: (source: Source) => void;
  onRetrySource: (source: Source) => void;
  onCancelSource: (source: Source) => void;
  deletingId?: string;
  retryingId?: string;
  cancellingId?: string;
  editingItemId?: string | null;
  onBeginRename?: (id: string) => void;
  onRenameCommit?: (id: string, nextName: string) => void;
  onRenameCancel?: () => void;
  onDeleteFolder?: (folderId: string) => void;
  focusedItemId?: string | null;
  treeHasFocus?: boolean;
  registerNode?: (id: string, el: HTMLElement | null) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLElement>, node: SourcesTreeNode) => void;
  onFocusItem?: (id: string) => void;
  isMultiselectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleItemSelect?: (id: string) => void;
  onToggleFolderSelect?: (descendantIds: string[]) => void;
  isFolderSelected?: (descendantIds: string[]) => boolean | "indeterminate";
  searchQuery?: string;
}

function getDescendantSourceIds(node: SourcesTreeNode): string[] {
  const ids: string[] = [];
  const walk = (n: SourcesTreeNode) => {
    if (n.type === "source" && n.source) {
      ids.push(n.source.id);
    }
    for (const child of n.children) {
      walk(child);
    }
  };
  walk(node);
  return ids;
}

export function SourcesTreeNodeRow({
  node,
  allFolders,
  depth,
  openFolderIds,
  onToggleFolder,
  onCreateFolder,
  onMove,
  canMove,
  setFolderOpen,
  onExpandAll,
  onCollapseAll,
  onSelectSource,
  onDeleteSource,
  onRetrySource,
  onCancelSource,
  deletingId,
  retryingId,
  cancellingId,
  editingItemId,
  onBeginRename,
  onRenameCommit,
  onRenameCancel,
  onDeleteFolder,
  focusedItemId = null,
  treeHasFocus,
  registerNode,
  onKeyDown,
  onFocusItem,
  isMultiselectMode = false,
  selectedIds,
  onToggleItemSelect,
  onToggleFolderSelect,
  isFolderSelected,
  searchQuery,
}: SourcesTreeBranchProps) {
  if (node.type === "source" && node.source) {
    const sourceId = node.source.id;
    const isSelected = selectedIds?.has(sourceId) ?? false;
    const bundledIds =
      isMultiselectMode && isSelected && selectedIds
        ? Array.from(selectedIds)
        : undefined;

    return (
      <SourceRow
        source={node.source}
        allFolders={allFolders}
        depth={depth}
        onClick={() => onSelectSource(node.source!.id)}
        onDelete={() => onDeleteSource(node.source!)}
        onRetry={() => onRetrySource(node.source!)}
        onCancel={() => onCancelSource(node.source!)}
        onMove={onMove}
        canMove={canMove}
        deleting={deletingId === node.source.id}
        retrying={retryingId === node.source.id}
        cancelling={cancellingId === node.source.id}
        isEditing={editingItemId === node.source.id}
        onBeginRename={onBeginRename}
        onRenameCommit={onRenameCommit}
        onRenameCancel={onRenameCancel}
        isFocused={focusedItemId === sourceId}
        treeHasFocus={treeHasFocus}
        tabIndex={focusedItemId === sourceId ? 0 : -1}
        registerNode={registerNode}
        onFocusRow={onFocusItem ? () => onFocusItem(sourceId) : undefined}
        onKeyDown={(e) => onKeyDown?.(e, node)}
        isMultiselectMode={isMultiselectMode}
        isSelected={isSelected}
        onToggleSelect={onToggleItemSelect ? () => onToggleItemSelect(sourceId) : undefined}
        searchQuery={searchQuery}
        bundledIds={bundledIds}
      />
    );
  }

  const isOpen = openFolderIds.has(node.id);
  const folder = {
    id: node.id,
    name: node.name,
    parentId: node.parentId,
    createdAt: node.createdAt,
    notebookId: "",
    updatedAt: node.createdAt,
  };

  const descendantIds = getDescendantSourceIds(node);
  const folderSelectionState = isFolderSelected ? isFolderSelected(descendantIds) : false;
  const folderBundledIds =
    isMultiselectMode && selectedIds && selectedIds.size > 0
      ? Array.from(selectedIds)
      : undefined;

  return (
    <SourceFolderRow
      folder={folder}
      allFolders={allFolders}
      depth={depth}
      isOpen={isOpen}
      onToggleOpen={() => onToggleFolder(node.id)}
      onCreateChildFolder={() => onCreateFolder(node.id)}
      onMove={onMove}
      canMove={canMove}
      setFolderOpen={setFolderOpen}
      onExpandAll={onExpandAll}
      onCollapseAll={onCollapseAll}
      isEditing={editingItemId === folder.id}
      onBeginRename={onBeginRename}
      onRenameCommit={onRenameCommit}
      onRenameCancel={onRenameCancel}
      onDelete={onDeleteFolder}
      level={depth + 1}
      tabIndex={focusedItemId === folder.id ? 0 : -1}
      isFocused={focusedItemId === folder.id}
      treeHasFocus={treeHasFocus}
      registerNode={registerNode}
      onFocus={onFocusItem ? () => onFocusItem(folder.id) : undefined}
      onKeyDown={(e) => onKeyDown?.(e, node)}
      isMultiselectMode={isMultiselectMode}
      isSelected={folderSelectionState}
      onToggleSelect={
        onToggleFolderSelect ? () => onToggleFolderSelect(descendantIds) : undefined
      }
      searchQuery={searchQuery}
      bundledIds={folderBundledIds}
    />
  );
}

export function SourcesTreeBranch(props: SourcesTreeBranchProps) {
  const { node, depth } = props;
  const isOpen = node.type === "folder" ? props.openFolderIds.has(node.id) : false;

  return (
    <div data-slot="sources-tree-branch" data-size="sm" className="flex flex-col">
      <SourcesTreeNodeRow {...props} />
      {isOpen && node.children.length > 0 && (
        <div
          data-slot="sources-tree-branch-children"
          data-size="sm"
          className="flex flex-col"
        >
          {node.children.map((child) => (
            <SourcesTreeBranch key={child.id} {...props} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
