import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { StudyGuideOptions } from './study-guide-content';
import {
  EvaluateProblemRequestSchema,
  type EvaluateProblemRequest,
  PracticeProblemsOptions,
} from './practice-problems-content';
import { CaseStudyOptions } from './case-study-content';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { GenerationService } from './generation.service';
import { StudyMaterialKind } from './shapes';
import { StudyMaterialFolderService } from './study-material-folder.service';
import { StudyMaterialService } from './study-material.service';
import { TrashService } from './trash.service';

const createStudyMaterialSchema = z.object({
  kind: z.enum([
    'quiz',
    'simple_flashcard',
    'roadmap',
    'mind_map',
    'slides',
    'study_guide',
    'practice_problems',
    'case_study',
  ]),
  title: z.string().min(1, 'Title is required').max(200),
  content: z.unknown(),
  folderId: z.string().optional(),
});

const updateStudyMaterialSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.unknown().optional(),
});

const moveStudyMaterialSchema = z.object({
  folderId: z.string().nullable(),
});

const createFolderSchema = z.object({
  name: z.string().min(1, 'Folder name is required').max(200),
  parentId: z.string().optional(),
});

const updateFolderSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  parentId: z.string().nullable().optional(),
});

export const generateRequestSchema = z.object({
  kind: z.enum([
    'quiz',
    'simple_flashcard',
    'roadmap',
    'mind_map',
    'slides',
    'study_guide',
    'practice_problems',
    'case_study',
  ]),
  brief: z.string().default(''),
  sourceIds: z.array(z.string()).default([]),
  folderId: z.string().nullable().optional(),
  model: z.string().optional(),
  questionCount: z.number().min(1).max(50).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  cardStyle: z.enum(['qa', 'definition', 'cloze', 'mixed']).optional(),
  roadmapOptions: z
    .object({
      phaseCount: z.number().min(0).max(50),
      detailLevel: z.enum(['basic', 'detailed']),
    })
    .optional(),
  mindMapOptions: z
    .object({
      nodeCount: z.number().min(0).max(100),
      structure: z.enum(['radial', 'hierarchical', 'organic']),
      colorGroups: z.boolean(),
      crossLinks: z.boolean(),
      detailLevel: z.enum(['basic', 'detailed']),
    })
    .optional(),
  studyGuideOptions: StudyGuideOptions.optional(),
  practiceProblemsOptions: PracticeProblemsOptions.optional(),
  caseStudyOptions: CaseStudyOptions.optional(),
  slidesOptions: z
    .object({
      slideCount: z.number().min(0).max(20),
      theme: z.enum([
        'dark',
        'light',
        'accent',
        'editorial',
        'academic',
        'technical',
        'warm',
      ]),
      detailLevel: z.enum(['basic', 'detailed']),
    })
    .optional(),
});

@Controller()
@UseGuards(AuthGuard)
export class StudyMaterialsController {
  constructor(
    private readonly studyMaterialService: StudyMaterialService,
    private readonly folderService: StudyMaterialFolderService,
    private readonly trashService: TrashService,
    private readonly generationService: GenerationService,
  ) {}

  // --- Study Materials ---
  @Get('notebooks/:notebookId/study-materials')
  async listStudyMaterials(
    @CurrentUser('id') userId: string,
    @Param('notebookId') notebookId: string,
    @Query('folderId') folderId?: string,
    @Query('kind') kind?: string,
  ) {
    return this.studyMaterialService.list(userId, notebookId, {
      folderId,
      kind: kind as StudyMaterialKind | undefined,
    });
  }

  @Post('notebooks/:notebookId/study-materials')
  @UsePipes(new ZodValidationPipe(createStudyMaterialSchema))
  async createStudyMaterial(
    @CurrentUser('id') userId: string,
    @Param('notebookId') notebookId: string,
    @Body() body: z.infer<typeof createStudyMaterialSchema>,
  ) {
    return this.studyMaterialService.create(userId, notebookId, body);
  }

  @Get('study-materials/:id')
  async getStudyMaterial(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.studyMaterialService.get(userId, id);
  }

