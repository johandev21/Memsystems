import { Injectable } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { voyageRerank } from './providers/voyage.client';

/**
 * One cross-encoder call: score every document against the query. Documents
 * are sent as plain text; the returned index maps each score back to its
 * position in `documents`.
 */
export interface RerankRequest {
  query: string;
  documents: string[];
  model: string;
}

export interface RerankedDocument {
  /** Position of the document in `RerankRequest.documents`. */
  index: number;
  relevanceScore: number;
}

export interface RerankResponse {
  candidates: RerankedDocument[];
  /** Provider-reported tokens spent reranking. */
  inputTokens: number;
}

/**
 * The retrieval pipeline's reranker seam. Implementations return `null` when
 * no provider key is configured; provider failures throw. The pipeline owns
 * the graceful degradation, so it can fall back to the fused order and record
 * why in the trace.
 */
export interface Reranker {
  rerank(request: RerankRequest): Promise<RerankResponse | null>;
}

/**
 * Reranks with the Embeddings Connection provider's cross-encoder endpoint
 * (Voyage), using the same key as embeddings. The Voyage client maps HTTP
 * failures onto domain errors; retrieval catches them and degrades.
 */
@Injectable()
export class RerankerService implements Reranker {
  constructor(private readonly embeddingService: EmbeddingService) {}

  async rerank(request: RerankRequest): Promise<RerankResponse | null> {
    const apiKey = await this.embeddingService.getVoyageApiKey();
    if (!apiKey) return null;

    const response = await voyageRerank({
      apiKey,
      model: request.model,
      query: request.query,
      documents: request.documents,
    });
    return {
      candidates: response.candidates,
      inputTokens: response.totalTokens,
    };
  }
}
