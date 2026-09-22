import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ChunkingService } from './chunking.service';
import { ConnectionService } from './connection.service';
import { EmbeddingService } from './embedding.service';
import { IndexingService } from './indexing.service';
import { ModelSyncService } from './model-sync.service';
import {
  RETRIEVAL_RELEVANCE_CONFIG,
  RetrievalService,
  loadRetrievalRelevanceConfig,
} from './retrieval.service';
import { RetrievalTraceService } from './retrieval-trace.service';
import { UserSettingsService } from './user-settings.service';

@Global()
@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [AiController],
  providers: [
    UserSettingsService,
    ConnectionService,
    ModelSyncService,
    AiService,
    EmbeddingService,
    ChunkingService,
    IndexingService,
    {
      provide: RETRIEVAL_RELEVANCE_CONFIG,
      useFactory: loadRetrievalRelevanceConfig,
    },
    RetrievalService,
    RetrievalTraceService,
  ],
  exports: [
    UserSettingsService,
    ConnectionService,
    ModelSyncService,
    AiService,
    EmbeddingService,
    ChunkingService,
    IndexingService,
    RetrievalService,
    RetrievalTraceService,
  ],
})
export class AiModule {}
