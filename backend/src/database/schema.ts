export { sourceKindEnum } from './schema/enums';
export type { SourceKind } from './schema/enums';
export { sourceModalityEnum } from './schema/enums';
export { sourceProcessingStatusEnum } from './schema/enums';
export { sourceProcessingStageEnum } from './schema/enums';
export { sourceUploadIntentStatusEnum } from './schema/enums';
export { sourceSegmentKindEnum } from './schema/enums';
export { sourceAddedViaEnum } from './schema/enums';
export { jobStatusEnum } from './schema/enums';
export type { SourceMetadata } from './schema/enums';
export type { SourceSegmentLocator } from './schema/enums';
export type { SourceSegmentMetadata } from './schema/enums';
export type { SourceQualityReason } from './schema/enums';
export type { SourceQualitySignals } from './schema/enums';
export type { SourceQualityAssessment } from './schema/enums';
export { studyMaterialKindEnum } from './schema/enums';
export { generationStatusEnum } from './schema/enums';
export { chatRoleEnum } from './schema/enums';
export { retrievalTraceKindEnum } from './schema/enums';
export { groundingModeEnum } from './schema/enums';
export type { GroundingMode } from './schema/enums';
export { agentAccessLevelEnum } from './schema/enums';
export type { AgentAccessLevel } from './schema/enums';
export { agentSoftDeletePolicyEnum } from './schema/enums';
export type { AgentSoftDeletePolicy } from './schema/enums';
export { agentConfirmPolicyEnum } from './schema/enums';
export type { AgentConfirmPolicy } from './schema/enums';
export { notebookFolders } from './schema/notebooks-chat';
export { notebooks } from './schema/notebooks-chat';
export { sourceFolders } from './schema/sources';
export { sources } from './schema/sources';
export { sourceVersions } from './schema/sources';
export { sourceSegments } from './schema/sources';
export { jobs } from './schema/jobs';
export { studyMaterialFolders } from './schema/study-materials';
export { studyMaterials } from './schema/study-materials';
export { studyMaterialAudio } from './schema/study-materials';
export { generationRequests } from './schema/study-materials';
export { notebookChatMessages } from './schema/notebooks-chat';
export { retrievalTraces } from './schema/retrieval-index';
export { sourceChunks } from './schema/retrieval-index';
export { sourceUploadIntents } from './schema/sources';
export { agentKeys } from './schema/agents-settings';
export type { AgentAuditStatus } from './schema/agents-settings';
export { agentAuditLogs } from './schema/agents-settings';
export type { AgentPendingActionStatus } from './schema/agents-settings';
export type { AgentActionTargetType } from './schema/agents-settings';
export { agentPendingActions } from './schema/agents-settings';
export { appSettings } from './schema/agents-settings';

import {
  notebooks,
  notebookFolders,
  notebookChatMessages,
} from './schema/notebooks-chat';
import {
  sources,
  sourceVersions,
  sourceSegments,
  sourceUploadIntents,
} from './schema/sources';
import { sourceChunks } from './schema/retrieval-index';
import {
  studyMaterials,
  studyMaterialFolders,
  generationRequests,
} from './schema/study-materials';
import {
  agentKeys,
  agentAuditLogs,
  agentPendingActions,
  appSettings,
} from './schema/agents-settings';

export const table = {
  notebooks,
  notebookFolders,
  sources,
  sourceVersions,
  sourceSegments,
  sourceUploadIntents,
  sourceChunks,
  studyMaterials,
  studyMaterialFolders,
  generationRequests,
  notebookChatMessages,
  agentKeys,
  agentAuditLogs,
  agentPendingActions,
  appSettings,
} as const;

export type Table = typeof table;
