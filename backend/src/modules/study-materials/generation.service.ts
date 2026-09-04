import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { sources } from '../../database/schema';
import { NotFoundError } from '../../common/errors/domain-error';
import { ConnectionService } from '../ai/connection.service';
import { DRIZZLE } from '../database/database.module';
import { NotebooksService } from '../notebooks/notebooks.service';
import {
  GenerationRequestManager,
  StartGenerationInput,
} from './generation-request-manager';
import { StudyMaterialKind } from './shapes';
import { StreamHandler } from './stream-handler';

const MODELS_BY_KIND: Record<StudyMaterialKind, string> = {
  quiz: 'openai/gpt-5.6-sol',
  simple_flashcard: 'openai/gpt-5.6-sol',
  roadmap: 'openai/gpt-5.6-sol',
  mind_map: 'openai/gpt-5.6-sol',
  slides: 'openai/gpt-5.6-sol',
};

@Injectable()
export class GenerationService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly notebooksService: NotebooksService,
    private readonly connectionService: ConnectionService,
    private readonly requestManager: GenerationRequestManager,
    private readonly streamHandler: StreamHandler,
  ) {}

  async generate(
    userId: string,
    notebookId: string,
    input: StartGenerationInput,
  ) {
    await this.notebooksService.assertNotebookOwner(userId, notebookId);

    const modelId = input.model ?? MODELS_BY_KIND[input.kind];
    await this.connectionService.requireConnected(userId, modelId);

    const sourceTexts =
      input.sourceIds.length > 0
        ? await this.fetchSourceTexts(userId, notebookId, input.sourceIds)
        : [];

    const requestId = await this.requestManager.create(userId, notebookId, {
      ...input,
      model: modelId,
    });

    const { stream } = this.streamHandler.createStream(
      userId,
      notebookId,
      {
        ...input,
        model: modelId,
      },
      sourceTexts,
      requestId,
      () => {
        void this.requestManager.markCompleted(requestId);
      },
      () => {
        void this.requestManager.markFailed(requestId);
      },
    );

    return { stream, requestId };
  }

  async cancel(userId: string, requestId: string) {
    const request = await this.requestManager.get(requestId);
    if (!request) {
      throw new NotFoundError('Generation request');
    }
    await this.notebooksService.assertNotebookOwner(userId, request.notebookId);
    await this.requestManager.cancel(userId, requestId);
    return request;
  }

  private async fetchSourceTexts(
    _userId: string,
    notebookId: string,
    sourceIds: string[],
  ) {
    const rows = await this.db
      .select({
        id: sources.id,
        title: sources.title,
        rawText: sources.rawText,
        notebookId: sources.notebookId,
      })
      .from(sources)
      .where(eq(sources.notebookId, notebookId));

    if (sourceIds.length === 0) {
      return [];
    }

    const sourceIdsSet = new Set(sourceIds);
    const owned = rows.filter(
      (r) => sourceIdsSet.has(r.id) && r.notebookId === notebookId,
    );

    return owned;
  }
}
