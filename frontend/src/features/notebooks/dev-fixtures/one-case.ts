import type { Notebook } from "../types/notebook.types";
import type { Source } from "@/features/sources/types/source.types";
import type { SourceFolder } from "@/features/sources/types/source-folder.types";
import type { StudyMaterialDTO } from "@/features/study-material-viewer/types/study-material.types";
import type { FolderDTO } from "@/features/study-material-tree/types/folder.types";
import type { ChatMessageDTO } from "@/features/notebook-chat/api/chat";

export const oneCaseNotebook: Notebook = {
  id: "one-case-notebook",
  title: "Solo",
  description: "A single notebook with exactly 1 item in every collection to test pluralization.",
  icon: "BookOpen",
  folderId: null,
  banner: null,
  bannerUrl: null,
  bannerVariants: null,
  bannerFocalPoint: null,
  groundingMode: "strict",
  createdAt: "2026-02-01T00:00:00.000Z",
  updatedAt: "2026-02-01T00:00:00.000Z",
};

export const oneCaseSourceFolders: SourceFolder[] = [];

export const oneCaseSources: Source[] = [
  {
    id: "src-solo-1",
    notebookId: "one-case-notebook",
    folderId: null,
    kind: "file",
    modality: "document",
    title: "Solo Reference Document.pdf",
    url: null,
    contentType: "application/pdf",
    fileSize: 1024,
    processingStatus: "ready",
    createdAt: "2026-02-01T01:00:00.000Z",
  },
];

export const oneCaseStudyMaterialFolders: FolderDTO[] = [];

export const oneCaseStudyMaterials: StudyMaterialDTO[] = [
  {
    id: "sm-solo-1",
    notebookId: "one-case-notebook",
    folderId: null,
    kind: "study_guide",
    title: "Solo Study Guide",
    content: { sections: [] },
    options: null,
    deletedAt: null,
    createdAt: "2026-02-01T02:00:00.000Z",
    updatedAt: "2026-02-01T02:00:00.000Z",
  },
];

export const oneCaseChatMessages: ChatMessageDTO[] = [
  {
    id: "msg-solo-1",
    role: "user",
    content: "Hello! This is the only message.",
    parts: [{ type: "text", text: "Hello! This is the only message." }],
    metadata: {},
    groundingMode: "strict",
    citedSourceIds: null,
    citedSources: [],
    createdAt: "2026-02-01T03:00:00.000Z",
  },
];
