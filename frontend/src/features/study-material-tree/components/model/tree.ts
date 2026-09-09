import type { FolderDTO } from "../../types";
import type { StudyMaterialDTO } from "@/features/study-material-viewer";

export type StudyMaterialTreeFolder = FolderDTO;
export type StudyMaterialTreeMaterial = StudyMaterialDTO;

export type TreeState = {
  readonly folders: readonly StudyMaterialTreeFolder[];
  readonly materials: readonly StudyMaterialTreeMaterial[];
};

export type TreeNode = {
  readonly id: string;
  readonly type: "folder" | "material";
  readonly name: string;
  readonly parentId: string | null;
  readonly createdAt: string;
  readonly children: readonly TreeNode[];
  readonly materialKind?: StudyMaterialDTO["kind"];
};

export function buildStudyMaterialTree(state: TreeState): TreeNode[] {
  const activeFolders = state.folders.filter((folder) => !folder.deletedAt);
  const activeMaterials = state.materials.filter((material) => !material.deletedAt);

  const foldersByParent = new Map<string | null, StudyMaterialTreeFolder[]>();
  const materialsByParent = new Map<string | null, StudyMaterialTreeMaterial[]>();
  const folderIds = new Set(activeFolders.map((folder) => folder.id));

  for (const folder of activeFolders) {
    const parentId = folder.parentId && folderIds.has(folder.parentId) ? folder.parentId : null;
    addToMap(foldersByParent, parentId, folder);
  }

  for (const material of activeMaterials) {
    const parentId =
      material.folderId && folderIds.has(material.folderId) ? material.folderId : null;
    addToMap(materialsByParent, parentId, material);
  }

  const visit = (parentId: string | null): TreeNode[] => {
    const foldersForParent = (foldersByParent.get(parentId) ?? []).toSorted(byCreatedAtThenId);
    const materialsForParent = (materialsByParent.get(parentId) ?? []).toSorted(byCreatedAtThenId);

    return [
      ...foldersForParent.map((folder) => ({
        id: folder.id,
        type: "folder" as const,
        name: folder.name,
        parentId: folder.parentId,
        createdAt: folder.createdAt,
        children: visit(folder.id),
      })),
      ...materialsForParent.map((material) => ({
        id: material.id,
        type: "material" as const,
        name: material.title,
        parentId: material.folderId,
        createdAt: material.createdAt,
        materialKind: material.kind,
        children: [] as TreeNode[],
      })),
    ];
  };

  return visit(null);
}

export function flattenVisibleTree(
  nodes: readonly TreeNode[],
  openFolderIds: ReadonlySet<string>,
): TreeNode[] {
  const visibleNodes: TreeNode[] = [];

  const visit = (items: readonly TreeNode[]) => {
    for (const item of items) {
      visibleNodes.push(item);
      if (item.type === "folder" && openFolderIds.has(item.id)) {
        visit(item.children);
      }
    }
  };

  visit(nodes);
  return visibleNodes;
}

export function getDescendantFolderIds(
  folders: readonly StudyMaterialTreeFolder[],
  folderId: string,
): Set<string> {
  const descendants = new Set<string>();
  const childFolderIds = new Map<string, string[]>();

  for (const folder of folders) {
    if (!folder.deletedAt && folder.parentId) {
      addToMap(childFolderIds, folder.parentId, folder.id);
    }
  }

  const visit = (id: string) => {
    for (const childId of childFolderIds.get(id) ?? []) {
      descendants.add(childId);
      visit(childId);
    }
  };

  visit(folderId);
  return descendants;
}

export function canMoveItem(
  state: TreeState,
  itemId: string,
  targetFolderId: string | null,
): boolean {
  const folderById = new Map<string, StudyMaterialTreeFolder>();
  for (const folder of state.folders) {
    if (!folder.deletedAt) folderById.set(folder.id, folder);
  }

  const folder = folderById.get(itemId);
  if (folder) {
    if (folder.parentId === targetFolderId || folder.id === targetFolderId) return false;
    if (!targetFolderId) return true;
    const descendants = getDescendantFolderIds(state.folders, folder.id);
    return !descendants.has(targetFolderId);
  }

  const materialById = new Map<string, StudyMaterialTreeMaterial>();
  for (const material of state.materials) {
    if (!material.deletedAt) materialById.set(material.id, material);
  }

  const material = materialById.get(itemId);
  return Boolean(material && material.folderId !== targetFolderId);
}

