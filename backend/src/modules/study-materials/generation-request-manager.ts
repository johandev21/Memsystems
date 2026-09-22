import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { generationRequests } from '../../database/schema';
import { NotFoundError } from '../../common/errors/domain-error';
import { DRIZZLE } from '../database/database.module';
import { StudyMaterialKind } from './shapes';
import type { StudyGuideGenerationOptions } from './study-guide-content';
import type { PracticeProblemsGenerationOptions } from './practice-problems-content';
import type { CaseStudyGenerationOptions } from './case-study-content';

export interface StartGenerationInput {
  kind: StudyMaterialKind;
  studyGuideOptions?: StudyGuideGenerationOptions;
  practiceProblemsOptions?: PracticeProblemsGenerationOptions;
  caseStudyOptions?: CaseStudyGenerationOptions;
  brief: string;
  sourceIds: string[];
  folderId?: string | null;
  model?: string;
  language?: string;
  questionCount?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  cardStyle?: 'qa' | 'definition' | 'cloze' | 'mixed';
  roadmapOptions?: {
    phaseCount: number;
    detailLevel: 'basic' | 'detailed';
  };
  mindMapOptions?: {
    nodeCount: number;
    structure: 'radial' | 'hierarchical' | 'organic';
    colorGroups: boolean;
    crossLinks: boolean;
    detailLevel: 'basic' | 'detailed';
  };
  slidesOptions?: {
    slideCount: number;
    theme:
      | 'dark'
      | 'light'
      | 'accent'
      | 'editorial'
      | 'academic'
      | 'technical'
      | 'warm';
    detailLevel: 'basic' | 'detailed';
  };
}

@Injectable()
export class GenerationRequestManager {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
  ) {}

  async create(
    notebookId: string,
    input: StartGenerationInput,
  ): Promise<string> {
    const [request] = await this.db
      .insert(generationRequests)
      .values({
        notebookId,
        kind: input.kind,
        brief: input.brief,
        sourceIds: input.sourceIds,
        targetFolderId: input.folderId ?? null,
        status: 'streaming',
      })
      .returning();
    return request.id;
  }

  async markCompleted(requestId: string): Promise<void> {
    await this.db
      .update(generationRequests)
      .set({
        status: 'completed',
        completedAt: new Date(),
      })
      .where(
        and(
          eq(generationRequests.id, requestId),
          eq(generationRequests.status, 'streaming'),
        ),
      );
  }

  async markFailed(requestId: string): Promise<void> {
    await this.db
      .update(generationRequests)
      .set({ status: 'failed' })
      .where(
        and(
          eq(generationRequests.id, requestId),
          eq(generationRequests.status, 'streaming'),
        ),
      );
  }

  async cancel(requestId: string): Promise<void> {
    const [request] = await this.db
      .select({ status: generationRequests.status })
      .from(generationRequests)
      .where(eq(generationRequests.id, requestId));
    if (!request) {
      throw new NotFoundError('Generation request', {
        messageKey: 'errors.generation.requestNotFound',
      });
    }
    if (request.status === 'streaming') {
      await this.db
        .update(generationRequests)
        .set({ status: 'cancelled' })
        .where(eq(generationRequests.id, requestId));
    }
  }

  async get(requestId: string) {
    const [request] = await this.db
      .select()
      .from(generationRequests)
      .where(eq(generationRequests.id, requestId));
    return request;
  }
}
