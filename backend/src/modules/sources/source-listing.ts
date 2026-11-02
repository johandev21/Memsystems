import { and, desc, eq, ilike, isNull, lt, or } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { sources } from '../../database/schema';
import { BadRequestError } from '../../common/errors/domain-error';

export const SOURCE_PAGE_DEFAULT = 50;
export const SOURCE_PAGE_MAX = 100;

export interface SourceListPageOptions {
  cursor?: string;
  limit?: number;
  query?: string;
}

export function decodeSourceCursor(cursor: string): {
  createdAt: Date;
  id: string;
} {
  try {
    const value = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as {
      createdAt?: unknown;
      id?: unknown;
    };
    const createdAt =
      typeof value.createdAt === 'string' ? new Date(value.createdAt) : null;
    if (
      !createdAt ||
      Number.isNaN(createdAt.getTime()) ||
      typeof value.id !== 'string' ||
      !value.id
    ) {
      throw new Error('Invalid cursor');
    }
    return { createdAt, id: value.id };
  } catch {
    throw new BadRequestError('Invalid source pagination cursor', {
      messageKey: 'errors.sources.invalidCursor',
    });
  }
}

export function encodeSourceCursor(source: {
  createdAt: Date;
  id: string;
}): string {
  return Buffer.from(JSON.stringify(source), 'utf8').toString('base64url');
}

export async function listByNotebook(
  db: NodePgDatabase<typeof appSchema>,
  notebookId: string,
  options: SourceListPageOptions = {},
) {
  const limit = Math.min(
    SOURCE_PAGE_MAX,
    Math.max(
      1,
      Math.trunc(options.limit ?? SOURCE_PAGE_DEFAULT) || SOURCE_PAGE_DEFAULT,
    ),
  );
  const cursor = options.cursor ? decodeSourceCursor(options.cursor) : null;
  const query = options.query?.trim();
  const filters = [
    eq(sources.notebookId, notebookId),
    isNull(sources.deletedAt),
  ];
  if (cursor) {
    filters.push(
      or(
        lt(sources.createdAt, cursor.createdAt),
        and(eq(sources.createdAt, cursor.createdAt), lt(sources.id, cursor.id)),
      )!,
    );
  }
  if (query) {
    const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`;
    filters.push(
      or(ilike(sources.title, pattern), ilike(sources.url, pattern))!,
    );
  }
  const rows = await db
    .select({
      id: sources.id,
      notebookId: sources.notebookId,
      folderId: sources.folderId,
      kind: sources.kind,
      title: sources.title,
      url: sources.url,
      contentType: sources.contentType,
      fileSize: sources.fileSize,
      modality: sources.modality,
      processingStatus: sources.processingStatus,
      processingStage: sources.processingStage,
      processingErrorCode: sources.processingErrorCode,
      processingErrorMessage: sources.processingErrorMessage,
      createdAt: sources.createdAt,
    })
    .from(sources)
    .where(and(...filters))
    .orderBy(desc(sources.createdAt), desc(sources.id))
    .limit(limit + 1);
  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return {
    items,
    nextCursor:
      hasNextPage && last
        ? encodeSourceCursor({ createdAt: last.createdAt, id: last.id })
        : null,
  };
}
