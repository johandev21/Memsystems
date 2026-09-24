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
  // 0 means auto: the model chooses the count from the sources and the brief.
  questionCount: z.number().min(0).max(50).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard', 'auto']).optional(),
  cardStyle: z.enum(['qa', 'definition', 'cloze', 'mixed', 'auto']).optional(),
  roadmapOptions: z
    .object({
      phaseCount: z.number().min(0).max(50),
      detailLevel: z.enum(['basic', 'detailed', 'auto']),
    })
    .optional(),
  mindMapOptions: z
    .object({
      nodeCount: z.number().min(0).max(100),
      structure: z.enum(['radial', 'hierarchical', 'organic']),
      colorGroups: z.union([z.boolean(), z.literal('auto')]),
      crossLinks: z.boolean(),
      detailLevel: z.enum(['basic', 'detailed', 'auto']),
    })
    .optional(),
  studyGuideOptions: StudyGuideOptions.optional(),
  practiceProblemsOptions: PracticeProblemsOptions.optional(),
  caseStudyOptions: CaseStudyOptions.optional(),
  language: z.string().min(1).max(35).optional(),
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
        'auto',
      ]),
      detailLevel: z.enum(['basic', 'detailed', 'auto']),
    })
    .optional(),
});

@Controller()
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
    @Param('notebookId') notebookId: string,
    @Query('folderId') folderId?: string,
    @Query('kind') kind?: string,
  ) {
    return this.studyMaterialService.list(notebookId, {
      folderId,
      kind: kind as StudyMaterialKind | undefined,
    });
  }

  @Post('notebooks/:notebookId/study-materials')
  @UsePipes(new ZodValidationPipe(createStudyMaterialSchema))
  async createStudyMaterial(
    @Param('notebookId') notebookId: string,
    @Body() body: z.infer<typeof createStudyMaterialSchema>,
  ) {
    return this.studyMaterialService.create(notebookId, body);
  }

  @Get('study-materials/:id')
  async getStudyMaterial(@Param('id') id: string) {
    return this.studyMaterialService.get(id);
  }

  @Get('study-materials/:id/export')
  async exportSlides(@Param('id') id: string, @Res() res: Response) {
    const { title, buffer } =
      await this.studyMaterialService.buildSlidesPptx(id);
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
    @Param('id') id: string,
    @Body() body: z.infer<typeof updateStudyMaterialSchema>,
  ) {
    return this.studyMaterialService.update(id, body);
  }

  @Delete('study-materials/:id')
  async deleteStudyMaterial(@Param('id') id: string) {
    return this.studyMaterialService.delete(id);
  }

  @Post('study-materials/:id/restore')
  async restoreStudyMaterial(@Param('id') id: string) {
    return this.studyMaterialService.restore(id);
  }

  @Delete('study-materials/:id/permanent')
  async permanentDeleteStudyMaterial(@Param('id') id: string) {
    await this.studyMaterialService.permanentDelete(id);
    return { success: true };
  }

  @Post('study-materials/:id/shuffle')
  async shuffleQuiz(@Param('id') id: string) {
    return this.studyMaterialService.shuffle(id);
  }

  @Patch('study-materials/:id/move')
  @UsePipes(new ZodValidationPipe(moveStudyMaterialSchema))
  async moveStudyMaterial(
    @Param('id') id: string,
    @Body() body: z.infer<typeof moveStudyMaterialSchema>,
  ) {
    return this.studyMaterialService.move(id, body);
  }

  @Post('study-materials/:id/duplicate')
  async duplicateStudyMaterial(@Param('id') id: string) {
    return this.studyMaterialService.duplicate(id);
  }

  @Post('study-materials/:id/evaluate-problem')
  @UsePipes(new ZodValidationPipe(EvaluateProblemRequestSchema))
  async evaluateProblem(
    @Param('id') id: string,
    @Body() body: EvaluateProblemRequest,
  ) {
    return this.studyMaterialService.evaluatePracticeProblem(id, body);
  }

  // --- Folders ---
  @Get('notebooks/:notebookId/folders')
  async listFolders(@Param('notebookId') notebookId: string) {
    return this.folderService.list(notebookId);
  }

  @Post('notebooks/:notebookId/folders')
  @UsePipes(new ZodValidationPipe(createFolderSchema))
  async createFolder(
    @Param('notebookId') notebookId: string,
    @Body() body: z.infer<typeof createFolderSchema>,
  ) {
    return this.folderService.create(notebookId, body);
  }

  @Patch('folders/:id')
  @UsePipes(new ZodValidationPipe(updateFolderSchema))
  async updateFolder(
    @Param('id') id: string,
    @Body() body: z.infer<typeof updateFolderSchema>,
  ) {
    return this.folderService.update(id, body);
  }

  @Delete('folders/:id')
  async deleteFolder(@Param('id') id: string) {
    return this.folderService.delete(id);
  }

  @Post('folders/:id/restore')
  async restoreFolder(@Param('id') id: string) {
    return this.folderService.restore(id);
  }

  // --- Trash ---
  @Get('notebooks/:notebookId/trash')
  async listTrash(@Param('notebookId') notebookId: string) {
    return this.trashService.list(notebookId);
  }

  @Delete('trash/study-materials/:id')
  async hardDeleteTrashMaterial(@Param('id') id: string) {
    await this.trashService.hardDeleteStudyMaterial(id);
    return { success: true };
  }

  @Delete('trash/folders/:id')
  async hardDeleteTrashFolder(@Param('id') id: string) {
    await this.trashService.hardDeleteFolder(id);
    return { success: true };
  }

  // --- Generation ---
  @Post('notebooks/:id/generate')
  @UsePipes(new ZodValidationPipe(generateRequestSchema))
  async generate(
    @Param('id') notebookId: string,
    @Body() body: z.infer<typeof generateRequestSchema>,
    @Res() res: Response,
  ) {
    const generationController = new AbortController();
    const abortOnDisconnect = () => {
      if (!res.writableEnded && !generationController.signal.aborted) {
        generationController.abort();
      }
    };
    res.once('close', abortOnDisconnect);

    const { stream, requestId } = await this.generationService.generate(
      notebookId,
      body,
      generationController.signal,
    );

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Generation-Request-Id', requestId);
    // Resolve the client's fetch before the first NDJSON frame; otherwise the
    // client sits in "connecting" until the model produces output.
    res.flushHeaders();

    const reader = stream.getReader();
    // Terminal-frame contract: the client hangs until it sees a `{done: true}`
    // or `{error}` NDJSON frame (or the response ends). Track whether one was
    // sent and always emit a terminal signal before res.end().
    let terminalSent = false;
    const writeTerminalError = (message: string) => {
      if (terminalSent) return;
      terminalSent = true;
      if (!res.headersSent) {
        res
          .status(500)
          .json({ error: message, code: 'generation_failed', requestId });
      } else {
        res.write(`${JSON.stringify({ error: message, requestId })}\n`);
      }
    };
    try {
      while (true) {
        let chunk: ReadableStreamReadResult<Uint8Array>;
        try {
          chunk = await reader.read();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          writeTerminalError(message);
          return;
        }
        if (chunk.done) break;
        if (chunk.value) {
          // Detect a terminal frame so a clean close without one can be fixed.
          try {
            const text = Buffer.from(chunk.value).toString('utf8');
            for (const line of text.split('\n')) {
              const candidate = line.trim();
              if (!candidate) continue;
              try {
                const frame: unknown = JSON.parse(candidate);
                if (
                  frame &&
                  typeof frame === 'object' &&
                  ('done' in frame || 'error' in frame)
                ) {
                  terminalSent = true;
                }
              } catch {
                // Partial/progress line — not a terminal frame.
              }
            }
          } catch {
            // Detection must never break streaming.
          }
          res.write(chunk.value);
        }
      }
      if (!terminalSent) {
        writeTerminalError('Generation stream ended without a terminal frame.');
      }
    } finally {
      res.off('close', abortOnDisconnect);
      try {
        reader.releaseLock();
      } catch {
        // Ignore release errors on an already-errored stream.
      }
      if (!res.writableEnded) res.end();
    }
  }

  @Post('notebooks/:id/generation-requests/:requestId/cancel')
  async cancelGeneration(@Param('requestId') requestId: string) {
    await this.generationService.cancel(requestId);
    return { success: true };
  }
}
