import { createId } from '@paralleldrive/cuid2';
import {
  AnyPgColumn,
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { agentAccessLevelEnum, chatRoleEnum, groundingModeEnum } from './enums';

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
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('notebook_folders_parent_id_idx').on(table.parentId),
    index('notebook_folders_name_idx').on(table.name),
    index('notebook_folders_deleted_at_idx').on(table.deletedAt),
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
    groundingMode: groundingModeEnum('grounding_mode')
      .default('strict')
      .notNull(),
    selectedChatMessageId: varchar('selected_chat_message_id').references(
      (): AnyPgColumn => notebookChatMessages.id,
      { onDelete: 'set null' },
    ),
    agentAccess: agentAccessLevelEnum('agent_access'),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('notebooks_folder_id_idx').on(table.folderId),
    index('notebooks_deleted_at_idx').on(table.deletedAt),
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
    parentId: varchar('parent_id').references(
      (): AnyPgColumn => notebookChatMessages.id,
      { onDelete: 'cascade' },
    ),
    preferredChildId: varchar('preferred_child_id'),
    preferredChildInitialized: boolean('preferred_child_initialized')
      .default(false)
      .notNull(),
    role: chatRoleEnum('role').notNull(),
    content: text('content').notNull(),
    reasoning: text('reasoning'),
    parts: jsonb('parts').$type<Record<string, unknown>[] | null>(),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    groundingMode: groundingModeEnum('grounding_mode')
      .default('strict')
      .notNull(),
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
            attribution?: string;
            sectionPath?: string[] | null;
            context?: string | null;
          }
      )[]
    >(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('notebook_chat_messages_notebook_id_idx').on(table.notebookId),
    index('notebook_chat_messages_created_at_idx').on(table.createdAt),
    index('notebook_chat_messages_parent_id_idx').on(table.parentId),
  ],
);
