import type { McpServer } from '@modelcontextprotocol/server';
import type { ChatService } from '../../chat/chat.service';
import type { NotebooksService } from '../../notebooks/notebooks.service';
import type { WebSearchService } from '../../sources/acquisition/web-search.service';
import type { SourcesService } from '../../sources/sources.service';
import type { GenerationService } from '../../study-materials/generation/generation.service';
import type { StudyMaterialService } from '../../study-materials/study-material.service';
import type { AgentActionsService } from '../agent-actions.service';
import type { AgentAuditService } from '../agent-audit.service';
import type { AgentSettingsService } from '../agent-settings.service';

/**
 * Services exposed to MCP tools. Kept as an explicit bag (instead of injecting
 * Nest providers into every tool file) so tool modules stay easy to test and
 * future `registerXxxTools` files can share the same contract.
 */
export interface McpToolServices {
  notebooks: NotebooksService;
  sources: SourcesService;
  webSearch: WebSearchService;
  chat: ChatService;
  studyMaterials: StudyMaterialService;
  generation: GenerationService;
  audit: AgentAuditService;
  actions: AgentActionsService;
  settings: AgentSettingsService;
}

/**
 * Per-request tool context. A fresh instance is built for every MCP request,
 * which keeps the endpoint stateless.
 */
export interface McpToolContext {
  /** Protocol era of the request; elicitation is only available on legacy. */
  era: 'legacy' | 'modern';
  /** The server instance, used to inspect the client's declared capabilities. */
  server: McpServer;
  /** Agent Key id from `req.auth.clientId`, or null for direct factory use. */
  agentKeyId: string | null;
  /** Agent Key display name when known; never a bearer token. */
  agentKeyName: string | null;
  /** Model used by `ask_notebook` when the caller does not choose one. */
  defaultModel: string;
  services: McpToolServices;
}

/** Access intent used when checking a Notebook's Agent Access level. */
export type McpAccessMode = 'read' | 'write';
