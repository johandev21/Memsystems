import { Controller, Get, Header, Req } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { buildLlmsFullTxt, buildLlmsTxt, resolveBaseUrl } from './llms';

/**
 * Agent-facing documentation. Both routes are excluded from the `api` global
 * prefix in `main.ts` so they live at `/llms.txt` and `/llms-full.txt`.
 */
@ApiTags('Agent Access')
@Controller()
export class AgentDocsController {
  @Get('llms.txt')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @ApiOperation({
    summary: 'Agent guide (llms.txt)',
    description:
      'Short, link-first guide for agent harnesses: MCP endpoint, Agent Key creation, tools, resources, prompts, and approvals.',
  })
  @ApiExcludeEndpoint()
  llmsTxt(@Req() request: Request): string {
    return buildLlmsTxt(resolveBaseUrl(request));
  }

  @Get('llms-full.txt')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @ApiOperation({
    summary: 'Full agent reference (llms-full.txt)',
    description:
      'Self-contained reference for agent harnesses: connection, authentication, every tool argument, resources, prompts, approval policies, and errors.',
  })
  @ApiExcludeEndpoint()
  llmsFullTxt(@Req() request: Request): string {
    return buildLlmsFullTxt(resolveBaseUrl(request));
  }
}
