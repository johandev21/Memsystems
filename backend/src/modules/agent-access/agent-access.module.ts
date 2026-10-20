import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ChatModule } from '../chat/chat.module';
import { NotebooksModule } from '../notebooks/notebooks.module';
import { SourcesModule } from '../sources/sources.module';
import { StorageModule } from '../storage/storage.module';
import { StudyMaterialsModule } from '../study-materials/study-materials.module';
import { TrashModule } from '../trash/trash.module';
import { AgentAccessController } from './agent-access.controller';
import { AgentActionsController } from './agent-actions.controller';
import { AgentActionsService } from './agent-actions.service';
import { AgentAuditService } from './agent-audit.service';
import { AgentKeyGuard } from './agent-key.guard';
import { AgentKeysService } from './agent-keys.service';
import { AgentLocalGuard } from './agent-local.guard';
import { AgentRateLimitGuard } from './agent-rate-limit.guard';
import { AgentRateLimitModule } from './agent-rate-limit.module';
import { AgentSettingsModule } from './agent-settings.module';
import { McpController } from './mcp/mcp.controller';
import { McpServerFactory } from './mcp/mcp-server.factory';

@Module({
  imports: [
    AgentRateLimitModule,
    AgentSettingsModule,
    NotebooksModule,
    SourcesModule,
    ChatModule,
    StudyMaterialsModule,
    AiModule,
    StorageModule,
    TrashModule,
  ],
  controllers: [AgentAccessController, AgentActionsController, McpController],
  providers: [
    AgentKeysService,
    AgentAuditService,
    AgentActionsService,
    AgentKeyGuard,
    AgentLocalGuard,
    AgentRateLimitGuard,
    McpServerFactory,
  ],
  exports: [
    AgentSettingsModule,
    AgentKeysService,
    AgentAuditService,
    AgentActionsService,
    AgentKeyGuard,
    AgentLocalGuard,
    AgentRateLimitModule,
  ],
})
export class AgentAccessModule {}
