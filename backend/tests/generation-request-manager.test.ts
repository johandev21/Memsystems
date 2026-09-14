import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { generationRequests } from '../src/database/schema';
import { GenerationRequestManager } from '../src/modules/study-materials/generation-request-manager';
import { db, resetDatabase } from './db';
import { seedNotebook } from './fixtures';

describe('GenerationRequestManager status transitions', () => {
  let manager: GenerationRequestManager;
  let notebookId: string;

  beforeEach(async () => {
    await resetDatabase();
    manager = new GenerationRequestManager(db as never);
    notebookId = (await seedNotebook()).id;
  });

  async function createRequest(): Promise<string> {
    return manager.create(notebookId, {
      kind: 'quiz',
      brief: 'Cell biology',
      sourceIds: [],
    });
  }

  async function statusOf(requestId: string): Promise<string> {
    const [row] = await db
      .select({ status: generationRequests.status })
      .from(generationRequests)
      .where(eq(generationRequests.id, requestId));
    return row.status;
  }

  it('does not overwrite a cancelled request when marked completed', async () => {
    const requestId = await createRequest();
    await manager.cancel(requestId);

    await manager.markCompleted(requestId);

    expect(await statusOf(requestId)).toBe('cancelled');
  });

  it('moves a streaming request to completed', async () => {
    const requestId = await createRequest();

    await manager.markCompleted(requestId);

    expect(await statusOf(requestId)).toBe('completed');
  });

  it('does not overwrite a cancelled request when marked failed', async () => {
    const requestId = await createRequest();
    await manager.cancel(requestId);

    await manager.markFailed(requestId);

    expect(await statusOf(requestId)).toBe('cancelled');
  });
});
