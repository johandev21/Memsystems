import { and, asc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { sourceChunks, sourceSegments, sources } from '../../database/schema';
import { BadRequestError } from '../../common/errors/domain-error';

export async function updateSpeakerLabels(
  db: NodePgDatabase<typeof appSchema>,
  source: typeof sources.$inferSelect,
  speakerMap: Record<string, string>,
) {
  if (!source.currentVersionId) {
    throw new BadRequestError('Source has no current version to update', {
      messageKey: 'errors.sources.speaker.noCurrentVersion',
    });
  }
  if (!speakerMap || Object.keys(speakerMap).length === 0) {
    throw new BadRequestError('Speaker map must not be empty', {
      messageKey: 'errors.sources.speaker.emptyMap',
    });
  }

  const currentVersionId = source.currentVersionId;
  const sourceId = source.id;

  return db.transaction(async (tx) => {
    const segments = await tx
      .select()
      .from(sourceSegments)
      .where(eq(sourceSegments.sourceVersionId, currentVersionId))
      .orderBy(asc(sourceSegments.ordinal));

    for (const segment of segments) {
      const currentSpeaker = segment.locator?.speaker;
      if (currentSpeaker && speakerMap[currentSpeaker] !== undefined) {
        const newSpeaker = speakerMap[currentSpeaker];
        await tx
          .update(sourceSegments)
          .set({
            locator: {
              ...segment.locator,
              speaker: newSpeaker,
            },
          })
          .where(eq(sourceSegments.id, segment.id));
      }
    }

    const chunks = await tx
      .select()
      .from(sourceChunks)
      .where(
        and(
          eq(sourceChunks.sourceId, sourceId),
          eq(sourceChunks.sourceVersionId, currentVersionId),
        ),
      );

    for (const chunk of chunks) {
      const currentSpeaker = chunk.locator?.speaker;
      if (currentSpeaker && speakerMap[currentSpeaker] !== undefined) {
        const newSpeaker = speakerMap[currentSpeaker];
        await tx
          .update(sourceChunks)
          .set({
            locator: {
              ...(chunk.locator ?? {}),
              speaker: newSpeaker,
            },
          })
          .where(eq(sourceChunks.id, chunk.id));
      }
    }

    return tx
      .select()
      .from(sourceSegments)
      .where(eq(sourceSegments.sourceVersionId, currentVersionId))
      .orderBy(asc(sourceSegments.ordinal));
  });
}

export class SourceSpeakerOperations {
  constructor(private readonly db: NodePgDatabase<typeof appSchema>) {}

  async updateSpeakerLabels(
    source: typeof sources.$inferSelect,
    speakerMap: Record<string, string>,
  ) {
    return updateSpeakerLabels(this.db, source, speakerMap);
  }
}
