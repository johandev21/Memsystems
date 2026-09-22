import { createId } from '@paralleldrive/cuid2';
import { relations } from 'drizzle-orm';
import {
  AnyPgColumn,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
  vector,
} from 'drizzle-orm/pg-core';
import type { RetrievalTrace } from '../modules/ai/retrieval-trace';

export const sourceKindEnum = pgEnum('source_kind', ['text', 'url', 'file']);

export const sourceModalityEnum = pgEnum('source_modality', [
  'document',
  'image',
  'audio',
  'video',
  'code',
  'dataset',
  'slides',
  'ebook',
]);

export const sourceProcessingStatusEnum = pgEnum('source_processing_status', [
  'pending',
  'processing',
  'ready',
  'degraded',
  'failed',
  'cancelled',
]);

export const sourceProcessingStageEnum = pgEnum('source_processing_stage', [
  'uploading',
  'extracting',
  'transcribing',
  'analyzing_visuals',
  'indexing',
]);

export const sourceUploadIntentStatusEnum = pgEnum(
  'source_upload_intent_status',
  ['pending', 'uploaded', 'consuming', 'consumed', 'expired'],
);

export const sourceSegmentKindEnum = pgEnum('source_segment_kind', [
  'text',
  'heading',
  'code',
  'table',
  'formula',
  'visual_description',
  'transcript',
]);

export const sourceAddedViaEnum = pgEnum('source_added_via', [
  'manual',
  'ai_search',
]);

export const sourceIndexJobStatusEnum = pgEnum('source_index_job_status', [
  'pending',
  'processing',
  'ready',
  'failed',
  'cancelled',
]);

export const webSearchJobStatusEnum = pgEnum('web_search_job_status', [
  'pending',
  'processing',
  'ready',
  'failed',
]);

export const jobStatusEnum = pgEnum('job_status', [
  'pending',
  'processing',
  'ready',
  'failed',
  'cancelled',
]);

export interface SourceMetadata {
  searchQuery?: string;
  modelId?: string;
  provider?: string;
  searchedAt?: string;
  description?: string | null;
}

