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
}

export function SourcesTreeBranch({
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
}: SourcesTreeBranchProps) {
  if (node.type === "source" && node.source) {
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

  return (
    <div data-slot="sources-tree-branch" className="flex flex-col">
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
      />
      {isOpen && node.children.length > 0 && (
        <div data-slot="sources-tree-branch-children" className="flex flex-col">
          {node.children.map((child) => (
            <SourcesTreeBranch
              key={child.id}
              node={child}
              allFolders={allFolders}
              depth={depth + 1}
              openFolderIds={openFolderIds}
              onToggleFolder={onToggleFolder}
              onCreateFolder={onCreateFolder}
              onMove={onMove}
              canMove={canMove}
              setFolderOpen={setFolderOpen}
              onExpandAll={onExpandAll}
              onCollapseAll={onCollapseAll}
              onSelectSource={onSelectSource}
              onDeleteSource={onDeleteSource}
              onRetrySource={onRetrySource}
              onCancelSource={onCancelSource}
              deletingId={deletingId}
              retryingId={retryingId}
              cancellingId={cancellingId}
              editingItemId={editingItemId}
              onBeginRename={onBeginRename}
              onRenameCommit={onRenameCommit}
              onRenameCancel={onRenameCancel}
              onDeleteFolder={onDeleteFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}
