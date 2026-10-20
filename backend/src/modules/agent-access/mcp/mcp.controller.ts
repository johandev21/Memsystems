import {
  Controller,
  Delete,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { NodeMcpRequestHandler } from '@modelcontextprotocol/node';
import type { Response } from 'express';
import { AgentKeyGuard } from '../agent-key.guard';
import { AgentLocalGuard } from '../agent-local.guard';
import { AgentRateLimitGuard } from '../agent-rate-limit.guard';
import type { AgentAuthenticatedRequest } from '../agent-request.types';
import { McpServerFactory } from './mcp-server.factory';

/**
 * Stateless Streamable HTTP MCP endpoint. The guards run in order: authenticate
 * the Agent Key, restrict the endpoint to local clients, then apply the MCP rate
 * limit. The SDK handler writes the response directly, so Nest must not send.
 *
 * The three verbs are the ones the Streamable HTTP transport uses: POST for
 * JSON-RPC messages, GET for the optional SSE stream, and DELETE for session
 * termination (answered with 405 by the stateless transport).
 */
@ApiTags('Agent Access')
@ApiBearerAuth('agentKey')
@Controller('mcp')
@UseGuards(AgentKeyGuard, AgentLocalGuard, AgentRateLimitGuard)
export class McpController {
  private readonly nodeHandler: NodeMcpRequestHandler;

  constructor(factory: McpServerFactory) {
    this.nodeHandler = factory.getNodeHandler();
  }

  @Post()
  @ApiOperation({
    summary: 'MCP endpoint (POST)',
    description:
      'Accepts JSON-RPC messages for the Memsystems MCP server: initialize, tools/list, tools/call, resources/read, prompts/get, and notifications. Authenticate with an Agent Key.',
  })
  @ApiProduces('application/json', 'text/event-stream')
  async handlePost(
    @Req() req: AgentAuthenticatedRequest,
    @Res() res: Response,
  ): Promise<void> {
    await this.nodeHandler(req, res, req.body);
  }

  @Get()
  @ApiOperation({
    summary: 'MCP endpoint (GET)',
    description:
      'Opens the optional SSE stream for server-initiated messages. The stateless transport does not keep sessions, so clients normally use POST only.',
  })
  @ApiProduces('text/event-stream')
  async handleGet(
    @Req() req: AgentAuthenticatedRequest,
    @Res() res: Response,
  ): Promise<void> {
    await this.nodeHandler(req, res);
  }

  @Delete()
  @ApiOperation({
    summary: 'MCP endpoint (DELETE)',
    description:
      'Session termination for the Streamable HTTP transport. The stateless transport answers with 405 because it keeps no session.',
  })
  async handleDelete(
    @Req() req: AgentAuthenticatedRequest,
    @Res() res: Response,
  ): Promise<void> {
    await this.nodeHandler(req, res);
  }
}
