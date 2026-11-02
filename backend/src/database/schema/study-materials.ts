import { createId } from '@paralleldrive/cuid2';
import {
  customType,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { notebooks } from './notebooks-chat';
import {
  generationStatusEnum,
  groundingModeEnum,
  studyMaterialKindEnum,
} from './enums';

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

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
});

export const studyMaterialAudio = pgTable('study_material_audio', {
  studyMaterialId: varchar('study_material_id')
    .primaryKey()
    .references(() => studyMaterials.id, { onDelete: 'cascade' }),
  audio: bytea('audio').notNull(),
  contentType: varchar('content_type', { length: 100 })
    .notNull()
    .default('audio/wav'),
});

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
    generationOptions:
      jsonb('generation_options').$type<Record<string, unknown>>(),
    targetFolderId: varchar('target_folder_id').references(
      () => studyMaterialFolders.id,
      { onDelete: 'set null' },
    ),
    status: generationStatusEnum('status').notNull().default('streaming'),
    groundingMode: groundingModeEnum('grounding_mode')
      .default('strict')
      .notNull(),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
  },
  (table) => [
    index('generation_requests_notebook_id_idx').on(table.notebookId),
    index('generation_requests_target_folder_id_idx').on(table.targetFolderId),
  ],
);
