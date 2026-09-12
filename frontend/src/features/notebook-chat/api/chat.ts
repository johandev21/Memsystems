import { apiDelete, createQueryOptions } from "@/shared/api";

export interface CitationLocator {
  pageNumber?: number;
  slideNumber?: number;
  startOffsetMs?: number;
  endOffsetMs?: number;
  speaker?: string;
  sheetName?: string;
  cellRange?: string;
  symbol?: string;
  lineStart?: number;
  lineEnd?: number;
  imageRegion?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface CitedSourceDTO {
  id: string;
  schemaVersion: number;
  citationKey: string;
  chunkId: string | null;
  chunkIndex: number | null;
  sourceVersionId?: string | null;
  locator?: CitationLocator | null;
  number: number;
  title: string;
  kind: string;
  url: string | null;
  description: string | null;
  quote: string | null;
  isAvailable: boolean;
}

export interface CitedSourceEntry {
  schemaVersion: number;
  citationKey: string;
  sourceId: string;
  chunkId: string | null;
  chunkIndex: number | null;
  sourceVersionId?: string | null;
  locator?: CitationLocator | null;
  number: number;
  title: string | null;
  kind: string | null;
  url: string | null;
  description: string | null;
  quote: string | null;
}

export interface ChatRequestMessage {
  id?: string;
  role: "user" | "assistant" | "system";
  parts: unknown;
  metadata?: unknown;
}

export interface ChatRequest {
  model: string;
  message: ChatRequestMessage | null;
  messages: ChatRequestMessage[];
  language?: string;
}

export interface ChatMessageDTO {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string | null;
  parts?: Array<
    | { type: "text"; text: string; state?: "streaming" | "done" }
    | { type: "reasoning"; text: string; state?: "streaming" | "done" }
    | { type: "file"; mediaType: string; url: string; filename?: string }
    | { type: string; [key: string]: unknown }
  > | null;
  metadata?: Record<string, unknown> | null;
  citedSourceIds: CitedSourceEntry[] | null;
  citedSources: CitedSourceDTO[];
  createdAt: string;
}

export const chatMessagesQueryOptions = (notebookId: string) =>
  createQueryOptions<ChatMessageDTO[]>(
    ["chat", notebookId, "messages"],
    `/api/notebooks/${notebookId}/chat`,
    { staleTime: 0, refetchOnMount: "always" },
  );

export const clearChatHistory = (notebookId: string) =>
  apiDelete(`/api/notebooks/${notebookId}/chat`);
