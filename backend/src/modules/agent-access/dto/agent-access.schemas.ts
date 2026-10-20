import { z } from 'zod';

/**
 * Shared Agent Access enums. Keeping them in one place lets the Notebook
 * settings DTO (#121) reuse the exact same components in OpenAPI.
 */
export const agentAccessLevelSchema = z.enum(['on', 'read_only', 'off']).meta({
  id: 'AgentAccessLevel',
  description:
    'Whether an agent may use a Notebook: on, read_only, or off. null inherits the workspace default.',
});

export const agentSoftDeletePolicySchema = z.enum(['ask', 'allow']).meta({
  id: 'AgentSoftDeletePolicy',
  description:
    'Whether agents may soft-delete Study Materials: ask for approval or allow it.',
});

export const agentConfirmPolicySchema = z.enum(['never', 'ask']).meta({
  id: 'AgentConfirmPolicy',
  description:
    'Whether an agent may perform a destructive action: never, or ask for approval.',
});
