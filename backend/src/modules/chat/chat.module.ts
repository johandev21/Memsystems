import { Module } from '@nestjs/common';
import { NotebooksModule } from '../notebooks/notebooks.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [NotebooksModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
