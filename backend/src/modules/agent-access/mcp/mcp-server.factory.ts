import { Injectable, Logger } from '@nestjs/common';
import {
  createMcpHandler,
  McpServer,
  type McpRequestContext,
} from '@modelcontextprotocol/server';
import {
  toNodeHandler,
  type NodeMcpRequestHandler,
} from '@modelcontextprotocol/node';
import { GATEWAY_DEFAULT_MODEL } from '../../ai/providers/model-catalog';
import { ChatService } from '../../chat/chat.service';
import { NotebooksService } from '../../notebooks/notebooks.service';
import { WebSearchService } from '../../sources/acquisition/web-search.service';
import { SourcesService } from '../../sources/sources.service';
import { GenerationService } from '../../study-materials/generation/generation.service';
import { StudyMaterialService } from '../../study-materials/study-material.service';
import { AgentActionsService } from '../agent-actions.service';
import { AgentAuditService } from '../agent-audit.service';
import { AgentSettingsService } from '../agent-settings.service';
import type { McpToolContext } from './mcp-context';
import { registerAgentPrompts } from './prompts';
import { registerAgentResources } from './resources';
import { registerAskTools } from './tools/ask.tools';
import { registerDeleteTools } from './tools/delete.tools';
import { registerMaterialTools } from './tools/materials.tools';
import { registerNotebookTools } from './tools/notebooks.tools';
import { registerSourceTools } from './tools/sources.tools';

const SERVER_NAME = 'memsystems';
const SERVER_VERSION = '1.0.0';

/**
 * Builds a fresh stateless MCP server per request and owns the single HTTP
 * handler shared by the controller. Tools, resources, and prompts are
 * registered here so future files (`delete.tools.ts`) can plug into the same
 * context without changing the transport wiring.
 */
@Injectable()
export class McpServerFactory {
  private readonly logger = new Logger(McpServerFactory.name);
  private nodeHandler?: NodeMcpRequestHandler;

  constructor(
    private readonly notebooksService: NotebooksService,
    private readonly sourcesService: SourcesService,
    private readonly webSearchService: WebSearchService,
    private readonly chatService: ChatService,
    private readonly studyMaterialsService: StudyMaterialService,
    private readonly generationService: GenerationService,
    private readonly auditService: AgentAuditService,
    private readonly actionsService: AgentActionsService,
    private readonly settingsService: AgentSettingsService,
  ) {}

  createServer(requestContext: McpRequestContext): McpServer {
    const server = new McpServer({
      name: SERVER_NAME,
      version: SERVER_VERSION,
    });

    const ctx: McpToolContext = {
      era: requestContext.era,
      server,
      agentKeyId: requestContext.authInfo?.clientId ?? null,
      agentKeyName: null,
      defaultModel: GATEWAY_DEFAULT_MODEL,
      services: {
        notebooks: this.notebooksService,
        sources: this.sourcesService,
        webSearch: this.webSearchService,
        chat: this.chatService,
        studyMaterials: this.studyMaterialsService,
        generation: this.generationService,
        audit: this.auditService,
        actions: this.actionsService,
        settings: this.settingsService,
      },
    };

    registerNotebookTools(server, ctx);
    registerSourceTools(server, ctx);
    registerAskTools(server, ctx);
    registerMaterialTools(server, ctx);
    registerDeleteTools(server, ctx);
    registerAgentResources(server, ctx);
    registerAgentPrompts(server);

    return server;
  }

  /** Returns the process-wide Node handler, creating it on first use. */
  getNodeHandler(): NodeMcpRequestHandler {
    if (!this.nodeHandler) {
      const handler = createMcpHandler(
        (requestContext) => this.createServer(requestContext),
        {
          legacy: 'stateless',
          responseMode: 'auto',
          onerror: (error) => {
            this.logger.warn(`MCP request failed: ${error.message}`);
          },
        },
      );

      this.nodeHandler = toNodeHandler(handler, {
        onerror: (error) => {
          this.logger.warn(`MCP adapter failed: ${error.message}`);
        },
      });
    }

    return this.nodeHandler;
  }
}
