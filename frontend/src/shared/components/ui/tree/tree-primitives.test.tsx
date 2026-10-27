import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  canMoveFolder,
  findTreeNode,
  flattenVisibleTree,
  getActiveFolderIds,
  getDescendantFolderIds,
  getInitialExpandedIds,
  getTreeRowClassName,
  getTreeRowPadStyle,
  InlineRename,
  reconcileExpandedIds,
  treeVariants,
  useControllableFolderExpansion,
  usePendingTreeCommands,
  usePersistentExpandedFolders,
  useTreeController,
  useTreeFocusRegistry,
  useTreeKeyboardNav,
  type BaseTreeNode,
} from "./index";

describe("Shared Tree Primitives", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe("variants and token styling", () => {
    it("generates correct classes for all size variants", () => {
      expect(treeVariants({ size: "sm" })).toContain("data-[size=sm]:[--tree-row-height:calc(var(--spacing)*6)]");
      expect(treeVariants({ size: "default" })).toContain("data-[size=default]:[--tree-row-height:calc(var(--spacing)*7)]");
      expect(treeVariants({ size: "lg" })).toContain("data-[size=lg]:[--tree-row-height:calc(var(--spacing)*8)]");
    });

    it("calculates indentation style correctly based on depth", () => {
      const style0 = getTreeRowPadStyle(0) as Record<string, string>;
      expect(style0["--tree-row-pad"]).toBe("calc(var(--tree-root-inset) + 0 * var(--tree-indent-step))");

      const style2 = getTreeRowPadStyle(2) as Record<string, string>;
      expect(style2["--tree-row-pad"]).toBe("calc(var(--tree-root-inset) + 2 * var(--tree-indent-step))");
    });

    it("builds row class name based on state flags", () => {
      const normalClass = getTreeRowClassName({ isSelected: false });
      expect(normalClass).toContain("group/tree-row");
      expect(normalClass).not.toContain("bg-accent/35");

      const selectedFocusedClass = getTreeRowClassName({ isSelected: true, treeHasFocus: true });
      expect(selectedFocusedClass).toContain("bg-accent/35");

      const dropTargetClass = getTreeRowClassName({ isOver: true, canAcceptDrop: true });
      expect(dropTargetClass).toContain("bg-accent/60");

      const draggingClass = getTreeRowClassName({ isDragging: true });
      expect(draggingClass).toContain("opacity-35");
    });
  });

  describe("tree-utils", () => {
    const sampleTree: BaseTreeNode[] = [
      {
        id: "f1",
        type: "folder",
        name: "Folder 1",
        parentId: null,
        children: [
          { id: "item1", type: "item", name: "Item 1", parentId: "f1", children: [] },
          {
            id: "f2",
            type: "folder",
            name: "Folder 2",
            parentId: "f1",
            children: [
              { id: "item2", type: "item", name: "Item 2", parentId: "f2", children: [] },
            ],
          },
        ],
      },
      { id: "item3", type: "item", name: "Item 3", parentId: null, children: [] },
    ];

    it("flattens visible tree according to open folder IDs", () => {
      // When no folders are open
      const closed = flattenVisibleTree(sampleTree, new Set());
      expect(closed.map((n) => n.id)).toEqual(["f1", "item3"]);

      // When f1 is open but f2 is closed
      const f1Open = flattenVisibleTree(sampleTree, new Set(["f1"]));
      expect(f1Open.map((n) => n.id)).toEqual(["f1", "item1", "f2", "item3"]);

      // When both f1 and f2 are open
      const bothOpen = flattenVisibleTree(sampleTree, new Set(["f1", "f2"]));
      expect(bothOpen.map((n) => n.id)).toEqual(["f1", "item1", "f2", "item2", "item3"]);
    });

    it("finds a tree node at any depth", () => {
      expect(findTreeNode(sampleTree, "f1")?.name).toBe("Folder 1");
      expect(findTreeNode(sampleTree, "item2")?.name).toBe("Item 2");
      expect(findTreeNode(sampleTree, "non-existent")).toBeNull();
      expect(findTreeNode(sampleTree, null)).toBeNull();
    });

    it("computes descendant folder IDs correctly", () => {
      const folders = [
        { id: "root1", parentId: null, deletedAt: null },
        { id: "child1", parentId: "root1", deletedAt: null },
        { id: "grandchild1", parentId: "child1", deletedAt: null },
        { id: "root2", parentId: null, deletedAt: null },
      ];

      const descendants = getDescendantFolderIds(folders, "root1");
      expect(descendants.has("child1")).toBe(true);
      expect(descendants.has("grandchild1")).toBe(true);
      expect(descendants.has("root2")).toBe(false);
    });

    it("guards folder moves against self, parent, and descendants", () => {
      const folders = [
        { id: "a", parentId: null, deletedAt: null },
        { id: "b", parentId: "a", deletedAt: null },
        { id: "c", parentId: "b", deletedAt: null },
        { id: "d", parentId: null, deletedAt: null },
      ];

      // Cannot move onto self
      expect(canMoveFolder(folders, "a", "a")).toBe(false);
      // Cannot move onto current parent (already there)
      expect(canMoveFolder(folders, "b", "a")).toBe(false);
      // Cannot move parent into its own descendant
      expect(canMoveFolder(folders, "a", "b")).toBe(false);
      expect(canMoveFolder(folders, "a", "c")).toBe(false);
      // Can move into an unrelated folder or root
      expect(canMoveFolder(folders, "b", "d")).toBe(true);
      expect(canMoveFolder(folders, "b", null)).toBe(true);
    });
  });

  describe("expansion hooks and persistence", () => {
    it("handles controlled and uncontrolled folder expansion", () => {
      const onExpandedChange = vi.fn();
      const { result, rerender } = renderHook(
        ({ expandedIds }) => useControllableFolderExpansion(["f1", "f2"], expandedIds, onExpandedChange),
        { initialProps: { expandedIds: undefined as Set<string> | undefined } },
      );

      expect(result.current.openFolderIds.has("f1")).toBe(true);
      expect(result.current.openFolderIds.has("f2")).toBe(true);

      act(() => {
        result.current.setOpenFolderIds(new Set(["f1"]));
      });
      expect(result.current.openFolderIds.has("f2")).toBe(false);

      // Controlled mode
      const controlledSet = new Set(["f2"]);
      rerender({ expandedIds: controlledSet });
      expect(result.current.openFolderIds.has("f2")).toBe(true);
      expect(result.current.openFolderIds.has("f1")).toBe(false);
    });

    it("prunes deleted folders and expands newly added root folders", () => {
      const initialFolders = [
        { id: "f1", parentId: null, deletedAt: null },
        { id: "f2", parentId: null, deletedAt: null },
      ];
      expect(getActiveFolderIds(initialFolders)).toEqual(new Set(["f1", "f2"]));
      expect(getInitialExpandedIds(initialFolders, null)).toEqual(new Set(["f1", "f2"]));

      // After adding a new root folder f3 and deleting f1
      const updatedFolders = [
        { id: "f1", parentId: null, deletedAt: "2026-09-28T00:00:00.000Z" },
        { id: "f2", parentId: null, deletedAt: null },
        { id: "f3", parentId: null, deletedAt: null },
      ];
      const previousFolderIds = new Set(["f1", "f2"]);
      const reconciled = reconcileExpandedIds(updatedFolders, new Set(["f1", "f2"]), previousFolderIds);
      expect(reconciled.has("f1")).toBe(false); // pruned
      expect(reconciled.has("f2")).toBe(true);
      expect(reconciled.has("f3")).toBe(true); // new root folder auto-expanded
    });

    it("persists expanded folders per notebook key in localStorage", () => {
      const folders = [
        { id: "f1", parentId: null, deletedAt: null },
        { id: "f2", parentId: null, deletedAt: null },
      ];

      const { result } = renderHook(() =>
        usePersistentExpandedFolders("nb-101", folders, "test:expanded:"),
      );

      expect(result.current[0].has("f1")).toBe(true);

      act(() => {
        result.current[1](new Set(["f1"]));
      });

      expect(localStorage.getItem("test:expanded:nb-101")).toBe(JSON.stringify(["f1"]));
    });
  });

  describe("useTreeFocusRegistry", () => {
    it("registers nodes and triggers DOM focus", () => {
      const onFocusItem = vi.fn();
      const { result } = renderHook(() => useTreeFocusRegistry(onFocusItem));

      const mockElement = document.createElement("button");
      const focusSpy = vi.spyOn(mockElement, "focus");

      act(() => {
        result.current.registerNode("item-1", mockElement);
        result.current.focus("item-1");
      });

      expect(onFocusItem).toHaveBeenCalledWith("item-1");
      expect(focusSpy).toBeDefined();
    });
  });

  describe("usePendingTreeCommands", () => {
    it("tracks pending state during asynchronous command execution", async () => {
      const mockExecutor = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { ok: true as const };
      });

      const { result } = renderHook(() => usePendingTreeCommands(mockExecutor));

      expect(result.current.isPending("cmd-1")).toBe(false);

      let promise: Promise<unknown>;
      act(() => {
        promise = result.current.runPendingCommand("cmd-1", { type: "test" });
      });

      expect(result.current.isPending("cmd-1")).toBe(true);
      expect(result.current.pendingKeys.has("cmd-1")).toBe(true);

      await act(async () => {
        await promise;
      });

      expect(result.current.isPending("cmd-1")).toBe(false);
      expect(result.current.pendingKeys.size).toBe(0);
    });
  });

  describe("useTreeKeyboardNav", () => {
    const visibleItems: BaseTreeNode[] = [
      { id: "f1", type: "folder", name: "Folder 1", parentId: null, children: [{ id: "item1", type: "item", name: "Item 1", parentId: "f1", children: [] }] },
      { id: "item1", type: "item", name: "Item 1", parentId: "f1", children: [] },
      { id: "f2", type: "folder", name: "Folder 2", parentId: null, children: [] },
    ];

    it("navigates down and up, Home and End", () => {
      const focus = vi.fn();
      const activate = vi.fn();
      const beginRename = vi.fn();
      const setFolderOpen = vi.fn();
      const openFolderIds = new Set(["f1"]);

      const { result } = renderHook(() =>
        useTreeKeyboardNav({
          activeDragItemId: null,
          visibleItems,
          openFolderIds,
          setFolderOpen,
          focus,
          activate,
          beginRename,
        }),
      );

      // ArrowDown from f1 moves to item1
      result.current.handleKeyDown({ key: "ArrowDown", preventDefault: vi.fn() } as never, visibleItems[0]!);
      expect(focus).toHaveBeenCalledWith("item1");

      // ArrowUp from item1 moves to f1
      result.current.handleKeyDown({ key: "ArrowUp", preventDefault: vi.fn() } as never, visibleItems[1]!);
      expect(focus).toHaveBeenCalledWith("f1");

      // Home moves to first item
      result.current.handleKeyDown({ key: "Home", preventDefault: vi.fn() } as never, visibleItems[2]!);
      expect(focus).toHaveBeenCalledWith("f1");

      // End moves to last item
      result.current.handleKeyDown({ key: "End", preventDefault: vi.fn() } as never, visibleItems[0]!);
      expect(focus).toHaveBeenCalledWith("f2");
    });

    it("handles ArrowRight to expand folder or step into first child", () => {
      const focus = vi.fn();
      const setFolderOpen = vi.fn();

      const { result } = renderHook(() =>
        useTreeKeyboardNav({
          activeDragItemId: null,
          visibleItems,
          openFolderIds: new Set<string>(), // f1 is closed
          setFolderOpen,
          focus,
          activate: vi.fn(),
          beginRename: vi.fn(),
        }),
      );

      // Closed folder: ArrowRight expands it
      result.current.handleKeyDown({ key: "ArrowRight", preventDefault: vi.fn() } as never, visibleItems[0]!);
      expect(setFolderOpen).toHaveBeenCalledWith("f1", true);

      // Open folder: ArrowRight steps into first child
      const { result: openResult } = renderHook(() =>
        useTreeKeyboardNav({
          activeDragItemId: null,
          visibleItems,
          openFolderIds: new Set(["f1"]),
          setFolderOpen,
          focus,
          activate: vi.fn(),
          beginRename: vi.fn(),
        }),
      );
      openResult.current.handleKeyDown({ key: "ArrowRight", preventDefault: vi.fn() } as never, visibleItems[0]!);
      expect(focus).toHaveBeenCalledWith("item1");
    });

    it("handles ArrowLeft to collapse folder or step out to parent", () => {
      const focus = vi.fn();
      const setFolderOpen = vi.fn();

      const { result } = renderHook(() =>
        useTreeKeyboardNav({
          activeDragItemId: null,
          visibleItems,
          openFolderIds: new Set(["f1"]), // f1 is open
          setFolderOpen,
          focus,
          activate: vi.fn(),
          beginRename: vi.fn(),
        }),
      );

      // Open folder: ArrowLeft collapses it
      result.current.handleKeyDown({ key: "ArrowLeft", preventDefault: vi.fn() } as never, visibleItems[0]!);
      expect(setFolderOpen).toHaveBeenCalledWith("f1", false);

      // Child item: ArrowLeft moves focus to its parent f1
      result.current.handleKeyDown({ key: "ArrowLeft", preventDefault: vi.fn() } as never, visibleItems[1]!);
      expect(focus).toHaveBeenCalledWith("f1");
    });

    it("triggers Enter, F2, and Delete bindings", () => {
      const activate = vi.fn();
      const beginRename = vi.fn();
      const requestDelete = vi.fn();

      const { result } = renderHook(() =>
        useTreeKeyboardNav({
          activeDragItemId: null,
          visibleItems,
          openFolderIds: new Set(),
          setFolderOpen: vi.fn(),
          focus: vi.fn(),
          activate,
          beginRename,
          requestDelete,
        }),
      );

      result.current.handleKeyDown({ key: "Enter", preventDefault: vi.fn() } as never, visibleItems[0]!);
      expect(activate).toHaveBeenCalledWith(visibleItems[0]);

      result.current.handleKeyDown({ key: "F2", preventDefault: vi.fn() } as never, visibleItems[0]!);
      expect(beginRename).toHaveBeenCalledWith("f1");

      result.current.handleKeyDown({ key: "Delete", preventDefault: vi.fn() } as never, visibleItems[0]!);
      expect(requestDelete).toHaveBeenCalledWith(visibleItems[0]);
    });
  });

  describe("InlineRename component", () => {
    it("commits on Enter and cancels on Escape", async () => {
      const onCommit = vi.fn();
      const onCancel = vi.fn();
      const user = userEvent.setup();

      const { rerender } = render(
        <InlineRename initialValue="Original" onCommit={onCommit} onCancel={onCancel} ariaLabel="Item name" />,
      );

      const input = screen.getByLabelText("Item name");
      expect((input as HTMLInputElement).value).toBe("Original");

      await user.clear(input);
      await user.type(input, "New Name{Enter}");
      expect(onCommit).toHaveBeenCalledWith("New Name");

      rerender(
        <InlineRename initialValue="Original" onCommit={onCommit} onCancel={onCancel} ariaLabel="Item name" />,
      );
      await user.type(input, "{Escape}");
      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe("useTreeController generic orchestrator", () => {
    it("coordinates selection, expansion, renaming, and deletion", async () => {
      const tree: BaseTreeNode[] = [
        { id: "f1", type: "folder", name: "Folder 1", parentId: null, children: [] },
        { id: "i1", type: "item", name: "Item 1", parentId: null, children: [] },
      ];
      let selectedId: string | null = null;
      const setSelectedId = (id: string | null) => {
        selectedId = id;
      };

      const onRenameItem = vi.fn();
      const onDeleteItem = vi.fn();
      const onActivate = vi.fn();

      const { result } = renderHook(() =>
        useTreeController({
          tree,
          allFolderIds: ["f1"],
          selectedId,
          setSelectedId,
          onRenameItem,
          onDeleteItem,
          onActivate,
        }),
      );

      // Select node
      act(() => {
        result.current.select(tree[0]!);
      });
      expect(result.current.focusedItemId).toBe("f1");

      // Folder starts open from initial folder list
      expect(result.current.isFolderOpen("f1")).toBe(true);

      // Activate folder toggles expansion off
      act(() => {
        result.current.activate(tree[0]!);
      });
      expect(result.current.isFolderOpen("f1")).toBe(false);

      // Activate folder toggles expansion on again
      act(() => {
        result.current.activate(tree[0]!);
      });
      expect(result.current.isFolderOpen("f1")).toBe(true);

      // Activate leaf calls onActivate
      act(() => {
        result.current.activate(tree[1]!);
      });
      expect(onActivate).toHaveBeenCalledWith(tree[1]);

      // Begin and commit rename
      act(() => {
        result.current.beginRename("i1");
      });
      expect(result.current.isRenaming("i1")).toBe(true);

      await act(async () => {
        await result.current.commitRename("i1", "New Title");
      });
      expect(onRenameItem).toHaveBeenCalledWith("i1", "New Title");
      expect(result.current.isRenaming("i1")).toBe(false);

      // Request and confirm delete
      act(() => {
        result.current.requestDelete(tree[1]!);
      });
      expect(result.current.pendingDelete).toEqual({ id: "i1", name: "Item 1", type: "item" });

      await act(async () => {
        await result.current.confirmDelete();
      });
      expect(onDeleteItem).toHaveBeenCalledWith({ id: "i1", name: "Item 1", type: "item" });
      expect(result.current.pendingDelete).toBeNull();
    });
  });
});
