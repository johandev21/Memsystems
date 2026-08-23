import { apiDelete, createQueryOptions } from "./factory";

export interface CitedSourceDTO {
  id: string;
  schemaVersion: number;
  citationKey: string;
  chunkId: string | null;
  chunkIndex: number | null;
  number: number;
  title: string;
  kind: string;
  url: string | null;
  description: string | null;
  quote: string | null;
  isAvailable: boolean;
}

export interface ChatMessageDTO {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string | null;
  citedSourceIds: CitedSourceEntry[] | null;
  citedSources: CitedSourceDTO[];
  createdAt: string;
}

export interface CitedSourceEntry {
  schemaVersion: number;
  citationKey: string;
  sourceId: string;
  chunkId: string | null;
  chunkIndex: number | null;
  number: number;
  title: string | null;
  kind: string | null;
  url: string | null;
  description: string | null;
  quote: string | null;
}

export const chatMessagesQueryOptions = (notebookId: string) =>
  createQueryOptions<ChatMessageDTO[]>(
    ["chat", notebookId, "messages"],
    `/api/notebooks/${notebookId}/chat`,
    { staleTime: 0, refetchOnMount: "always" },
  );

export const clearChatHistory = (notebookId: string) =>
  apiDelete(`/api/notebooks/${notebookId}/chat`);
