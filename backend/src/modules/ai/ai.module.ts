import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import {
  CHUNKING_CONFIG,
  ChunkingService,
  loadChunkingConfig,
} from './indexing/chunking.service';
import { ConnectionService } from './connection.service';
import {
  EMBEDDING_CONFIG,
  EmbeddingService,
  loadEmbeddingConfig,
} from './indexing/embedding.service';
import { IndexingService } from './indexing/indexing.service';
import {
  RETRIEVAL_EVIDENCE_CONFIG,
  loadRetrievalEvidenceConfig,
} from './retrieval/evidence-assembly';
import { ModelSyncService } from './model-sync.service';
import {
  QUERY_REWRITER,
  QueryUnderstandingService,
  RETRIEVAL_REWRITE_CONFIG,
  loadRetrievalRewriteConfig,
} from './retrieval/query-understanding';
import { QueryRewriterService } from './retrieval/query-rewriter.service';
import { RerankerService } from './retrieval/reranker.service';
import {
  RETRIEVAL_HYBRID_CONFIG,
  RETRIEVAL_RERANK_CONFIG,
  RETRIEVAL_RELEVANCE_CONFIG,
  RetrievalService,
  loadRetrievalHybridConfig,
  loadRetrievalRerankConfig,
  loadRetrievalRelevanceConfig,
} from './retrieval/retrieval.service';
import { RetrievalTraceService } from './retrieval/retrieval-trace.service';
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
    {
      provide: RETRIEVAL_REWRITE_CONFIG,
      useFactory: loadRetrievalRewriteConfig,
    },
    {
      provide: RETRIEVAL_EVIDENCE_CONFIG,
      useFactory: loadRetrievalEvidenceConfig,
    },
    QueryRewriterService,
    {
      provide: QUERY_REWRITER,
      useExisting: QueryRewriterService,
    },
    QueryUnderstandingService,
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
    QueryUnderstandingService,
    RerankerService,
    RetrievalService,
    RetrievalTraceService,
  ],
})
export class AiModule {}
