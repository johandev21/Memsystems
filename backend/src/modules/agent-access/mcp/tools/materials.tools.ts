import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { studyMaterialKindSchema } from '../../../../common/dto/shared-schemas';
import type { StudyMaterialKind } from '../../../study-materials/content/shapes';
import { generateRequestSchema } from '../../../study-materials/dto/generate-study-material.dto';
import type { StartGenerationInput } from '../../../study-materials/generation/generation-request-manager';
import type { McpToolContext } from '../mcp-context';
import {
  assertNotebookAccess,
  errorMessageOf,
  notifyProgress,
  progressTokenOf,
  registerAgentTool,
  textResult,
} from '../tool-helpers';

/** Minimum delay between two generation progress notifications. */
export const GENERATION_PROGRESS_INTERVAL_MS = 1_500;

/** Minimum number of content frames between two progress notifications. */
export const GENERATION_PROGRESS_FRAME_INTERVAL = 20;

/** Maximum filename base length used by `export_study_material`. */
export const MAX_EXPORT_FILENAME_LENGTH = 80;

/** Terminal frame emitted by the Generation NDJSON stream. */
export interface GenerationDoneFrame {
  done: true;
  requestId: string;
  materialId: string;
  grounding: {
    droppedBlocks: number;
    truncatedSourceIds: string[];
  };
}

/**
 * Thrown when the Generation stream closes before the terminal `done` frame.
 * Callers use it to tell a cancelled Generation apart from a failed one.
 */
export class GenerationStreamEndedError extends Error {
  constructor(
    message = 'The generation stream ended before the study material was saved.',
  ) {
    super(message);
    this.name = 'GenerationStreamEndedError';
  }
}

const materialSummarySchema = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  folderId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const groundingSchema = z.object({
  droppedBlocks: z.number(),
  truncatedSourceIds: z.array(z.string()),
});

interface MaterialRowLike {
  id: string;
  notebookId: string;
  kind: string;
  title: string;
  folderId: string | null;
  content: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const KIND_LABELS: Record<StudyMaterialKind, string> = {
  quiz: 'quiz',
  simple_flashcard: 'flashcards',
  roadmap: 'roadmap',
  mind_map: 'mind map',
  slides: 'slides',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function arrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Turns one terminal NDJSON frame into a typed payload. Content frames return
 * `null` so the consumer can keep counting them for progress reporting.
 */
function toDoneFrame(value: unknown): GenerationDoneFrame | null {
  if (!isRecord(value) || value.done !== true) {
    return null;
  }

  const materialId =
    typeof value.materialId === 'string' ? value.materialId : '';
  if (materialId.length === 0) {
    throw new Error(
      'The generation stream finished without a study material id. Retry the generation.',
    );
  }

  const grounding = isRecord(value.grounding) ? value.grounding : {};
  const truncatedSourceIds = Array.isArray(grounding.truncatedSourceIds)
    ? grounding.truncatedSourceIds.filter(
        (entry): entry is string => typeof entry === 'string',
      )
    : [];

  return {
    done: true,
    requestId: typeof value.requestId === 'string' ? value.requestId : '',
    materialId,
    grounding: {
      droppedBlocks:
        typeof grounding.droppedBlocks === 'number'
          ? grounding.droppedBlocks
          : 0,
      truncatedSourceIds,
    },
  };
}

/**
 * Consumes the Generation NDJSON stream. Partial content frames are raw content
 * objects without a wrapper, so unparseable lines are ignored; the terminal
 * frame is `{ done: true, requestId, materialId, grounding }`.
 *
 * `onFrame` receives a 1-based counter for every content frame, which callers
 * use for throttled progress notifications.
 */
export async function consumeGenerationStream(
  stream: ReadableStream<Uint8Array>,
  options: {
    onFrame?: (frameIndex: number) => void | Promise<void>;
  } = {},
): Promise<GenerationDoneFrame> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let frameIndex = 0;
  let doneFrame: GenerationDoneFrame | null = null;

  const handleLine = async (
    line: string,
  ): Promise<GenerationDoneFrame | null> => {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      // Partial content frames are expected while the model streams.
      return null;
    }

    const done = toDoneFrame(parsed);
    if (done) {
      return done;
    }

    frameIndex += 1;
    await options.onFrame?.(frameIndex);
    return null;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        const frame = await handleLine(line);
        if (frame) {
          doneFrame = frame;
        }
        newlineIndex = buffer.indexOf('\n');
      }
    }

    buffer += decoder.decode();
    const tail = await handleLine(buffer);
    if (tail) {
      doneFrame = tail;
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw new Error(
      `Study material generation failed: ${errorMessageOf(error)}`,
    );
  } finally {
    reader.releaseLock();
  }

  if (!doneFrame) {
    throw new GenerationStreamEndedError();
  }

  return doneFrame;
}