  @Get('study-materials/:id/export')
  async exportSlides(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { title, buffer } = await this.studyMaterialService.buildSlidesPptx(
      userId,
      id,
    );
    const filename = `${title || 'slides'}.pptx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename.replace(/"/g, '')}"`,
    );
    res.setHeader('Content-Length', String(buffer.length));
    res.send(buffer);
  }

  @Patch('study-materials/:id')
  @UsePipes(new ZodValidationPipe(updateStudyMaterialSchema))
  async updateStudyMaterial(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() body: z.infer<typeof updateStudyMaterialSchema>,
  ) {
    return this.studyMaterialService.update(userId, id, body);
  }

  @Delete('study-materials/:id')
  async deleteStudyMaterial(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.studyMaterialService.delete(userId, id);
  }

  @Post('study-materials/:id/restore')
  async restoreStudyMaterial(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.studyMaterialService.restore(userId, id);
  }

  @Delete('study-materials/:id/permanent')
  async permanentDeleteStudyMaterial(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.studyMaterialService.permanentDelete(userId, id);
    return { success: true };
  }

  @Post('study-materials/:id/shuffle')
  async shuffleQuiz(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.studyMaterialService.shuffle(userId, id);
  }

  @Patch('study-materials/:id/move')
  @UsePipes(new ZodValidationPipe(moveStudyMaterialSchema))
  async moveStudyMaterial(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() body: z.infer<typeof moveStudyMaterialSchema>,
  ) {
    return this.studyMaterialService.move(userId, id, body);
  }

  @Post('study-materials/:id/duplicate')
  async duplicateStudyMaterial(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.studyMaterialService.duplicate(userId, id);
  }

  @Post('study-materials/:id/evaluate-problem')
  @UsePipes(new ZodValidationPipe(EvaluateProblemRequestSchema))
  async evaluateProblem(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() body: EvaluateProblemRequest,
  ) {
    return this.studyMaterialService.evaluatePracticeProblem(userId, id, body);
  }

  // --- Folders ---
  @Get('notebooks/:notebookId/folders')
  async listFolders(
    @CurrentUser('id') userId: string,
    @Param('notebookId') notebookId: string,
  ) {
    return this.folderService.list(userId, notebookId);
  }

  @Post('notebooks/:notebookId/folders')
  @UsePipes(new ZodValidationPipe(createFolderSchema))
  async createFolder(
    @CurrentUser('id') userId: string,
    @Param('notebookId') notebookId: string,
    @Body() body: z.infer<typeof createFolderSchema>,
  ) {
    return this.folderService.create(userId, notebookId, body);
  }

  @Patch('folders/:id')
  @UsePipes(new ZodValidationPipe(updateFolderSchema))
  async updateFolder(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() body: z.infer<typeof updateFolderSchema>,
  ) {
    return this.folderService.update(userId, id, body);
  }

  @Delete('folders/:id')
  async deleteFolder(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.folderService.delete(userId, id);
  }

  @Post('folders/:id/restore')
  async restoreFolder(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.folderService.restore(userId, id);
  }

  // --- Trash ---
  @Get('notebooks/:notebookId/trash')
  async listTrash(
    @CurrentUser('id') userId: string,
    @Param('notebookId') notebookId: string,
  ) {
    return this.trashService.list(userId, notebookId);
  }

  @Delete('trash/study-materials/:id')
  async hardDeleteTrashMaterial(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.trashService.hardDeleteStudyMaterial(userId, id);
    return { success: true };
  }

  @Delete('trash/folders/:id')
  async hardDeleteTrashFolder(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.trashService.hardDeleteFolder(userId, id);
    return { success: true };
  }

  // --- Generation ---
  @Post('notebooks/:id/generate')
  @UsePipes(new ZodValidationPipe(generateRequestSchema))
  async generate(
    @CurrentUser('id') userId: string,
    @Param('id') notebookId: string,
    @Body() body: z.infer<typeof generateRequestSchema>,
    @Res() res: Response,
  ) {
    const { stream, requestId } = await this.generationService.generate(
      userId,
      notebookId,
      body,
    );

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Generation-Request-Id', requestId);

    const reader = stream.getReader();
    while (true) {
      let value: Uint8Array;
      try {
        const chunk = await reader.read();
        if (chunk.done) break;
        value = chunk.value;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!res.headersSent) {
          res.status(500).json({ error: message, code: 'generation_failed' });
        } else {
          res.write(`${JSON.stringify({ error: message, requestId })}\n`);
        }
        res.end();
        return;
      }
      if (value) res.write(value);
    }
    res.end();
  }

  @Post('notebooks/:id/generation-requests/:requestId/cancel')
  async cancelGeneration(
    @CurrentUser('id') userId: string,
    @Param('requestId') requestId: string,
  ) {
    await this.generationService.cancel(userId, requestId);
    return { success: true };
  }
}
