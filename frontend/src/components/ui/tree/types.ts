export type TreeSize = "sm" | "default" | "lg";

export interface BaseTreeNode {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly parentId?: string | null;
  readonly children?: readonly any[];
}

export interface TreePendingDelete<TType extends string = string> {
  readonly id: string;
  readonly name: string;
  readonly type: TType;
}

export interface TreeDragData<TDragType extends string = string> {
  readonly type: TDragType;
  readonly itemId: string;
}

export type TreeDropData<
  TRootType extends string = string,
  TFolderType extends string = string,
> =
  | { readonly type: TRootType; readonly folderId: null }
  | { readonly type: TFolderType; readonly folderId: string };

export type TreeCommandResult =
  | { readonly ok: true; readonly newId?: string }
  | { readonly ok: false; readonly error: string };

export type TreeCommandExecutor<TCommand = unknown> = (
  command: TCommand,
) => Promise<TreeCommandResult>;

export interface TreeControllerState<TType extends string = string> {
  readonly openFolderIds: Set<string>;
  readonly focusedItemId: string | null;
  readonly renamingItemId: string | null;
  readonly pendingDelete: TreePendingDelete<TType> | null;
  readonly activeDragItemId: string | null;
  readonly treeHasFocus: boolean;
  readonly pendingKeys: Set<string>;
}
