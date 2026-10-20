import type { AgentActionTargetType } from '../../database/schema';
import type { AgentAccessSettings } from './agent-settings.service';

/**
 * Exact refusal copy for notebook deletes. Kept as a constant so the MCP tool
 * and its tests cannot drift apart.
 */
export const NOTEBOOK_DELETE_DISABLED_MESSAGE =
  'Deleting notebooks is disabled for agents. Change Settings → Agent Access → Resource deletes to "Ask" to allow approval requests.';

/** Folder deletion is not wired into Agent Access yet. */
export const FOLDER_DELETE_UNAVAILABLE_MESSAGE =
  'Folder deletion is not available through Agent Access yet.';

export const SOURCE_DELETE_DISABLED_MESSAGE =
  'Deleting sources is disabled for agents. Change Settings → Agent Access → Resource deletes to "Ask" to allow approval requests.';

export const STUDY_MATERIAL_DELETE_DISABLED_MESSAGE =
  'Deleting study materials is disabled for agents. Change Settings → Agent Access → Soft delete to "Allow" or "Ask every time".';

export const STUDY_MATERIAL_PERMANENT_DELETE_DISABLED_MESSAGE =
  'Permanently deleting study materials is disabled for agents. Change Settings → Agent Access → Permanent delete to "Ask" to allow approval requests.';

export const EMPTY_TRASH_DISABLED_MESSAGE =
  'Emptying Trash is disabled for agents. Change Settings → Agent Access → Permanent delete to "Ask" to allow approval requests.';

/**
 * What the caller should do next:
 * - `refuse`: throw an actionable error and never delete.
 * - `approval`: elicit confirmation or queue a Pending Agent Action.
 * - `execute`: the policy allows the delete immediately.
 */
export type DeletePolicyDecision =
  | { kind: 'refuse'; message: string }
  | { kind: 'approval' }
  | { kind: 'execute' };

export interface DeletePolicyInput {
  targetType: AgentActionTargetType;
  settings: AgentAccessSettings;
  /** Only meaningful for `study_material` (permanent delete vs. Trash). */
  permanent?: boolean;
}

/**
 * Maps the workspace Agent Access policies to a delete decision. Pure on
 * purpose: no database or service access, so the matrix stays unit-testable.
 */
export function decideDelete(input: DeletePolicyInput): DeletePolicyDecision {
  const { targetType, settings, permanent = false } = input;

  switch (targetType) {
    case 'notebook':
      return settings.resourceDelete === 'ask'
        ? { kind: 'approval' }
        : { kind: 'refuse', message: NOTEBOOK_DELETE_DISABLED_MESSAGE };

    case 'source':
      return settings.resourceDelete === 'ask'
        ? { kind: 'approval' }
        : { kind: 'refuse', message: SOURCE_DELETE_DISABLED_MESSAGE };

    case 'folder':
      return { kind: 'refuse', message: FOLDER_DELETE_UNAVAILABLE_MESSAGE };

    case 'study_material':
      if (permanent) {
        return settings.permanentDelete === 'ask'
          ? { kind: 'approval' }
          : {
              kind: 'refuse',
              message: STUDY_MATERIAL_PERMANENT_DELETE_DISABLED_MESSAGE,
            };
      }
      return settings.softDelete === 'allow'
        ? { kind: 'execute' }
        : { kind: 'approval' };

    case 'trash':
      return settings.permanentDelete === 'ask'
        ? { kind: 'approval' }
        : { kind: 'refuse', message: EMPTY_TRASH_DISABLED_MESSAGE };
  }
}

export interface DeleteSummaryInput {
  targetType: AgentActionTargetType;
  targetIds: string[];
  /** Human-readable title of the target, when the tool has one. */
  title?: string | null;
  permanent?: boolean;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function quotedTitle(title: string | null | undefined): string {
  return title && title.trim().length > 0 ? `"${title.trim()}"` : 'item';
}

function targetLabel(targetType: AgentActionTargetType): string {
  switch (targetType) {
    case 'notebook':
      return 'notebook';
    case 'source':
      return 'source';
    case 'study_material':
      return 'study material';
    case 'folder':
      return 'folder';
    case 'trash':
      return 'Trash';
  }
}

/**
 * Builds the one-line summary shown in Settings and returned to the agent.
 * Bulk requests collapse to a count so the summary stays readable.
 */
export function buildDeleteSummary(input: DeleteSummaryInput): string {
  const { targetType, targetIds, title, permanent = false } = input;

  if (targetType === 'trash') {
    return 'Permanently delete every item in Trash.';
  }

  if (targetIds.length > 1) {
    const label = targetLabel(targetType);
    const count = plural(targetIds.length, label, `${label}s`);
    return permanent
      ? `Permanently delete ${count}.`
      : `Delete ${count} and move them to Trash.`;
  }

  const id = targetIds[0] ?? '';
  const name = quotedTitle(title);

  if (targetType === 'study_material') {
    return permanent
      ? `Permanently delete study material ${name} (${id}).`
      : `Delete study material ${name} (${id}) and move it to Trash.`;
  }

  if (targetType === 'notebook') {
    return `Delete notebook ${name} (${id}) and move it to Trash.`;
  }

  if (targetType === 'source') {
    return `Delete source ${name} (${id}) and move it to Trash.`;
  }

  return `Delete folder ${name} (${id}).`;
}

/** Success copy returned by the MCP delete tools after a delete runs. */
export function buildDeleteSuccessMessage(input: DeleteSummaryInput): string {
  const { targetType, targetIds, title, permanent = false } = input;

  if (targetType === 'trash') {
    return 'Emptied Trash.';
  }

  if (targetIds.length > 1) {
    const label = targetLabel(targetType);
    return permanent
      ? `Permanently deleted ${plural(targetIds.length, label, `${label}s`)}.`
      : `Deleted ${plural(
          targetIds.length,
          label,
          `${label}s`,
        )} and moved them to Trash.`;
  }

  const id = targetIds[0] ?? '';
  const name = quotedTitle(title);

  if (targetType === 'study_material') {
    return permanent
      ? `Permanently deleted study material ${name} (${id}).`
      : `Deleted study material ${name} (${id}) and moved it to Trash.`;
  }

  if (targetType === 'notebook') {
    return `Deleted notebook ${name} (${id}) and moved it to Trash.`;
  }

  if (targetType === 'source') {
    return `Deleted source ${name} (${id}) and moved it to Trash.`;
  }

  return `Deleted folder ${name} (${id}).`;
}
