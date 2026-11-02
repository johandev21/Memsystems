import { pgEnum } from 'drizzle-orm/pg-core';

export const sourceKindEnum = pgEnum('source_kind', ['text', 'url', 'file']);

export type SourceKind = (typeof sourceKindEnum.enumValues)[number];

export const sourceModalityEnum = pgEnum('source_modality', [
  'document',
  'image',
  'audio',
  'video',
  'code',
  'dataset',
  'slides',
  'ebook',
]);

export const sourceProcessingStatusEnum = pgEnum('source_processing_status', [
  'pending',
  'processing',
  'ready',
  'degraded',
  'failed',
  'cancelled',
]);

export const sourceProcessingStageEnum = pgEnum('source_processing_stage', [
  'uploading',
  'extracting',
  'transcribing',
  'analyzing_visuals',
  'indexing',
]);

export const sourceUploadIntentStatusEnum = pgEnum(
  'source_upload_intent_status',
  ['pending', 'uploaded', 'consuming', 'consumed', 'expired'],
);

export const sourceSegmentKindEnum = pgEnum('source_segment_kind', [
  'text',
  'heading',
  'code',
  'table',
  'formula',
  'visual_description',
  'transcript',
]);

export const sourceAddedViaEnum = pgEnum('source_added_via', [
  'manual',
  'ai_search',
]);

export const jobStatusEnum = pgEnum('job_status', [
  'pending',
  'processing',
  'ready',
  'failed',
  'cancelled',
]);

export interface SourceMetadata {
  searchQuery?: string;
  modelId?: string;
  provider?: string;
  searchedAt?: string;
  description?: string | null;
}

export interface SourceSegmentLocator {
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
  imageRegion?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export type SourceSegmentMetadata = Record<string, unknown>;

export type SourceQualityReason = 'navigation' | 'boilerplate' | 'paywall';

export interface SourceQualitySignals {
  wordCount: number;
  linkDensity: number;
  repetitionRatio: number;
  paywallHits: number;
}

export interface SourceQualityAssessment {
  status: 'ready' | 'degraded';
  score: number;
  reason: SourceQualityReason | null;
  signals: SourceQualitySignals;
}

export const studyMaterialKindEnum = pgEnum('study_material_kind', [
  'quiz',
  'simple_flashcard',
  'roadmap',
  'mind_map',
  'slides',
  'audio_overview',
]);

export const generationStatusEnum = pgEnum('generation_status', [
  'streaming',
  'completed',
  'failed',
  'cancelled',
]);

export const chatRoleEnum = pgEnum('chat_role', ['user', 'assistant']);

export const retrievalTraceKindEnum = pgEnum('retrieval_trace_kind', [
  'chat',
  'generation',
]);

export const groundingModeEnum = pgEnum('grounding_mode', [
  'strict',
  'moderate',
  'free',
]);

export type GroundingMode = (typeof groundingModeEnum.enumValues)[number];

export const agentAccessLevelEnum = pgEnum('agent_access_level', [
  'on',
  'read_only',
  'off',
]);

export type AgentAccessLevel = (typeof agentAccessLevelEnum.enumValues)[number];

export const agentSoftDeletePolicyEnum = pgEnum('agent_soft_delete_policy', [
  'ask',
  'allow',
]);

export type AgentSoftDeletePolicy =
  (typeof agentSoftDeletePolicyEnum.enumValues)[number];

export const agentConfirmPolicyEnum = pgEnum('agent_confirm_policy', [
  'never',
  'ask',
]);

export type AgentConfirmPolicy =
  (typeof agentConfirmPolicyEnum.enumValues)[number];
