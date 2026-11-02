import { resolveGroundingMode } from '../../notebooks/grounding-mode';
import type { StoredCitedSourceEntry } from '../chat-citations';
import {
  normalizeStoredCitation,
  sanitizeReferenceUrl,
} from '../chat-citations';
import type { ChatMessage, CitedSourceMeta } from '../chat.types';

export const MAX_HISTORY_MESSAGES = 6;
export const HISTORY_FETCH_LIMIT = 30;

export function stripCitationKeys(text?: string | null): string {
  if (!text) return '';
  return text
    .replace(/`?\[ref:R\d+\]`?/gi, '')
    .replace(/[ \t]+([.,;:!?])/g, '$1')
    .replace(/ {2,}/g, ' ')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

export function deduplicateHistoryMessages<T extends { role: string }>(
  messages: T[],
): T[] {
  const result: T[] = [];
  for (let i = 0; i < messages.length; i++) {
    const current = messages[i];
    const next = messages[i + 1];
    if (current.role === 'assistant' && next && next.role === 'assistant') {
      continue;
    }
    result.push(current);
  }
  return result;
}

export function mapChatHistoryMessages(
  rows: (typeof import('../../../database/schema').notebookChatMessages.$inferSelect)[],
  selectedMessageId: string | null,
  selectedPathIds: string[],
  citedMetaMap: Map<string, CitedSourceMeta>,
): ChatMessage[] {
  const childrenByParent = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.parentId ?? '';
    childrenByParent.set(key, [...(childrenByParent.get(key) ?? []), row]);
  }
  for (const children of childrenByParent.values()) {
    children.sort(
      (a, b) =>
        a.createdAt.getTime() - b.createdAt.getTime() ||
        a.id.localeCompare(b.id),
    );
  }

  return rows.map((row) => {
    const rawEntries = (row.citedSourceIds ?? []) as StoredCitedSourceEntry[];
    const entries = rawEntries.map(normalizeStoredCitation);
    const citedSources = entries.map((entry) => {
      const meta = citedMetaMap.get(entry.sourceId);
      return {
        id: entry.sourceId,
        schemaVersion: entry.schemaVersion,
        citationKey: entry.citationKey,
        chunkId: entry.chunkId,
        chunkIndex: entry.chunkIndex,
        sourceVersionId: entry.sourceVersionId,
        locator: entry.locator,
        number: entry.number,
        title: entry.title ?? meta?.title ?? 'Unavailable reference',
        kind: entry.kind ?? meta?.kind ?? 'unknown',
        url: entry.url ?? meta?.url ?? null,
        description: entry.description,
        quote: entry.quote,
        isAvailable: !!meta,
        sectionPath: entry.sectionPath ?? null,
        context: entry.context ?? null,
      };
    });

    let parts = row.parts;
    if (!parts || parts.length === 0) {
      parts = [];
      if (row.reasoning && row.reasoning.trim()) {
        parts.push({ type: 'reasoning', text: row.reasoning });
      }
      if (row.content) parts.push({ type: 'text', text: row.content });
    }

    const siblings = childrenByParent.get(row.parentId ?? '') ?? [];
    return {
      id: row.id,
      role: row.role,
      content: row.content,
      reasoning: row.reasoning,
      parts,
      metadata: row.metadata,
      groundingMode: resolveGroundingMode(
        row.groundingMode,
        row.metadata?.groundingMode,
      ),
      citedSourceIds: entries,
      citedSources,
      createdAt: row.createdAt,
      parentId: row.parentId,
      siblingIndex: siblings.findIndex((child) => child.id === row.id),
      siblingCount: siblings.length,
      isOnSelectedPath: selectedPathIds.includes(row.id),
      isSelected: selectedMessageId === row.id,
    };
  });
}

export function mapAvailableCitationSource(source: {
  id: string;
  title: string;
  kind: string;
  url: string | null;
}): CitedSourceMeta {
  return {
    id: source.id,
    schemaVersion: 0,
    citationKey: '',
    chunkId: null,
    chunkIndex: null,
    sourceVersionId: null,
    locator: null,
    number: 0,
    title: source.title,
    kind: source.kind,
    url: sanitizeReferenceUrl(source.url),
    description: null,
    quote: null,
    isAvailable: true,
  };
}

export function getLastUserMessageContent(
  messages: { role: string; parts: { type: string; text?: string }[] }[],
): string {
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'user');
  const textPart = lastUserMessage?.parts.find((part) => part.type === 'text');
  return textPart?.text ?? '';
}

export function getLastUserMessageParts(
  messages: { role: string; parts: Record<string, unknown>[] }[],
): Record<string, unknown>[] {
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'user');
  return lastUserMessage?.parts ?? [];
}
