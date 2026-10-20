import { Module } from '@nestjs/common';
import { AgentRateLimitModule } from '../agent-access/agent-rate-limit.module';
import { NotebooksModule } from '../notebooks/notebooks.module';
import { GenerationGroundingService } from './generation/generation-grounding';
import { GenerationRequestManager } from './generation/generation-request-manager';
import { GenerationService } from './generation/generation.service';
import { SlidesBuilderService } from './slides/slides-builder.service';

import { StreamHandler } from './generation/stream-handler';
import { StudyMaterialFolderService } from './study-material-folder.service';
import { StudyMaterialService } from './study-material.service';
import { StudyMaterialsController } from './study-materials.controller';
import { TrashService } from './trash.service';

@Module({
  imports: [NotebooksModule, AgentRateLimitModule],
  controllers: [StudyMaterialsController],
  providers: [
    StudyMaterialService,
    StudyMaterialFolderService,
    TrashService,
    GenerationRequestManager,
    GenerationGroundingService,
    StreamHandler,
    GenerationService,
    SlidesBuilderService,
  ],
  exports: [
    StudyMaterialService,
    StudyMaterialFolderService,
    TrashService,
    GenerationService,
    SlidesBuilderService,
  ],
})
export class StudyMaterialsModule {}
