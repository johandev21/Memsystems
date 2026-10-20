import { apiDelete, apiPatch, apiPost, createQueryOptions } from "@/shared/api";
import type { AgentAccessLevel } from "@/shared/types/agent-access";

export type AgentSoftDeletePolicy = "ask" | "allow";
export type AgentConfirmPolicy = "never" | "ask";
export type AgentAuditStatus = "success" | "error" | "denied" | "pending_approval";

export interface AgentAccessSettings {
  softDelete: AgentSoftDeletePolicy;
  permanentDelete: AgentConfirmPolicy;
  resourceDelete: AgentConfirmPolicy;
  notebookDefault: AgentAccessLevel;
}

export interface AgentKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface AgentKeysResponse {
  keys: AgentKey[];
}

export interface CreatedAgentKey {
  /** Plaintext key. The server only returns it once. */
  key: string;
  agentKey: AgentKey;
}

export interface AgentAuditEntry {
  id: string;
  agentKeyId: string | null;
  toolName: string;
  args: Record<string, unknown>;
  status: AgentAuditStatus;
  errorMessage: string | null;
  durationMs: number | null;
  notebookId: string | null;
  createdAt: string;
}

export interface AgentAuditPage {
  entries: AgentAuditEntry[];
  total: number;
}

export interface AgentAuditFilters {
  keyId?: string;
  status?: AgentAuditStatus;
  limit?: number;
  offset?: number;
}

export type AgentPendingActionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "failed";

export type AgentActionTargetType =
  | "notebook"
  | "source"
  | "study_material"
  | "folder"
  | "trash";

export interface AgentPendingAction {
  id: string;
  agentKeyId: string | null;
  agentKeyName: string | null;
  toolName: string;
  notebookId: string | null;
  targetType: AgentActionTargetType;
  targetIds: string[];
  summary: string;
  payload: Record<string, unknown> | null;
  status: AgentPendingActionStatus;
  errorMessage: string | null;
  createdAt: string;
  expiresAt: string;
  resolvedAt: string | null;
}

export interface AgentPendingActionsPage {
  actions: AgentPendingAction[];
  pendingCount: number;
}

export interface AgentPendingActionCount {
  pendingCount: number;
}

export const AGENT_AUDIT_PAGE_SIZE = 50;

/** The header badge and open dialog refresh at this interval. */
export const AGENT_ACTIONS_REFETCH_INTERVAL_MS = 30_000;

export const agentAccessQueryOptions = () =>
  createQueryOptions<AgentAccessSettings>(["agent-access"], "/api/settings/agent-access");

export const agentKeysQueryOptions = () =>
  createQueryOptions<AgentKeysResponse>(["agent-keys"], "/api/settings/agent-keys");

export const agentAuditQueryOptions = (filters: AgentAuditFilters = {}) => {
  const params = new URLSearchParams();
  if (filters.keyId) params.set("keyId", filters.keyId);
  if (filters.status) params.set("status", filters.status);
  params.set("limit", String(filters.limit ?? AGENT_AUDIT_PAGE_SIZE));
  params.set("offset", String(filters.offset ?? 0));

  return createQueryOptions<AgentAuditPage>(
    ["agent-audit", filters],
    `/api/settings/agent-audit?${params.toString()}`,
  );
};

export const agentPendingActionsQueryOptions = () =>
  createQueryOptions<AgentPendingActionsPage>(
    ["agent-actions"],
    "/api/agent-actions?status=pending",
  );

export const agentPendingActionCountQueryOptions = () =>
  createQueryOptions<AgentPendingActionCount>(
    ["agent-actions", "count"],
    "/api/agent-actions/count",
  );

export function updateAgentAccessSettings(
  input: Partial<AgentAccessSettings>,
): Promise<AgentAccessSettings> {
  return apiPatch<Partial<AgentAccessSettings>, AgentAccessSettings>(
    "/api/settings/agent-access",
    input,
  );
}

export function createAgentKey(name: string): Promise<CreatedAgentKey> {
  return apiPost<{ name: string }, CreatedAgentKey>("/api/settings/agent-keys", { name });
}

export function revokeAgentKey(id: string): Promise<void> {
  return apiDelete(`/api/settings/agent-keys/${encodeURIComponent(id)}`);
}

export function clearAgentAudit(): Promise<void> {
  return apiDelete("/api/settings/agent-audit");
}

export function approveAgentAction(id: string): Promise<AgentPendingAction> {
  return apiPost<Record<string, never>, AgentPendingAction>(
    `/api/agent-actions/${encodeURIComponent(id)}/approve`,
    {},
  );
}

export function rejectAgentAction(id: string): Promise<AgentPendingAction> {
  return apiPost<Record<string, never>, AgentPendingAction>(
    `/api/agent-actions/${encodeURIComponent(id)}/reject`,
    {},
  );
}
