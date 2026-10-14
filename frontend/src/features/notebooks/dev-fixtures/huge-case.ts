import type { Notebook } from "../types/notebook.types";
import type { Source } from "@/features/sources/types/source.types";
import type { SourceFolder } from "@/features/sources/types/source-folder.types";
import type { StudyMaterialDTO } from "@/features/study-material-viewer/types/study-material.types";
import type { FolderDTO } from "@/features/study-material-tree/types/folder.types";
import type { ChatMessageDTO } from "@/features/notebook-chat/api/chat";

export const hugeCaseNotebook: Notebook = {
  id: "huge-case-notebook",
  title: "Massive Knowledge Base (1,000+ Items)",
  description: "Performance stress test containing 1,000 sources and hundreds of study materials.",
  icon: "Database",
  folderId: null,
  banner: null,
  bannerUrl: null,
  bannerVariants: null,
  bannerFocalPoint: null,
  groundingMode: "strict",
  createdAt: "2026-03-01T00:00:00.000Z",
  updatedAt: "2026-03-01T00:00:00.000Z",
};

export const hugeCaseSourceFolders: SourceFolder[] = Array.from({ length: 20 }, (_, i) => ({
  id: `huge-sf-${i + 1}`,
  notebookId: "huge-case-notebook",
  parentId: null,
  name: `Archive Category ${i + 1}: Technical Specifications`,
  createdAt: "2026-03-01T01:00:00.000Z",
  updatedAt: "2026-03-01T01:00:00.000Z",
}));

export const hugeCaseSources: Source[] = Array.from({ length: 1000 }, (_, i) => {
  const folderIndex = i % 25; // some without folder
  const folderId = folderIndex < 20 ? `huge-sf-${folderIndex + 1}` : null;
  return {
    id: `huge-src-${i + 1}`,
    notebookId: "huge-case-notebook",
    folderId,
    kind: (i % 3 === 0 ? "file" : i % 3 === 1 ? "url" : "text") as Source["kind"],
    modality: "document",
    title: `Document Record #${i + 1} — Benchmark Performance Log and Telemetry Data (${2020 + (i % 7)})`,
    url: i % 3 === 1 ? `https://example.com/record/${i + 1}` : null,
    contentType: i % 3 === 0 ? "application/pdf" : "text/plain",
    fileSize: 1024 * (i + 1),
    processingStatus: "ready",
    createdAt: new Date(Date.now() - i * 3600000).toISOString(),
  };
});

export const hugeCaseStudyMaterialFolders: FolderDTO[] = Array.from({ length: 10 }, (_, i) => ({
  id: `huge-smf-${i + 1}`,
  notebookId: "huge-case-notebook",
  parentId: null,
  name: `Module ${i + 1} Synthesis Materials`,
  deletedAt: null,
  createdAt: "2026-03-01T02:00:00.000Z",
  updatedAt: "2026-03-01T02:00:00.000Z",
}));

export const hugeCaseStudyMaterials: StudyMaterialDTO[] = Array.from({ length: 200 }, (_, i) => {
  const folderIndex = i % 12;
  const folderId = folderIndex < 10 ? `huge-smf-${folderIndex + 1}` : null;
  const kinds = [
    "quiz",
    "simple_flashcard",
    "quiz",
    "mind_map",
    "slides",
    "slides",
  ] as const;
  return {
    id: `huge-sm-${i + 1}`,
    notebookId: "huge-case-notebook",
    folderId,
    kind: kinds[i % kinds.length],
    title: `Study Material #${i + 1} — Comprehensive Synthesis for Topic ${i + 1}`,
    content: {},
    options: null,
    deletedAt: null,
    createdAt: new Date(Date.now() - i * 7200000).toISOString(),
    updatedAt: new Date(Date.now() - i * 7200000).toISOString(),
  };
});

export const hugeCaseChatMessages: ChatMessageDTO[] = Array.from({ length: 50 }, (_, i) => {
  const isUser = i % 2 === 0;
  return {
    id: `huge-msg-${i + 1}`,
    role: isUser ? "user" : "assistant",
    content: isUser
      ? `Query #${Math.floor(i / 2) + 1}: How does document #${i * 10 + 1} correlate with the overall telemetry?`
      : `Response #${Math.floor(i / 2) + 1}: Analysis of telemetry indicates consistent trends across records #${i * 10} through #${i * 10 + 20}.`,
    parts: [
      {
        type: "text",
        text: isUser
          ? `Query #${Math.floor(i / 2) + 1}: How does document #${i * 10 + 1} correlate with the overall telemetry?`
          : `Response #${Math.floor(i / 2) + 1}: Analysis of telemetry indicates consistent trends across records #${i * 10} through #${i * 10 + 20}.`,
      },
    ],
    metadata: {},
    groundingMode: "strict",
    citedSourceIds: null,
    citedSources: [],
    createdAt: new Date(Date.now() - (50 - i) * 60000).toISOString(),
  };
});
