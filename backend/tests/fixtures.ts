import { createId } from '@paralleldrive/cuid2';
import {
  chatRoleEnum,
  notebookChatMessages,
  notebooks,
  sources,
  studyMaterials,
} from '../src/database/schema';
import { db } from './db';

export interface SeededUser {
  id: string;
  email: string;
  name: string;
}

export async function seedUser(
  overrides: Partial<SeededUser> = {},
): Promise<SeededUser> {
  const id = overrides.id ?? createId();
  const email = overrides.email ?? `test-${id}@example.com`;
  const name = overrides.name ?? 'Test User';
  return { id, email, name };
}

export async function seedNotebook(
  userId: string,
  overrides: { id?: string; title?: string; description?: string } = {},
): Promise<{ id: string; userId: string; title: string }> {
  const id = overrides.id ?? createId();
  const [row] = await db
    .insert(notebooks)
    .values({
      id,
      userId,
      title: overrides.title ?? 'Test Notebook',
      description: overrides.description ?? '',
    })
    .returning();
  return { id: row.id, userId: row.userId, title: row.title };
}

export async function seedChatMessage(
  notebookId: string,
  input: {
    role: (typeof chatRoleEnum.enumValues)[number];
    content: string;
    createdAt?: Date;
    citedSourceIds?:
      { sourceId: string; number: number; quote: string | null }[] | null;
  },
): Promise<{ id: string }> {
  const [row] = await db
    .insert(notebookChatMessages)
    .values({
      notebookId,
      role: input.role,
      content: input.content,
      citedSourceIds: input.citedSourceIds ?? null,
      createdAt: input.createdAt ?? new Date(),
    })
    .returning();
  return { id: row.id };
}

export async function seedSource(
  notebookId: string,
  input: {
    id?: string;
    kind: 'text' | 'url' | 'file';
    title: string;
    rawText: string;
    contentHash?: string | null;
    url?: string | null;
    createdAt?: Date;
  },
): Promise<{ id: string; notebookId: string; kind: string; title: string }> {
  const [row] = await db
    .insert(sources)
    .values({
      id: input.id ?? createId(),
      notebookId,
      kind: input.kind,
      title: input.title,
      rawText: input.rawText,
      contentHash: (input as any).contentHash ?? null,
      url: input.url ?? null,
      createdAt: input.createdAt ?? new Date(),
    })
    .returning();
  return {
    id: row.id,
    notebookId: row.notebookId,
    kind: row.kind,
    title: row.title,
  };
}

export async function seedStudyMaterial(
  notebookId: string,
  input: {
    id?: string;
    kind: 'quiz' | 'simple_flashcard' | 'roadmap' | 'mind_map';
    title: string;
    content?: unknown;
    folderId?: string | null;
  },
) {
  const [row] = await db
    .insert(studyMaterials)
    .values({
      id: input.id ?? createId(),
      notebookId,
      kind: input.kind,
      title: input.title,
      content: input.content ?? {},
      folderId: input.folderId ?? null,
    })
    .returning();
  return row;
}
