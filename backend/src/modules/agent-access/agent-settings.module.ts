import { Module } from '@nestjs/common';
import { AgentSettingsService } from './agent-settings.service';

/**
 * Shares the Agent Access settings read with modules that cannot import
 * `AgentAccessModule` without creating a cycle (NotebooksModule is imported by
 * AgentAccessModule for the MCP tools).
 */
@Module({
  providers: [AgentSettingsService],
  exports: [AgentSettingsService],
})
export class AgentSettingsModule {}
