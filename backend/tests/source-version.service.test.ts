import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { sourceSegments, sourceVersions } from '../src/database/schema';
import { SourceVersionService } from '../src/modules/sources/source-version.service';
import { db } from './db';
import { seedNotebook, seedSource } from './fixtures';

describe('SourceVersionService', () => {
  it('persists one version and one segment set when the same extraction retries', async () => {
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'text',
      title: 'Retry-safe source',
      rawText: 'A durable passage.',
    });
    const service = new SourceVersionService(db as any);
    const document = {
      title: 'Retry-safe source',
      text: 'A durable passage.',
      extractionMethod: 'text' as const,
      contentHash: 'retry-safe-hash',
      sections: [
        { headingPath: [], content: 'A durable passage.', ordinal: 0 },
      ],
    };

    const first = await service.persist(source.id, document);
    const second = await service.persist(source.id, document);

    expect(second.id).toBe(first.id);
    expect(second.segmentCount).toBe(1);
    const versions = await db
      .select()
      .from(sourceVersions)
      .where(eq(sourceVersions.sourceId, source.id));
    const segments = await db
      .select()
      .from(sourceSegments)
      .where(eq(sourceSegments.sourceVersionId, first.id));
    expect(versions).toHaveLength(1);
    expect(segments).toHaveLength(1);
  });

  it('persists specific section kinds and imageRegion locators into sourceSegments', async () => {
    const notebook = await seedNotebook();
    const source = await seedSource(notebook.id, {
      kind: 'file',
      title: 'Vision Source',
      rawText: 'Full extracted text',
    });
    const service = new SourceVersionService(db as any);
    const document = {
      title: 'Vision Source',
      text: 'Full extracted text',
      extractionMethod: 'vision' as const,
      contentHash: 'vision-content-hash',
      sections: [
        {
          headingPath: ['Intro'],
          content: 'Intro',
          ordinal: 0,
          kind: 'heading' as const,
          locator: { imageRegion: { x: 0.1, y: 0.1, width: 0.8, height: 0.1 } },
        },
        {
          headingPath: ['Intro'],
          content: '$$E = mc^2$$',
          ordinal: 1,
          kind: 'formula' as const,
          locator: { imageRegion: { x: 0.2, y: 0.3, width: 0.6, height: 0.2 } },
        },
        {
          headingPath: ['Intro'],
          content: 'Diagram of relativistic energy',
          ordinal: 2,
          kind: 'visual_description' as const,
          locator: {
            imageRegion: { x: 0.1, y: 0.6, width: 0.8, height: 0.35 },
          },
        },
      ],
    };

    const persisted = await service.persist(source.id, document);
    expect(persisted.segmentCount).toBe(3);

    const segments = await db
      .select()
      .from(sourceSegments)
      .where(eq(sourceSegments.sourceVersionId, persisted.id))
      .orderBy(sourceSegments.ordinal);

    expect(segments).toHaveLength(3);
    expect(segments[0].kind).toBe('heading');
    expect(segments[0].locator).toEqual({
      imageRegion: { x: 0.1, y: 0.1, width: 0.8, height: 0.1 },
    });

    expect(segments[1].kind).toBe('formula');
    expect(segments[1].locator).toEqual({
      imageRegion: { x: 0.2, y: 0.3, width: 0.6, height: 0.2 },
    });

    expect(segments[2].kind).toBe('visual_description');
    expect(segments[2].locator).toEqual({
      imageRegion: { x: 0.1, y: 0.6, width: 0.8, height: 0.35 },
    });
  });
});
