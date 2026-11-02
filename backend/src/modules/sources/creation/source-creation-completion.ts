import { sources } from '../../../database/schema';
import type { SourceQualityAssessment } from '../../../database/schema';
import {
  qualityFailureLifecycle,
  qualityFailureOf,
  SourceQualityService,
} from '../source-quality.service';
import type { NormalizedDocument } from '../extraction/document-normalizer.service';
import type { SourceJobsService } from '../jobs/source-jobs.service';
import type { SourceVersionService } from '../source-version.service';

export class SourceCreationCompletion {
  constructor(
    private readonly sourceQuality: SourceQualityService,
    private readonly sourceJobsService: SourceJobsService,
    private readonly sourceVersionService?: SourceVersionService,
  ) {}

  assessDocument(document: NormalizedDocument): SourceQualityAssessment {
    return this.sourceQuality.assess(document);
  }

  async persistVersionAndIndex(
    row: typeof sources.$inferSelect,
    document: NormalizedDocument,
    quality: SourceQualityAssessment,
  ): Promise<typeof sources.$inferSelect> {
    await this.persistVersion(row.id, document, quality);
    if (quality.status === 'degraded')
      return this.withQualityFailure(row, quality);
    await this.sourceJobsService.enqueue(row.id);
    return row;
  }

  async persistVersion(
    sourceId: string,
    document: NormalizedDocument,
    quality: SourceQualityAssessment | null = null,
  ): Promise<void> {
    if (this.sourceVersionService) {
      await this.sourceVersionService.persist(sourceId, document, { quality });
    }
  }

  private withQualityFailure(
    row: typeof sources.$inferSelect,
    quality: SourceQualityAssessment,
  ): typeof sources.$inferSelect {
    const failure = qualityFailureOf(quality);
    if (!failure) return row;
    return {
      ...row,
      ...qualityFailureLifecycle(failure),
    };
  }
}