export function moveItem(
  state: TreeState,
  itemId: string,
  targetFolderId: string | null,
  now: string = new Date().toISOString(),
): TreeState {
  if (!canMoveItem(state, itemId, targetFolderId)) return state;

  return {
    folders: state.folders.map((folder) =>
      folder.id === itemId ? { ...folder, parentId: targetFolderId, updatedAt: now } : folder,
    ),
    materials: state.materials.map((material) =>
      material.id === itemId ? { ...material, folderId: targetFolderId, updatedAt: now } : material,
    ),
  };
}

export function renameItem(
  state: TreeState,
  itemId: string,
  name: string,
  now: string = new Date().toISOString(),
): TreeState {
  const trimmedName = name.trim();
  if (!trimmedName) return state;

  const folder = state.folders.find((candidate) => candidate.id === itemId);
  if (folder && folder.name === trimmedName) return state;
  const material = state.materials.find((candidate) => candidate.id === itemId);
  if (material && material.title === trimmedName) return state;

  return {
    folders: state.folders.map((folder) =>
      folder.id === itemId ? { ...folder, name: trimmedName, updatedAt: now } : folder,
    ),
    materials: state.materials.map((material) =>
      material.id === itemId ? { ...material, title: trimmedName, updatedAt: now } : material,
    ),
  };
}

export function createFolder(
  parentId: string | null,
  id: string = `folder-${crypto.randomUUID()}`,
  now: string = new Date().toISOString(),
): StudyMaterialTreeFolder {
  // Use a placeholder notebookId; caller should override if needed. For fixture/local use this is acceptable.
  return {
    id,
    notebookId: "notebook-placeholder",
    parentId,
    name: "Untitled folder",
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function duplicateMaterial(
  state: TreeState,
  materialId: string,
  newId: string = `material-${crypto.randomUUID()}`,
  now: string = new Date().toISOString(),
): TreeState {
  const material = state.materials.find(
    (candidate) => candidate.id === materialId && !candidate.deletedAt,
  );
  if (!material) return state;

  return {
    ...state,
    materials: [
      ...state.materials,
      {
        ...material,
        id: newId,
        title: `${material.title} copy`,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

export function softDeleteItem(
  state: TreeState,
  itemId: string,
  now: string = new Date().toISOString(),
): TreeState {
  const folderById = new Map<string, StudyMaterialTreeFolder>();
  for (const folder of state.folders) {
    if (!folder.deletedAt) folderById.set(folder.id, folder);
  }

  const folder = folderById.get(itemId);

  if (!folder) {
    return {
      ...state,
      materials: state.materials.map((material) =>
        material.id === itemId ? { ...material, deletedAt: now, updatedAt: now } : material,
      ),
    };
  }

  const deletedFolderIds = new Set<string>([
    folder.id,
    ...getDescendantFolderIds(state.folders, folder.id),
  ]);
  return {
    folders: state.folders.map((candidate) =>
      deletedFolderIds.has(candidate.id)
        ? { ...candidate, deletedAt: now, updatedAt: now }
        : candidate,
    ),
    materials: state.materials.map((material) =>
      material.folderId && deletedFolderIds.has(material.folderId)
        ? { ...material, deletedAt: now, updatedAt: now }
        : material,
    ),
  };
}

export function getItemName(state: TreeState, itemId: string): string | null {
  const folderById = new Map<string, StudyMaterialTreeFolder>();
  for (const folder of state.folders) folderById.set(folder.id, folder);
  const materialById = new Map<string, StudyMaterialTreeMaterial>();
  for (const material of state.materials) materialById.set(material.id, material);

  return folderById.get(itemId)?.name ?? materialById.get(itemId)?.title ?? null;
}

function addToMap<T>(map: Map<string | null, T[]>, key: string | null, value: T) {
  const values = map.get(key) ?? [];
  values.push(value);
  map.set(key, values);
}

function byCreatedAtThenId<T extends { createdAt: string; id: string }>(first: T, second: T) {
  const timeCompare = first.createdAt.localeCompare(second.createdAt);
  if (timeCompare !== 0) return timeCompare;
  return first.id.localeCompare(second.id);
}
