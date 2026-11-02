import type { GroundingMode } from '../../database/schema';
import type { CitationLocator } from '../ai/retrieval/retrieval.service';
import type { CitedSourceEntry } from './chat-citations';

export interface CitedSourceMeta {
  id: string;
  schemaVersion: number;
  citationKey: string;
  chunkId: string | null;
  chunkIndex: number | null;
  sourceVersionId: string | null;
  locator: CitationLocator | null;
  number: number;
  title: string;
  kind: string;
  url: string | null;
  description: string | null;
  quote: string | null;
  isAvailable: boolean;
  sectionPath?: string[] | null;
  context?: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string | null;
  parts?: Record<string, unknown>[] | null;
  metadata?: Record<string, unknown> | null;
  groundingMode: GroundingMode;
  citedSourceIds: CitedSourceEntry[] | null;
  citedSources: CitedSourceMeta[];
  createdAt: Date;
  parentId: string | null;
  siblingIndex: number;
  siblingCount: number;
  isOnSelectedPath: boolean;
  isSelected: boolean;
}

export interface ChatHistoryResponse {
  messages: ChatMessage[];
  selectedMessageId: string | null;
  selectedPathIds: string[];
}

export interface SendInput {
  content: string;
  parts?: Record<string, unknown>[];
  messageId?: string;
  parentMessageId?: string | null;
  editMessageId?: string;
  regenerateMessageId?: string;
  sourceIds?: string[];
  model: string;
  abortSignal?: AbortSignal;
  language?: string;
  groundingMode?: GroundingMode;
}
