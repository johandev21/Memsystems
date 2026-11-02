import type { CitationEvidence } from '../../../chat/chat-citations';
import type {
  CitationLocator,
  RetrievalChunkIndexRange,
  RetrievedChunk,
} from '../../../ai/retrieval/retrieval.service';
import type { RetrievalTrace } from '../../../ai/retrieval/retrieval-trace';
import type { StudyMaterialKind } from '../../content/shapes';

export type BriefIntent = 'broad-survey' | 'focused-brief';

export interface GroundedSource {
  id: string;
  title: string;
  kind: string;
  url: string | null;
  chunks: RetrievedChunk[];
  promptChunks: RetrievedChunk[];
}

export interface UnavailableSource {
  id: string;
  title: string;
  kind: string;
}

export interface GenerationGrounding {
  sources: GroundedSource[];
  evidence: CitationEvidence[];
  unavailableSources: UnavailableSource[];
  degradedSources: UnavailableSource[];
  traces: RetrievalTrace[];
  kind?: StudyMaterialKind;
}

export interface GenerationGroundingRequest {
  notebookId: string;
  kind: StudyMaterialKind;
  brief: string;
  sourceIds: string[];
}

export interface SourceSection {
  headingPath: string[];
  minChunkIndex: number;
  maxChunkIndex: number;
  chunkCount: number;
}

export interface IndexedChunkRow {
  chunkId: string;
  chunkIndex: number;
  sourceId: string;
  sourceVersionId: string | null;
  locator: CitationLocator | null;
  content: string;
  headingPath: string[];
}

export interface SourceMetaRow {
  id: string;
  title: string;
  kind: string;
  url: string | null;
  processingStatus: string;
}

export interface PlannedPass {
  sourceId: string;
  query: string;
  topK: number;
  headingPaths?: string[][];
  chunkIndexRange?: RetrievalChunkIndexRange;
  excludeChunkIds?: string[];
}