/**
 * Builds the short human summary returned by `generate_study_material` and
 * `get_study_material`, deriving counts from the stored content.
 */
export function summarizeMaterial(
  kind: string,
  title: string,
  content: unknown,
): string {
  const record = isRecord(content) ? content : {};
  switch (kind) {
    case 'quiz':
      return `Quiz "${title}" with ${plural(
        arrayLength(record.questions),
        'question',
        'questions',
      )}`;
    case 'simple_flashcard':
      return `Flashcards "${title}" with ${plural(
        arrayLength(record.cards),
        'card',
        'cards',
      )}`;
    case 'roadmap': {
      const phases: unknown[] = Array.isArray(record.phases)
        ? (record.phases as unknown[])
        : [];
      const topics = phases.reduce<number>(
        (total, phase) =>
          total + (isRecord(phase) ? arrayLength(phase.topics) : 0),
        0,
      );
      return `Roadmap "${title}" with ${plural(
        phases.length,
        'phase',
        'phases',
      )} and ${plural(topics, 'topic', 'topics')}`;
    }
    case 'mind_map':
      return `Mind map "${title}" with ${plural(
        arrayLength(record.nodes),
        'node',
        'nodes',
      )}`;
    case 'slides':
      return `Deck "${title}" with ${plural(
        arrayLength(record.slides),
        'slide',
        'slides',
      )}`;
    default:
      return `Study material "${title}"`;
  }
}

/**
 * Produces a download-safe filename: path separators, control characters, and
 * Windows-reserved characters are removed, and the base is capped in length.
 */