export interface SourceSegmentLocator {
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

export type SourceSegmentMetadata = Record<string, unknown>;

/** Reasons an extracted source version can be judged unusable as Evidence. */
export type SourceQualityReason = 'navigation' | 'boilerplate' | 'paywall';

/** Raw measurements behind a quality assessment, kept for auditability. */
export interface SourceQualitySignals {
  /** Substantive word count over the extracted text. */
  wordCount: number;
  /** Share of words that belong to links (0..1). */
  linkDensity: number;
  /** Share of repeated lines, a boilerplate proxy (0..1). */
  repetitionRatio: number;
  /** Number of distinct paywall or interstitial markers matched. */
  paywallHits: number;
}

export interface SourceQualityAssessment {
  status: 'ready' | 'degraded';
  /** Composite score, 0 (unusable) to 1 (clean prose). */
  score: number;
  reason: SourceQualityReason | null;
  signals: SourceQualitySignals;
}

export interface WebSearchCandidateRow {
  title: string;
  url: string;
  description: string | null;
}

export const studyMaterialKindEnum = pgEnum('study_material_kind', [
  'quiz',
  'simple_flashcard',
  'roadmap',
  'mind_map',
  'slides',
  'study_guide',
  'practice_problems',
  'case_study',
]);

export const generationStatusEnum = pgEnum('generation_status', [
  'streaming',
  'completed',
  'failed',
  'cancelled',
]);

export const chatRoleEnum = pgEnum('chat_role', ['user', 'assistant']);

export const retrievalTraceKindEnum = pgEnum('retrieval_trace_kind', [
  'chat',
  'generation',
]);

export const notebookFolders = pgTable(
  'notebook_folders',
  {
    id: varchar('id')
      .$defaultFn(() => createId())
      .primaryKey(),
    name: varchar('name', { length: 200 }).notNull(),
    parentId: varchar('parent_id').references(
      (): AnyPgColumn => notebookFolders.id,
      { onDelete: 'cascade' },
    ),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('notebook_folders_parent_id_idx').on(table.parentId),
    index('notebook_folders_name_idx').on(table.name),
  ],
);

export const notebooks = pgTable(
  'notebooks',
  {
    id: varchar('id')
      .$defaultFn(() => createId())
      .primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    description: varchar('description', { length: 500 }).default('').notNull(),
    icon: varchar('icon', { length: 50 }).default('notebook').notNull(),
    folderId: varchar('folder_id').references(() => notebookFolders.id, {
      onDelete: 'set null',
    }),
    banner: varchar('banner', { length: 2000 }),
    bannerVariants: jsonb('banner_variants').$type<{
      w240?: string;
      w480?: string;
      w960?: string;
      w1920?: string;
    } | null>(),
    bannerFocalPoint: jsonb('banner_focal_point').$type<{
      x: number;
      y: number;
    } | null>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('notebooks_folder_id_idx').on(table.folderId)],
);

export const sources = pgTable(
  'sources',
  {
    id: varchar('id')
      .$defaultFn(() => createId())
      .primaryKey(),
    notebookId: varchar('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    kind: sourceKindEnum('kind').notNull(),
    modality: sourceModalityEnum('modality'),
    processingStatus: sourceProcessingStatusEnum('processing_status')
      .default('pending')
      .notNull(),
    processingStage: sourceProcessingStageEnum('processing_stage'),
    currentVersionId: varchar('current_version_id').references(
      (): AnyPgColumn => sourceVersions.id,
      { onDelete: 'set null' },
    ),
    processingErrorCode: varchar('processing_error_code', { length: 100 }),
    processingErrorMessage: text('processing_error_message'),
    addedVia: sourceAddedViaEnum('added_via').default('manual').notNull(),
    metadata: jsonb('metadata').$type<SourceMetadata | null>(),
    title: varchar('title', { length: 500 }).notNull(),
    rawText: text('raw_text').notNull(),
    url: text('url'),
    s3Key: varchar('s3_key', { length: 1000 }),
    contentType: varchar('content_type', { length: 200 }),
    fileSize: integer('file_size'),
    sha256: varchar('sha256', { length: 64 }),
    contentHash: varchar('content_hash', { length: 64 }),
    canonicalUrl: text('canonical_url'),
    fetchedUrl: text('fetched_url'),
    httpStatus: integer('http_status'),
    fetchedAt: timestamp('fetched_at'),
    etag: varchar('etag', { length: 200 }),
    lastModified: varchar('last_modified', { length: 100 }),
    extractionMethod: varchar('extraction_method', { length: 20 }),
    extractorVersion: varchar('extractor_version', { length: 20 }),
    normalizationVersion: integer('normalization_version'),
    robotsDecision: varchar('robots_decision', { length: 20 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('sources_notebook_id_idx').on(table.notebookId),
    index('sources_kind_idx').on(table.kind),
    index('sources_modality_idx').on(table.modality),
    index('sources_processing_status_idx').on(table.processingStatus),
    index('sources_content_hash_idx').on(table.contentHash),
  ],
);

export const sourceVersions = pgTable(
  'source_versions',
  {
    id: varchar('id')
      .$defaultFn(() => createId())
      .primaryKey(),
    sourceId: varchar('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    artifactKey: varchar('artifact_key', { length: 1000 }),
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    extractorId: varchar('extractor_id', { length: 200 }).notNull(),
    extractorVersion: varchar('extractor_version', { length: 50 }).notNull(),
    normalizationVersion: integer('normalization_version').notNull(),
    modelProvider: varchar('model_provider', { length: 100 }),
    modelId: varchar('model_id', { length: 200 }),
    status: sourceProcessingStatusEnum('status').default('pending').notNull(),
    /** Content-quality assessment produced at ingestion; null for legacy rows. */
    quality: jsonb('quality').$type<SourceQualityAssessment | null>(),
    errorCode: varchar('error_code', { length: 100 }),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('source_versions_source_id_idx').on(table.sourceId),
    index('source_versions_status_idx').on(table.status),
    index('source_versions_content_hash_idx').on(table.contentHash),
  ],
);

export const sourceSegments = pgTable(
  'source_segments',
  {
    id: varchar('id')
      .$defaultFn(() => createId())
      .primaryKey(),
    sourceVersionId: varchar('source_version_id')
      .notNull()
      .references(() => sourceVersions.id, { onDelete: 'cascade' }),
    ordinal: integer('ordinal').notNull(),
    kind: sourceSegmentKindEnum('kind').notNull(),
    content: text('content').notNull(),
    locator: jsonb('locator')
      .$type<SourceSegmentLocator>()
      .notNull()
      .default({}),
    metadata: jsonb('metadata')
      .$type<SourceSegmentMetadata>()
      .notNull()
      .default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('source_segments_source_version_id_idx').on(table.sourceVersionId),
    index('source_segments_source_version_ordinal_idx').on(
      table.sourceVersionId,
      table.ordinal,
    ),
  ],
);

export const sourceIndexJobs = pgTable(
  'source_index_jobs',
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
    status: sourceIndexJobStatusEnum('status').notNull().default('pending'),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastError: text('last_error'),
    contentHash: varchar('content_hash', { length: 64 }),
    processingVersion: integer('processing_version'),
    embeddingModel: varchar('embedding_model', { length: 200 }),
    embeddingDimensions: integer('embedding_dimensions'),
    chunksCount: integer('chunks_count'),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    nextAttemptAt: timestamp('next_attempt_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('source_index_jobs_source_id_idx').on(table.sourceId),
    index('source_index_jobs_status_idx').on(table.status),
    index('source_index_jobs_notebook_id_idx').on(table.notebookId),
  ],
);

export const webSearchJobs = pgTable(
  'web_search_jobs',
  {
    id: varchar('id')
      .$defaultFn(() => createId())
      .primaryKey(),
    notebookId: varchar('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    query: varchar('query', { length: 500 }).notNull(),
    modelId: varchar('model_id', { length: 200 }).notNull(),
    status: webSearchJobStatusEnum('status').notNull().default('pending'),
    summary: text('summary'),
    candidates: jsonb('candidates')
      .$type<WebSearchCandidateRow[]>()
      .notNull()
      .default([]),
    lastError: text('last_error'),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('web_search_jobs_notebook_id_idx').on(table.notebookId),
    index('web_search_jobs_status_idx').on(table.status),
  ],
);

export const jobs = pgTable(
  'jobs',
  {
    id: varchar('id')
      .$defaultFn(() => createId())
      .primaryKey(),
    type: varchar('type', { length: 100 }).notNull(),
    groupKey: varchar('group_key', { length: 255 }),
    payload: jsonb('payload').notNull().default({}),
    status: jobStatusEnum('status').notNull().default('pending'),
    result: jsonb('result'),
    lastError: text('last_error'),
    attemptCount: integer('attempt_count').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    backoffBaseMs: integer('backoff_base_ms').notNull().default(5000),
    nextAttemptAt: timestamp('next_attempt_at'),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('jobs_status_next_attempt_at_idx').on(
      table.status,
      table.nextAttemptAt,
    ),
    index('jobs_group_key_idx').on(table.groupKey),
    index('jobs_type_idx').on(table.type),
  ],
);

export const studyMaterialFolders = pgTable(
  'study_material_folders',
  {
    id: varchar('id')
      .$defaultFn(() => createId())
      .primaryKey(),
    notebookId: varchar('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    parentId: varchar('parent_id').references(
      (): any => studyMaterialFolders.id,
      { onDelete: 'cascade' },
    ),
    name: varchar('name', { length: 200 }).notNull(),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('study_material_folders_notebook_id_idx').on(table.notebookId),
    index('study_material_folders_parent_id_idx').on(table.parentId),
    index('study_material_folders_deleted_at_idx').on(table.deletedAt),
  ],
);

export const studyMaterials = pgTable(
  'study_materials',
  {
    id: varchar('id')
      .$defaultFn(() => createId())
      .primaryKey(),
    notebookId: varchar('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    kind: studyMaterialKindEnum('kind').notNull(),
    title: varchar('title', { length: 200 }).notNull().default('Untitled'),
    folderId: varchar('folder_id').references(() => studyMaterialFolders.id, {
      onDelete: 'set null',
    }),
    content: jsonb('content').notNull(),
    options: jsonb('options').$type<Record<string, unknown> | null>(),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('study_materials_notebook_id_idx').on(table.notebookId),
    index('study_materials_kind_idx').on(table.kind),
    index('study_materials_title_idx').on(table.title),
    index('study_materials_folder_id_idx').on(table.folderId),
    index('study_materials_deleted_at_idx').on(table.deletedAt),
  ],
);

export const generationRequests = pgTable(
  'generation_requests',
  {
    id: varchar('id')
      .$defaultFn(() => createId())
      .primaryKey(),
    notebookId: varchar('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    kind: studyMaterialKindEnum('kind').notNull(),
    brief: text('brief').notNull().default(''),
    sourceIds: jsonb('source_ids').$type<string[]>().notNull().default([]),
    targetFolderId: varchar('target_folder_id').references(
      () => studyMaterialFolders.id,
      { onDelete: 'set null' },
    ),
    status: generationStatusEnum('status').notNull().default('streaming'),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
  },
  (table) => [
    index('generation_requests_notebook_id_idx').on(table.notebookId),
    index('generation_requests_target_folder_id_idx').on(table.targetFolderId),
  ],
);

export const notebookChatMessages = pgTable(
  'notebook_chat_messages',
  {
    id: varchar('id')
      .$defaultFn(() => createId())
      .primaryKey(),
    notebookId: varchar('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    role: chatRoleEnum('role').notNull(),
    content: text('content').notNull(),
    reasoning: text('reasoning'),
    parts: jsonb('parts').$type<Record<string, unknown>[] | null>(),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    citedSourceIds: jsonb('cited_source_ids').$type<
      (
        | string
        | {
            schemaVersion?: number;
            citationKey?: string;
            sourceId: string;
            chunkId?: string | null;
            chunkIndex?: number | null;
            number: number;
            title?: string | null;
            kind?: string | null;
            url?: string | null;
            description?: string | null;
            quote: string | null;
          }
      )[]
    >(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('notebook_chat_messages_notebook_id_idx').on(table.notebookId),
    index('notebook_chat_messages_created_at_idx').on(table.createdAt),
  ],
);

/**
 * One persisted retrieval trace per Chat turn and per Study Material
 * Generation. The correlation ids have no foreign key on purpose: a trace is
 * still useful when the turn failed before its message row was written.
 */
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
  ],
);

export const notebookFoldersRelations = relations(
  notebookFolders,
  ({ one, many }) => ({
    parent: one(notebookFolders, {
      fields: [notebookFolders.parentId],
      references: [notebookFolders.id],
      relationName: 'notebookFolderHierarchy',
    }),
    children: many(notebookFolders, {
      relationName: 'notebookFolderHierarchy',
    }),
    notebooks: many(notebooks),
  }),
);

export const notebooksRelations = relations(notebooks, ({ one, many }) => ({
  folder: one(notebookFolders, {
    fields: [notebooks.folderId],
    references: [notebookFolders.id],
  }),
  sources: many(sources),
  sourceChunks: many(sourceChunks),
  sourceIndexJobs: many(sourceIndexJobs),
  webSearchJobs: many(webSearchJobs),
  studyMaterials: many(studyMaterials),
  studyMaterialFolders: many(studyMaterialFolders),
  chatMessages: many(notebookChatMessages),
  generationRequests: many(generationRequests),
  sourceUploadIntents: many(sourceUploadIntents),
}));

export const sourcesRelations = relations(sources, ({ one, many }) => ({
  notebook: one(notebooks, {
    fields: [sources.notebookId],
    references: [notebooks.id],
  }),
  chunks: many(sourceChunks),
  indexJobs: many(sourceIndexJobs),
  versions: many(sourceVersions, { relationName: 'sourceVersions' }),
  currentVersion: one(sourceVersions, {
    fields: [sources.currentVersionId],
    references: [sourceVersions.id],
    relationName: 'sourceCurrentVersion',
  }),
}));

export const sourceVersionsRelations = relations(
  sourceVersions,
  ({ one, many }) => ({
    source: one(sources, {
      fields: [sourceVersions.sourceId],
      references: [sources.id],
      relationName: 'sourceVersions',
    }),
    segments: many(sourceSegments),
    chunks: many(sourceChunks),
  }),
);

export const sourceSegmentsRelations = relations(sourceSegments, ({ one }) => ({
  sourceVersion: one(sourceVersions, {
    fields: [sourceSegments.sourceVersionId],
    references: [sourceVersions.id],
  }),
}));

export const sourceUploadIntents = pgTable(
  'source_upload_intents',
  {
    id: varchar('id').primaryKey(),
    notebookId: varchar('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    storageKey: varchar('storage_key', { length: 1000 }).notNull(),
    filename: varchar('filename', { length: 500 }).notNull(),
    contentType: varchar('content_type', { length: 200 }).notNull(),
    expectedBytes: integer('expected_bytes').notNull(),
    expectedSha256: varchar('expected_sha256', { length: 64 }),
    uploadedBytes: integer('uploaded_bytes'),
    uploadedSha256: varchar('uploaded_sha256', { length: 64 }),
    status: sourceUploadIntentStatusEnum('status').default('pending').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    consumedAt: timestamp('consumed_at'),
  },
  (table) => [
    index('source_upload_intents_notebook_id_idx').on(table.notebookId),
    index('source_upload_intents_status_expires_at_idx').on(
      table.status,
      table.expiresAt,
    ),
  ],
);

export const sourceIndexJobsRelations = relations(
  sourceIndexJobs,
  ({ one }) => ({
    source: one(sources, {
      fields: [sourceIndexJobs.sourceId],
      references: [sources.id],
    }),
    notebook: one(notebooks, {
      fields: [sourceIndexJobs.notebookId],
      references: [notebooks.id],
    }),
  }),
);

export const webSearchJobsRelations = relations(webSearchJobs, ({ one }) => ({
  notebook: one(notebooks, {
    fields: [webSearchJobs.notebookId],
    references: [notebooks.id],
  }),
}));

export const sourceChunksRelations = relations(sourceChunks, ({ one }) => ({
  source: one(sources, {
    fields: [sourceChunks.sourceId],
    references: [sources.id],
  }),
  notebook: one(notebooks, {
    fields: [sourceChunks.notebookId],
    references: [notebooks.id],
  }),
  sourceVersion: one(sourceVersions, {
    fields: [sourceChunks.sourceVersionId],
    references: [sourceVersions.id],
  }),
}));

export const studyMaterialsRelations = relations(studyMaterials, ({ one }) => ({
  notebook: one(notebooks, {
    fields: [studyMaterials.notebookId],
    references: [notebooks.id],
  }),
  folder: one(studyMaterialFolders, {
    fields: [studyMaterials.folderId],
    references: [studyMaterialFolders.id],
  }),
}));

export const studyMaterialFoldersRelations = relations(
  studyMaterialFolders,
  ({ one, many }) => ({
    notebook: one(notebooks, {
      fields: [studyMaterialFolders.notebookId],
      references: [notebooks.id],
    }),
    parent: one(studyMaterialFolders, {
      fields: [studyMaterialFolders.parentId],
      references: [studyMaterialFolders.id],
      relationName: 'folderHierarchy',
    }),
    children: many(studyMaterialFolders, { relationName: 'folderHierarchy' }),
    studyMaterials: many(studyMaterials),
  }),
);

export const generationRequestsRelations = relations(
  generationRequests,
  ({ one }) => ({
    notebook: one(notebooks, {
      fields: [generationRequests.notebookId],
      references: [notebooks.id],
    }),
  }),
);

export const notebookChatMessagesRelations = relations(
  notebookChatMessages,
  ({ one }) => ({
    notebook: one(notebooks, {
      fields: [notebookChatMessages.notebookId],
      references: [notebooks.id],
    }),
  }),
);

export const appSettings = pgTable('app_settings', {
  id: text('id').primaryKey().default('global'),
  // Global Vercel AI Gateway key (AES-256-GCM encrypted, see
  // UserSettingsService). Funds every model for the single-user app.
  gatewayApiKey: text('gateway_api_key'),
  // Global Voyage AI key (AES-256-GCM encrypted) for embeddings.
  voyageApiKey: text('voyage_api_key'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const sourceUploadIntentsRelations = relations(
  sourceUploadIntents,
  ({ one }) => ({
    notebook: one(notebooks, {
      fields: [sourceUploadIntents.notebookId],
      references: [notebooks.id],
    }),
  }),
);

export const table = {
  notebooks,
  notebookFolders,
  sources,
  sourceVersions,
  sourceSegments,
  sourceUploadIntents,
  sourceChunks,
  sourceIndexJobs,
  webSearchJobs,
  studyMaterials,
  studyMaterialFolders,
  generationRequests,
  notebookChatMessages,
  appSettings,
} as const;

export type Table = typeof table;
