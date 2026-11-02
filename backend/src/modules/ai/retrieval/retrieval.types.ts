import type { RetrievalHistoryTurn } from './query-understanding';
import type {
  RetrievalAbstentionReason,
  RetrievalRerankSkippedReason,
  RetrievalTrace,
  RetrievalTraceRerankedCandidate,
} from './retrieval-trace';

export interface CitationLocator {
  pageNumber?: number;
  slideNumber?: number;
  startOffsetMs?: number;
  endOffsetMs?: number;
  speaker?: string;
  sheetName?: string;
  cellRange?: string;
  symbol?: string;
  lineStart?: number;
  lineEnd?: number;
  imageRegion?: { x: number; y: number; width: number; height: number };
}

export interface RetrievedChunk {
  chunkId: string;
  chunkIndex: number;
  sourceId: string;
  title: string;
  content: string;
  sectionPath: string[];
  score: number;
  url: string | null;
  kind: string;
  sourceVersionId: string | null;
  locator: CitationLocator | null;
}

export interface UnhelpfulSource {
  id: string;
  title: string;
  kind: string;
  url: string | null;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  abstained: boolean;
  abstentionReason: RetrievalAbstentionReason | null;
  unhelpfulSources: UnhelpfulSource[];
}

export interface RetrievalOutcome extends RetrievalResult {
  trace: RetrievalTrace;
}

export interface RetrievalChunkIndexRange {
  minChunkIndex: number;
  maxChunkIndex: number;
}

export interface RetrievalRequest {
  notebookId: string;
  query: string;
  topK?: number;
  sourceIds?: string[];
  history?: RetrievalHistoryTurn[];
  relevanceFloor?: number;
  rerankThreshold?: number;
  tokenBudget?: number;
  skipQueryUnderstanding?: boolean;
  headingPaths?: string[][];
  chunkIndexRange?: RetrievalChunkIndexRange;
  excludeChunkIds?: string[];
}

export interface RetrievalRelevanceConfig {
  relevanceFloor: number;
}

export interface RetrievalRerankConfig {
  enabled: boolean;
  model: string;
  candidateDepth: number;
  threshold: number;
  topK: number;
}

export interface RetrievalHybridConfig {
  enabled: boolean;
  fusionK: number;
  denseWeight: number;
  lexicalWeight: number;
  denseCandidateDepth: number | null;
  lexicalCandidateDepth: number | null;
}

export interface RetrievalChunkRow {
  chunk_id: string;
  chunk_index: number;
  source_id: string;
  title: string;
  url: string | null;
  kind: string;
  source_version_id: string | null;
  locator: CitationLocator | null;
  content: string;
  heading_path: string[] | null;
  searchable_text: string;
  score: number;
  dense_score?: number | null;
}

export interface RankedCandidate {
  row: RetrievalChunkRow;
  fusedScore: number;
  rerankScore: number | null;
}

export interface RetrievalPolicy {
  topK: number;
  sourceIds: string[] | null;
  relevanceFloor: number;
  rerankThreshold: number;
}

export interface RerankOutcome {
  applied: boolean;
  skippedReason: RetrievalRerankSkippedReason | null;
  candidates: RankedCandidate[];
  traceCandidates: RetrievalTraceRerankedCandidate[];
  inputTokens: number;
}
