import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { STUDY_MATERIAL_KINDS } from './resources';

const QUIZ_SCHEMA_URI = 'memsystems://schemas/quiz';

function userMessage(text: string) {
  return {
    messages: [
      {
        role: 'user' as const,
        content: { type: 'text' as const, text },
      },
    ],
  };
}

function generateQuizPrompt(args: {
  notebookId: string;
  topic?: string;
  questionCount?: number;
}): string {
  const lines = [
    `Generate a quiz for notebook ${args.notebookId}.`,
    '',
    `1. Read the ${QUIZ_SCHEMA_URI} resource to see the exact quiz content shape the app expects.`,
    '2. Call the generate_study_material tool with:',
    `   - notebookId: ${args.notebookId}`,
    "   - kind: 'quiz'",
  ];

  if (args.topic && args.topic.trim().length > 0) {
    lines.push(`   - brief: a short brief about "${args.topic.trim()}"`);
  } else {
    lines.push(
      '   - brief: a short brief describing the quiz you want, based on the notebook sources',
    );
  }

  if (args.questionCount !== undefined) {
    lines.push(`   - questionCount: ${args.questionCount}`);
  }

  lines.push(
    '',
    '3. The tool returns the new study material id and a short summary. Report that id and summary to the user.',
    '4. If the result is not what the user asked for, call update_study_material with the returned id and corrected content.',
  );

  return lines.join('\n');
}

function authorQuizPrompt(args: {
  notebookId: string;
  topic?: string;
}): string {
  const topicLine =
    args.topic && args.topic.trim().length > 0
      ? `The quiz is about "${args.topic.trim()}".`
      : 'Choose the quiz topic from the notebook sources.';

  return [
    `Author a quiz by hand for notebook ${args.notebookId}.`,
    topicLine,
    '',
    `1. Read the ${QUIZ_SCHEMA_URI} resource and follow it exactly.`,
    '2. Build a quiz content object that satisfies that schema: a title and a questions array.',
    '3. Give every question and option a stable, unique id (for example q1, q1-a, q1-b) and set correctOptionId to the id of exactly one option per question.',
    '4. Call the create_study_material tool with:',
    `   - notebookId: ${args.notebookId}`,
    "   - kind: 'quiz'",
    '   - title: a short title for the quiz',
    '   - content: the quiz content object',
    '',
    '5. Report the returned study material id to the user.',
  ].join('\n');
}

function studyFromSourcesPrompt(args: { notebookId: string }): string {
  return [
    `Help me study the sources in notebook ${args.notebookId}.`,
    '',
    `1. Call the list_sources tool with notebookId ${args.notebookId}.`,
    '2. If any source is still processing, call wait_for_sources with those source ids before generating anything.',
    `3. Decide which study material kind fits the request. The available kinds are: ${STUDY_MATERIAL_KINDS.join(', ')}. If the request is unclear, ask the user which kind they want.`,
    '4. Call the generate_study_material tool with the notebook id, the chosen kind, a brief, and the source ids you want to ground it in.',
    '5. The tool returns the new study material id and a summary. Call get_study_material with that id and summarize the result for the user.',
    '',
    'Read the matching memsystems://schemas/{kind} resource when you need the exact content shape for a kind.',
  ].join('\n');
}

export function registerAgentPrompts(server: McpServer): void {
  server.registerPrompt(
    'generate_quiz',
    {
      title: 'Generate a quiz',
      description:
        'Generate a quiz for a notebook with the generate_study_material tool.',
      argsSchema: z.object({
        notebookId: z.string().trim().min(1),
        topic: z.string().trim().min(1).max(500).optional(),
        questionCount: z.number().int().min(1).max(50).optional(),
      }),
    },
    (args) => userMessage(generateQuizPrompt(args)),
  );

  server.registerPrompt(
    'author_quiz',
    {
      title: 'Author a quiz by hand',
      description:
        'Write a quiz content object that matches the quiz JSON Schema and save it with create_study_material.',
      argsSchema: z.object({
        notebookId: z.string().trim().min(1),
        topic: z.string().trim().min(1).max(500).optional(),
      }),
    },
    (args) => userMessage(authorQuizPrompt(args)),
  );

  server.registerPrompt(
    'study_from_sources',
    {
      title: 'Study from sources',
      description:
        'Walk through listing sources, waiting for processing, generating a study material, and summarizing it.',
      argsSchema: z.object({
        notebookId: z.string().trim().min(1),
      }),
    },
    (args) => userMessage(studyFromSourcesPrompt(args)),
  );
}
