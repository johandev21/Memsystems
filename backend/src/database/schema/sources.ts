import { createId } from '@paralleldrive/cuid2';
import {
  AnyPgColumn,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { notebooks } from './notebooks-chat';
import {
  sourceAddedViaEnum,
  sourceKindEnum,
  sourceModalityEnum,
  sourceProcessingStageEnum,
  sourceProcessingStatusEnum,
  sourceSegmentKindEnum,
  sourceUploadIntentStatusEnum,
} from './enums';
import type {
  SourceMetadata,
  SourceQualityAssessment,
  SourceSegmentLocator,
  SourceSegmentMetadata,
} from './enums';

export const sourceFolders = pgTable(
  'source_folders',
  {
    id: varchar('id')
      .$defaultFn(() => createId())
      .primaryKey(),
    notebookId: varchar('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    parentId: varchar('parent_id').references((): any => sourceFolders.id, {
      onDelete: 'cascade',
    }),
    name: varchar('name', { length: 200 }).notNull(),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('source_folders_notebook_id_idx').on(table.notebookId),
    index('source_folders_parent_id_idx').on(table.parentId),
    index('source_folders_deleted_at_idx').on(table.deletedAt),
  ],
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
    folderId: varchar('folder_id').references(
      (): AnyPgColumn => sourceFolders.id,
      { onDelete: 'set null' },
    ),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('sources_notebook_id_idx').on(table.notebookId),
    index('sources_folder_id_idx').on(table.folderId),
    index('sources_kind_idx').on(table.kind),
    index('sources_modality_idx').on(table.modality),
    index('sources_processing_status_idx').on(table.processingStatus),
    index('sources_content_hash_idx').on(table.contentHash),
    index('sources_deleted_at_idx').on(table.deletedAt),
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
