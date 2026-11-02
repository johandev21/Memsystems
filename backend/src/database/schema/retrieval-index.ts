import { createId } from '@paralleldrive/cuid2';
import { sql } from 'drizzle-orm';
import {
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
  vector,
} from 'drizzle-orm/pg-core';
import type { RetrievalTrace } from '../../modules/ai/retrieval/retrieval-trace';
import { notebooks } from './notebooks-chat';
import { sources, sourceVersions } from './sources';
import {
  groundingModeEnum,
  retrievalTraceKindEnum,
  sourceKindEnum,
} from './enums';
import type { SourceSegmentLocator } from './enums';

const tsvector = customType<{ data: string; driverData: string }>({
  dataType: () => 'tsvector',
});

export const retrievalTraces = pgTable(
  'retrieval_traces',
  {
    id: varchar('id')
      .$defaultFn(() => createId())
      .primaryKey(),
    notebookId: varchar('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    kind: retrievalTraceKindEnum('kind').notNull(),
    chatMessageId: varchar('chat_message_id'),
    generationRequestId: varchar('generation_request_id'),
    groundingMode: groundingModeEnum('grounding_mode')
      .default('strict')
      .notNull(),
    query: text('query').notNull(),
    trace: jsonb('trace').$type<RetrievalTrace>().notNull(),
    latencyMs: integer('latency_ms').notNull(),
    embeddingInputTokens: integer('embedding_input_tokens').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('retrieval_traces_notebook_id_created_at_idx').on(
      table.notebookId,
      table.createdAt,
    ),
    index('retrieval_traces_chat_message_id_idx').on(table.chatMessageId),
    index('retrieval_traces_generation_request_id_idx').on(
      table.generationRequestId,
    ),
  ],
);

export const sourceChunks = pgTable(
  'source_chunks',
  {
    id: varchar('id')
      .$defaultFn(() => createId())
      .primaryKey(),
    sourceId: varchar('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    notebookId: varchar('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    sourceVersionId: varchar('source_version_id').references(
      () => sourceVersions.id,
      { onDelete: 'set null' },
    ),
    segmentIds: jsonb('segment_ids').$type<string[] | null>(),
    locator: jsonb('locator').$type<SourceSegmentLocator | null>(),
    chunkingVersion: integer('chunking_version'),
    contentHash: varchar('content_hash', { length: 64 }),
    content: text('content').notNull(),
    headingPath: jsonb('heading_path').$type<string[]>().notNull().default([]),
    sourceKind: sourceKindEnum('source_kind').notNull(),
    contextHeader: text('context_header').notNull().default(''),
    searchableText: text('searchable_text').notNull(),
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`to_tsvector('simple', "source_chunks"."searchable_text")`,
    ),
    embedding: vector('embedding', { dimensions: 1024 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('source_chunks_source_id_chunk_index_idx').on(
      table.sourceId,
      table.chunkIndex,
    ),
    index('source_chunks_notebook_id_idx').on(table.notebookId),
    index('source_chunks_embedding_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops'),
    ),
    index('source_chunks_search_vector_idx').using('gin', table.searchVector),
  ],
);
