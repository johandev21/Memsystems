import { Module } from '@nestjs/common';
import { AgentRateLimitModule } from '../agent-access/agent-rate-limit.module';
import { NotebooksModule } from '../notebooks/notebooks.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [NotebooksModule, AgentRateLimitModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
