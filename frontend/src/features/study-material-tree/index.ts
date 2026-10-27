export * from "./components/study-materials-panel";
export * from "./components/mobile-study-materials-panel";
export * from "./components/ui/study-materials-tree";
export * from "./components/ui/study-materials-tree-container";
export * from "./api/folders";
export type { FolderDTO as StudyMaterialFolder, FolderDTO, CreateFolderInput } from "./types/folder.types";
export * from "./hooks/use-study-materials-tree-data";
export { useProductionTreeAdapter } from "./components/model/production-adapter";
export { usePersistentExpandedFolders } from "./components/model/use-expanded";
export {
  useControllableFolderExpansion,
  useTreeFocusRegistry,
  usePendingTreeCommands,
} from "./components/ui/controller-hooks";
export {
  useStudyMaterialsTreeController,
  type TreeController,
} from "./components/ui/controller-state";
export {
  buildStudyMaterialTree,
  getDescendantFolderIds,
  canMoveItem,
  moveItem,
  renameItem,
  createFolder as createLocalTreeFolder,
  duplicateMaterial,
  softDeleteItem,
  getItemName,
  type StudyMaterialTreeFolder,
  type StudyMaterialTreeMaterial,
  type TreeState,
  type TreeNode,
} from "./components/model/tree";
export * from "./components/model/commands";
