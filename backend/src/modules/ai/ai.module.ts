import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import {
  CHUNKING_CONFIG,
  ChunkingService,
  loadChunkingConfig,
} from './chunking.service';
import { ConnectionService } from './connection.service';
import {
  EMBEDDING_CONFIG,
  EmbeddingService,
  loadEmbeddingConfig,
} from './embedding.service';
import { IndexingService } from './indexing.service';
import { ModelSyncService } from './model-sync.service';
import { RerankerService } from './reranker.service';
import {
  RETRIEVAL_HYBRID_CONFIG,
  RETRIEVAL_RERANK_CONFIG,
  RETRIEVAL_RELEVANCE_CONFIG,
  RetrievalService,
  loadRetrievalHybridConfig,
  loadRetrievalRerankConfig,
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
      provide: CHUNKING_CONFIG,
      useFactory: loadChunkingConfig,
    },
    {
      provide: EMBEDDING_CONFIG,
      useFactory: loadEmbeddingConfig,
    },
    {
      provide: RETRIEVAL_RELEVANCE_CONFIG,
      useFactory: loadRetrievalRelevanceConfig,
    },
    {
      provide: RETRIEVAL_RERANK_CONFIG,
      useFactory: loadRetrievalRerankConfig,
    },
    {
      provide: RETRIEVAL_HYBRID_CONFIG,
      useFactory: loadRetrievalHybridConfig,
    },
    RerankerService,
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
    EMBEDDING_CONFIG,
    RerankerService,
    RetrievalService,
    RetrievalTraceService,
  ],
})
export class AiModule {}
