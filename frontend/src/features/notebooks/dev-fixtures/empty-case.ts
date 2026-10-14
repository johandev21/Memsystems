import type { Notebook } from "../types/notebook.types";
import type { Source } from "@/features/sources/types/source.types";
import type { SourceFolder } from "@/features/sources/types/source-folder.types";
import type { StudyMaterialDTO } from "@/features/study-material-viewer/types/study-material.types";
import type { FolderDTO } from "@/features/study-material-tree/types/folder.types";
import type { ChatMessageDTO } from "@/features/notebook-chat/api/chat";

export const emptyCaseNotebook: Notebook = {
  id: "empty-case-notebook",
  title: "Untitled",
  description: "",
  icon: "notebook",
  folderId: null,
  banner: null,
  bannerUrl: null,
  bannerVariants: null,
  bannerFocalPoint: null,
  groundingMode: "strict",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

export const emptyCaseSourceFolders: SourceFolder[] = [];
export const emptyCaseSources: Source[] = [];
export const emptyCaseStudyMaterialFolders: FolderDTO[] = [];
export const emptyCaseStudyMaterials: StudyMaterialDTO[] = [];
export const emptyCaseChatMessages: ChatMessageDTO[] = [];
