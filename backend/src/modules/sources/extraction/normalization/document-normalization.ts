import { createHash } from 'node:crypto';
import type { DocumentSection } from './document.types';

const PROVEN_CITATION_RE = /(?<=[.!?])\s*\[\d{1,3}\]/g;

export function normalizeProse(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\u0000')
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function stripProvenCitations(text: string): string {
  return text.replace(PROVEN_CITATION_RE, '');
}

export function contentHashOf(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function asMetadataString(
  metadata: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}

export function singleSection(content: string): DocumentSection[] {
  return [{ headingPath: [], content: normalizeProse(content), ordinal: 0 }];
}
