import { Module } from '@nestjs/common';
import { AgentRateLimitGuard } from './agent-rate-limit.guard';
import { AgentRateLimitService } from './agent-rate-limit.service';

/**
 * Kept separate from `AgentAccessModule` so Chat and Study Materials can apply
 * the guard without importing the whole MCP module graph.
 */
@Module({
  providers: [AgentRateLimitService, AgentRateLimitGuard],
  exports: [AgentRateLimitService, AgentRateLimitGuard],
})
export class AgentRateLimitModule {}
