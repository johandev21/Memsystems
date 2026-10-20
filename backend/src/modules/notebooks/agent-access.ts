import type { AgentAccessLevel } from '../../database/schema';

/**
 * A Notebook either overrides the workspace default (`agent_access`) or
 * inherits it (`null`). Keep this pure so MCP callers and HTTP responses share
 * exactly one interpretation.
 */
export function resolveAgentAccess(
  override: AgentAccessLevel | null | undefined,
  notebookDefault: AgentAccessLevel,
): AgentAccessLevel {
  return override ?? notebookDefault;
}
