import { Injectable } from '@nestjs/common';
import { EmbeddingService } from '../indexing/embedding.service';
import { voyageRerank } from '../providers/voyage.client';

export interface RerankRequest {
  query: string;
  documents: string[];
  model: string;
}

export interface RerankedDocument {
  index: number;
  relevanceScore: number;
}

export interface RerankResponse {
  candidates: RerankedDocument[];
  inputTokens: number;
}

export interface Reranker {
  rerank(request: RerankRequest): Promise<RerankResponse | null>;
}

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
