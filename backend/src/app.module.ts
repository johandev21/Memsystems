import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentDocsController } from './agent-docs/agent-docs.controller';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AgentAccessModule } from './modules/agent-access/agent-access.module';
import { AiModule } from './modules/ai/ai.module';
import { ChatModule } from './modules/chat/chat.module';
import { DatabaseModule } from './modules/database/database.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { NotebooksModule } from './modules/notebooks/notebooks.module';
import { SourcesModule } from './modules/sources/sources.module';
import { StorageModule } from './modules/storage/storage.module';
import { StudyMaterialsModule } from './modules/study-materials/study-materials.module';
import { TrashModule } from './modules/trash/trash.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    DatabaseModule,
    JobsModule,
    StorageModule,
    AiModule,
    NotebooksModule,
    SourcesModule,
    ChatModule,
    StudyMaterialsModule,
    TrashModule,
    AgentAccessModule,
  ],
  controllers: [AppController, AgentDocsController],
  providers: [AppService],
})
export class AppModule {}