export function sanitizeExportFilename(
  title: string,
  extension: string,
): string {
  const cleaned = title
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, ' ')
    .replace(/\.{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
    .slice(0, MAX_EXPORT_FILENAME_LENGTH)
    .trim();
  const base = cleaned.length > 0 ? cleaned : 'study-material';
  return `${base}.${extension}`;
}

function toMaterialSummary(material: MaterialRowLike) {
  return {
    id: material.id,
    kind: material.kind,
    title: material.title,
    folderId: material.folderId ?? null,
    createdAt: material.createdAt.toISOString(),
    updatedAt: material.updatedAt.toISOString(),
  };
}

function materialLines(
  materials: ReturnType<typeof toMaterialSummary>[],
): string {
  if (materials.length === 0) {
    return 'No study materials found.';
  }
  return materials
    .map(
      (material) => `- ${material.title} (${material.id}) — ${material.kind}`,
    )
    .join('\n');
}

export function registerMaterialTools(
  server: McpServer,
  ctx: McpToolContext,
): void {
  registerAgentTool(
    server,
    ctx,
    {
      name: 'list_study_materials',
      title: 'List study materials',
      description:
        'List the study materials in a notebook. Returns titles and ids only; use get_study_material to read one.',
      inputSchema: z.object({
        notebookId: z.string().trim().min(1),
        kind: studyMaterialKindSchema.optional(),
        folderId: z.string().trim().min(1).optional(),
      }),
      outputSchema: z.object({
        materials: z.array(materialSummarySchema),
      }),
      annotations: { readOnlyHint: true },
      readOnly: true,
      resolveNotebookId: (args) => args.notebookId,
    },
    async (args) => {
      const materials = await ctx.services.studyMaterials.list(
        args.notebookId,
        {
          kind: args.kind,
          folderId: args.folderId,
        },
      );
      const summaries = materials.map(toMaterialSummary);

      return textResult(
        `Found ${summaries.length} study material(s).\n${materialLines(summaries)}`,
        { materials: summaries },
      );
    },
  );

  registerAgentTool(
    server,
    ctx,
    {
      name: 'get_study_material',
      title: 'Get study material',
      description:
        'Get one study material with its full kind-specific content. Read the matching memsystems://schemas/{kind} resource to understand the content shape.',
      inputSchema: z.object({
        studyMaterialId: z.string().trim().min(1),
      }),
      outputSchema: z.object({
        id: z.string(),
        notebookId: z.string(),
        kind: z.string(),
        title: z.string(),
        folderId: z.string().nullable(),
        content: z.unknown(),
        createdAt: z.string(),
        updatedAt: z.string(),
      }),
      annotations: { readOnlyHint: true },
      readOnly: true,
    },
    async (args, _mcpCtx, audit) => {
      const material = await ctx.services.studyMaterials.get(
        args.studyMaterialId,
      );
      audit.notebookId = material.notebookId;
      await assertNotebookAccess(ctx, material.notebookId, 'read');

      return textResult(
        `${summarizeMaterial(material.kind, material.title, material.content)} (${material.id}).`,
        {
          id: material.id,
          notebookId: material.notebookId,
          kind: material.kind,
          title: material.title,
          folderId: material.folderId ?? null,
          content: material.content,
          createdAt: material.createdAt.toISOString(),
          updatedAt: material.updatedAt.toISOString(),
        },
      );
    },
  );

  registerAgentTool(
    server,
    ctx,
    {
      name: 'create_study_material',
      title: 'Create study material',
      description:
        'Create a study material from a hand-authored content object. The content must match the memsystems://schemas/{kind} resource for the chosen kind.',
      inputSchema: z.object({
        notebookId: z.string().trim().min(1),
        kind: studyMaterialKindSchema,
        title: z.string().trim().min(1).max(200),
        content: z.unknown(),
        folderId: z.string().trim().min(1).optional(),
      }),
      outputSchema: z.object({
        id: z.string(),
        notebookId: z.string(),
        kind: z.string(),
        title: z.string(),
        folderId: z.string().nullable(),
        createdAt: z.string(),
      }),
      annotations: { readOnlyHint: false },
      readOnly: false,
      resolveNotebookId: (args) => args.notebookId,
    },
    async (args) => {
      const material = await ctx.services.studyMaterials.create(
        args.notebookId,
        {
          kind: args.kind,
          title: args.title,
          content: args.content,
          folderId: args.folderId,
        },
      );

      return textResult(
        `Created ${summarizeMaterial(material.kind, material.title, material.content)} (${material.id}).`,
        {
          id: material.id,
          notebookId: material.notebookId,
          kind: material.kind,
          title: material.title,
          folderId: material.folderId ?? null,
          createdAt: material.createdAt.toISOString(),
        },
      );
    },
  );

  registerAgentTool(
    server,
    ctx,
    {
      name: 'update_study_material',
      title: 'Update study material',
      description:
        'Change the title or the content of an existing study material. Provide at least one of title or content.',
      inputSchema: z.object({
        studyMaterialId: z.string().trim().min(1),
        title: z.string().trim().min(1).max(200).optional(),
        content: z.unknown().optional(),
      }),
      outputSchema: z.object({
        id: z.string(),
        notebookId: z.string(),
        kind: z.string(),
        title: z.string(),
        folderId: z.string().nullable(),
        updatedAt: z.string(),
      }),
      annotations: { readOnlyHint: false },
      readOnly: false,
    },
    async (args, _mcpCtx, audit) => {
      if (args.title === undefined && args.content === undefined) {
        throw new Error(
          'Provide at least one of title or content to update the study material.',
        );
      }

      const existing = await ctx.services.studyMaterials.get(
        args.studyMaterialId,
      );
      audit.notebookId = existing.notebookId;
      await assertNotebookAccess(ctx, existing.notebookId, 'write');

      const material = await ctx.services.studyMaterials.update(
        args.studyMaterialId,
        { title: args.title, content: args.content },
      );

      return textResult(
        `Updated ${summarizeMaterial(material.kind, material.title, material.content)} (${material.id}).`,
        {
          id: material.id,
          notebookId: material.notebookId,
          kind: material.kind,
          title: material.title,
          folderId: material.folderId ?? null,
          updatedAt: material.updatedAt.toISOString(),
        },
      );
    },
  );

  registerAgentTool(
    server,
    ctx,
    {
      name: 'generate_study_material',
      title: 'Generate study material',
      description:
        'Generate one study material from a brief and the notebook sources. Streams progress internally and returns the new material id plus a short summary.',
      inputSchema: generateRequestSchema.extend({
        notebookId: z.string().trim().min(1),
      }),
      outputSchema: z.object({
        materialId: z.string(),
        requestId: z.string(),
        kind: z.string(),
        title: z.string(),
        summary: z.string(),
        grounding: groundingSchema,
      }),
      annotations: { readOnlyHint: false },
      readOnly: false,
      resolveNotebookId: (args) => args.notebookId,
    },
    async (args, mcpCtx) => {
      const { notebookId, ...rest } = args;
      const input: StartGenerationInput = {
        ...rest,
        brief: args.brief ?? '',
        sourceIds: args.sourceIds ?? [],
      };

      const { stream, requestId } = await ctx.services.generation.generate(
        notebookId,
        input,
        mcpCtx.mcpReq.signal,
      );

      const progressToken = progressTokenOf(mcpCtx);
      const kindLabel = KIND_LABELS[input.kind] ?? input.kind;
      let lastProgressAt = 0;
      let lastProgressFrame = 0;

      const reportProgress = async (frameIndex: number): Promise<void> => {
        const now = Date.now();
        const timeElapsed =
          now - lastProgressAt >= GENERATION_PROGRESS_INTERVAL_MS;
        const framesElapsed =
          frameIndex - lastProgressFrame >= GENERATION_PROGRESS_FRAME_INTERVAL;
        if (frameIndex !== 1 && !timeElapsed && !framesElapsed) {
          return;
        }

        lastProgressAt = now;
        lastProgressFrame = frameIndex;
        await notifyProgress(
          mcpCtx,
          progressToken,
          frameIndex,
          undefined,
          `Generating ${kindLabel}…`,
        );
      };

      let done: GenerationDoneFrame;
      try {
        done = await consumeGenerationStream(stream, {
          onFrame: reportProgress,
        });
      } catch (error) {
        if (mcpCtx.mcpReq.signal.aborted) {
          await ctx.services.generation
            .cancel(requestId)
            .catch(() => undefined);
          throw new Error('Generation cancelled.');
        }
        throw error;
      }

      const material = await ctx.services.studyMaterials.get(done.materialId);
      const summary = summarizeMaterial(
        material.kind,
        material.title,
        material.content,
      );

      const groundingNote =
        done.grounding.droppedBlocks > 0 ||
        done.grounding.truncatedSourceIds.length > 0
          ? `\nGrounding limits: dropped ${done.grounding.droppedBlocks} evidence block(s)` +
            (done.grounding.truncatedSourceIds.length > 0
              ? ` and truncated ${done.grounding.truncatedSourceIds.length} source excerpt(s).`
              : '.')
          : '';

      return textResult(
        `Generated ${summary}.\nMaterial id: ${material.id}${groundingNote}`,
        {
          materialId: material.id,
          requestId: done.requestId || requestId,
          kind: material.kind,
          title: material.title,
          summary,
          grounding: done.grounding,
        },
      );
    },
  );

  registerAgentTool(
    server,
    ctx,
    {
      name: 'export_study_material',
      title: 'Export study material',
      description:
        'Export one study material. Slides return a base64 PowerPoint file; every other kind returns its JSON content.',
      inputSchema: z.object({
        studyMaterialId: z.string().trim().min(1),
      }),
      outputSchema: z.object({
        format: z.enum(['pptx', 'json']),
        filename: z.string(),
        mimeType: z.string(),
        sizeBytes: z.number().optional(),
        contentBase64: z.string().optional(),
        content: z.unknown().optional(),
      }),
      annotations: { readOnlyHint: true },
      readOnly: true,
    },
    async (args, _mcpCtx, audit) => {
      const material = await ctx.services.studyMaterials.get(
        args.studyMaterialId,
      );
      audit.notebookId = material.notebookId;
      await assertNotebookAccess(ctx, material.notebookId, 'read');

      if (material.kind === 'slides') {
        const { title, buffer } =
          await ctx.services.studyMaterials.buildSlidesPptx(material.id);
        const filename = sanitizeExportFilename(title, 'pptx');

        return textResult(
          `Exported slides "${title}" as ${filename} (${buffer.length} bytes, base64).`,
          {
            format: 'pptx',
            filename,
            mimeType:
              'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            sizeBytes: buffer.length,
            contentBase64: buffer.toString('base64'),
          },
        );
      }

      const filename = sanitizeExportFilename(material.title, 'json');

      return textResult(
        `Exported ${material.kind} "${material.title}" as ${filename}.`,
        {
          format: 'json',
          filename,
          mimeType: 'application/json',
          content: material.content,
        },
      );
    },
  );
}
