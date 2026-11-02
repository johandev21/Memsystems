import { and, eq, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import {
  notebooks,
  sourceFolders,
  sources,
  studyMaterialFolders,
  studyMaterials,
} from '../../database/schema';
import { NotFoundError } from '../../common/errors/domain-error';
import { JobQueueService } from '../jobs/job-queue.service';

export async function cascadeDeleteNotebook(
  db: NodePgDatabase<typeof appSchema>,
  jobQueue: JobQueueService | undefined,
  notebookId: string,
): Promise<typeof notebooks.$inferSelect> {
  const [row] = await db
    .select()
    .from(notebooks)
    .where(and(eq(notebooks.id, notebookId), isNull(notebooks.deletedAt)));
  if (!row) {
    throw new NotFoundError('Notebook', {
      messageKey: 'errors.notebooks.notebook.notFound',
    });
  }

  const now = new Date();

  const notebookSources = await db
    .select({ id: sources.id })
    .from(sources)
    .where(and(eq(sources.notebookId, notebookId), isNull(sources.deletedAt)));

  if (jobQueue) {
    for (const s of notebookSources) {
      await jobQueue.cancelByGroup(`source:${s.id}`).catch(() => {});
      await jobQueue.cancelByGroup(`source:${s.id}:processing`).catch(() => {});
    }
  }

  const doSoftDelete = async (executor: typeof db) => {
    await executor
      .update(studyMaterials)
      .set({ deletedAt: now })
      .where(
        and(
          eq(studyMaterials.notebookId, notebookId),
          isNull(studyMaterials.deletedAt),
        ),
      );

    await executor
      .update(studyMaterialFolders)
      .set({ deletedAt: now })
      .where(
        and(
          eq(studyMaterialFolders.notebookId, notebookId),
          isNull(studyMaterialFolders.deletedAt),
        ),
      );

    await executor
      .update(sources)
      .set({ deletedAt: now })
      .where(
        and(eq(sources.notebookId, notebookId), isNull(sources.deletedAt)),
      );

    await executor
      .update(sourceFolders)
      .set({ deletedAt: now })
      .where(
        and(
          eq(sourceFolders.notebookId, notebookId),
          isNull(sourceFolders.deletedAt),
        ),
      );

    await executor
      .update(notebooks)
      .set({ deletedAt: now })
      .where(eq(notebooks.id, notebookId));
  };

  const maybeTx = (
    db as unknown as {
      transaction?: (cb: (tx: typeof db) => Promise<void>) => Promise<void>;
    }
  ).transaction;

  if (maybeTx) {
    await maybeTx.call(db, async (tx: typeof db) => {
      await doSoftDelete(tx);
    });
  } else {
    await doSoftDelete(db);
  }

  return { ...row, deletedAt: now };
}
