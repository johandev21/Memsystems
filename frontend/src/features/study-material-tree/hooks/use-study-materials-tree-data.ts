import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { foldersQueryOptions } from "../api/folders";
import type { FolderDTO } from "../types/folder.types";
import {
  studyMaterialsQueryOptions,
  type StudyMaterialDTO,
} from "@/features/study-material-viewer";

export interface TreeSearchItem {
  id: string;
  name: string;
  folderId?: string | null;
}

export interface TreeSearchFolder {
  id: string;
  name: string;
  parentId?: string | null;
}

export function mapMaterialsToSearchItems(materials: StudyMaterialDTO[]): TreeSearchItem[] {
  return materials.map((m) => ({
    id: m.id,
    name: m.title,
    folderId: m.folderId,
  }));
}

export function mapFoldersToSearchItems(folders: FolderDTO[]): TreeSearchFolder[] {
  return folders.map((f) => ({
    id: f.id,
    name: f.name,
    parentId: f.parentId,
  }));
}

const EMPTY_FOLDERS: FolderDTO[] = [];
const EMPTY_MATERIALS: StudyMaterialDTO[] = [];

export function useStudyMaterialsTreeData(notebookId: string) {
  const { t } = useTranslation("tree");
  const foldersQuery = useQuery({
    ...foldersQueryOptions(notebookId),
    enabled: Boolean(notebookId),
  });
  const materialsQuery = useQuery({
    ...studyMaterialsQueryOptions(notebookId),
    enabled: Boolean(notebookId),
  });

  const folders = foldersQuery.data ?? EMPTY_FOLDERS;
  const materials = materialsQuery.data ?? EMPTY_MATERIALS;

  const isInitialLoading = foldersQuery.isPending || materialsQuery.isPending;
  const isError = foldersQuery.isError || materialsQuery.isError;
  const errorMessage =
    (foldersQuery.error as Error | undefined)?.message ??
    (materialsQuery.error as Error | undefined)?.message ??
    t("errors.loadFailed");
  const isFetching = foldersQuery.isFetching || materialsQuery.isFetching;
  const hasData = foldersQuery.isSuccess && materialsQuery.isSuccess;

  const handleRetry = useCallback(() => {
    void foldersQuery.refetch();
    void materialsQuery.refetch();
  }, [foldersQuery, materialsQuery]);

  const searchItems = useMemo(() => mapMaterialsToSearchItems(materials), [materials]);
  const searchFolders = useMemo(() => mapFoldersToSearchItems(folders), [folders]);

  return {
    folders,
    materials,
    searchItems,
    searchFolders,
    isInitialLoading,
    isError,
    errorMessage,
    isFetching,
    hasData,
    handleRetry,
  };
}

export type StudyMaterialsTreeData = ReturnType<typeof useStudyMaterialsTreeData>;
