import { ResourceTemplate, type McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { StudyMaterialKind } from '../../study-materials/content/shapes';
import {
  MindMapContent,
  QuizContent,
  RoadmapContent,
  SimpleFlashcardContent,
  SlidesContent,
} from '../../study-materials/content/shapes';
import type { McpToolContext } from './mcp-context';
import { errorMessageOf } from './tool-helpers';

/** Kinds published as `memsystems://schemas/{kind}` resources. */
export const STUDY_MATERIAL_KINDS = [
  'quiz',
  'simple_flashcard',
  'roadmap',
  'mind_map',
  'slides',
] as const satisfies readonly StudyMaterialKind[];

interface ContentSchemaEntry {
  schema: z.ZodType;
  title: string;
}

const CONTENT_SCHEMAS: Record<StudyMaterialKind, ContentSchemaEntry> = {
  quiz: { schema: QuizContent, title: 'Quiz content' },
  simple_flashcard: {
    schema: SimpleFlashcardContent,
    title: 'Flashcards content',
  },
  roadmap: { schema: RoadmapContent, title: 'Roadmap content' },
  mind_map: { schema: MindMapContent, title: 'Mind map content' },
  slides: { schema: SlidesContent, title: 'Slides content' },
};

/**
 * Converts the Kind's Zod content schema into a draft 2020-12 JSON Schema. The
 * resource is generated from the runtime schema so it can never drift from the
 * content the app actually accepts.
 */
export function buildContentJsonSchema(
  kind: StudyMaterialKind,
): Record<string, unknown> {
  const entry = CONTENT_SCHEMAS[kind];
  try {
    return z.toJSONSchema(entry.schema, {
      target: 'draft-2020-12',
      io: 'output',
    });
  } catch (error) {
    throw new Error(
      `Could not publish the JSON Schema for the "${kind}" study material kind: ${errorMessageOf(error)}`,
    );
  }
}

function templateVariable(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

/**
 * Reads one study material for the `memsystems://study-materials/{id}`
 * resource, enforcing the Notebook's Agent Access level.
 */
export async function readStudyMaterialResource(
  ctx: McpToolContext,
  id: string,
): Promise<Record<string, unknown>> {
  const material = await ctx.services.studyMaterials.get(id);
  const access = await ctx.services.notebooks.getAgentAccess(
    material.notebookId,
  );
  if (access === 'off') {
    throw new Error('Agent access is off for this notebook.');
  }

  return {
    id: material.id,
    notebookId: material.notebookId,
    kind: material.kind,
    title: material.title,
    folderId: material.folderId ?? null,
    content: material.content,
    createdAt: material.createdAt.toISOString(),
    updatedAt: material.updatedAt.toISOString(),
  };
}

export function registerAgentResources(
  server: McpServer,
  ctx: McpToolContext,
): void {
  for (const kind of STUDY_MATERIAL_KINDS) {
    const entry = CONTENT_SCHEMAS[kind];
    server.registerResource(
      `schema_${kind}`,
      `memsystems://schemas/${kind}`,
      {
        title: entry.title,
        description: `JSON Schema (draft 2020-12) for the content of a ${kind} study material.`,
        mimeType: 'application/schema+json',
      },
      (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/schema+json',
            text: JSON.stringify(buildContentJsonSchema(kind), null, 2),
          },
        ],
      }),
    );
  }

  server.registerResource(
    'study_material',
    new ResourceTemplate('memsystems://study-materials/{id}', {
      list: undefined,
    }),
    {
      title: 'Study material',
      description:
        'One study material with its kind-specific content. Read the matching memsystems://schemas/{kind} resource to understand the content shape.',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      const id = templateVariable(variables.id);
      if (id.length === 0) {
        throw new Error(
          'The study material resource URI is missing a study material id.',
        );
      }

      const material = await readStudyMaterialResource(ctx, id);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(material, null, 2),
          },
        ],
      };
    },
  );
}
