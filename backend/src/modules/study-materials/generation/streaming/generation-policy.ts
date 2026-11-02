import { z } from 'zod';
import {
  AudioOverviewContent,
  MindMapContent,
  QuizContent,
  RoadmapContent,
  SimpleFlashcardContent,
  SlidesContent,
  StudyMaterialKind,
} from '../../content/shapes';
import type { StartGenerationInput as StreamInput } from '../generation-request-manager';
import type {
  QuizGenerationOptions,
  FlashcardGenerationOptions,
} from '../prompts';
import {
  freeUngroundedDirective,
  moderateSupplementDirective,
  GENERAL_KNOWLEDGE_SUPPLEMENT_FIELD,
  GENERAL_KNOWLEDGE_SUPPLEMENT_LABEL,
} from '../generation-supplement';
import { assertAudioOverviewScriptLength } from '../../content/shapes';
import { AudioScriptLengthError } from './stream-errors';
import { languageDirective } from '../../../../common/i18n/language';
import {
  formatGroundedSourceText,
  type GenerationGrounding,
} from '../generation-grounding';
import { getPromptTemplate } from '../prompts';

export function getContentSchema(kind: StudyMaterialKind): z.ZodTypeAny {
  const schemas: Record<StudyMaterialKind, z.ZodTypeAny> = {
    quiz: QuizContent,
    simple_flashcard: SimpleFlashcardContent,
    roadmap: RoadmapContent,
    mind_map: MindMapContent,
    slides: SlidesContent,
    audio_overview: z
      .object({
        title: z.string().min(1).max(200),
        sections: z
          .array(
            z.object({
              heading: z.string().min(1).max(200),
              turns: z
                .array(
                  z.object({
                    speaker: z.enum(['host', 'guest']),
                    text: z.string().min(1).max(30_000),
                  }),
                )
                .min(2),
            }),
          )
          .min(3)
          .max(30),
      })
      .refine(
        (content) => {
          const speakers = new Set(
            content.sections.flatMap((section) =>
              section.turns.map((turn) => turn.speaker),
            ),
          );
          return speakers.has('host') && speakers.has('guest');
        },
        { message: 'Audio Overview dialogue must include both speakers' },
      ),
  };
  return schemas[kind];
}

export function citationDirective(hasEvidence: boolean): string {
  if (!hasEvidence) return '';
  return `

CITATIONS:
- The source material labels each passage with an evidence key such as [Evidence R1].
- End every sentence that states something taken from the source material with that key in square brackets, exactly like [ref:R1].
- Use only keys that appear in the source material. Never invent a key, a display number, or a source, and never cite a passage you were not given.
- Questions, examples, and explanations you create are your own work; cite only the passages that support the facts they rest on.`;
}

export function groundingDirective(
  groundingMode: StreamInput['groundingMode'],
  hasEvidence: boolean,
): string {
  if (groundingMode === 'moderate') return moderateSupplementDirective();
  if (groundingMode === 'free' && !hasEvidence)
    return freeUngroundedDirective();
  return '';
}

export function fallbackSchemaHint(
  kind: StudyMaterialKind,
  groundingMode?: StreamInput['groundingMode'],
): string {
  const base = baseFallbackSchemaHint(kind);
  if (groundingMode !== 'moderate') return base;
  return (
    `${base} You may also include an optional ` +
    `"${GENERAL_KNOWLEDGE_SUPPLEMENT_FIELD}" string with general-knowledge context that goes beyond the sources, ` +
    `starting with the label "${GENERAL_KNOWLEDGE_SUPPLEMENT_LABEL}: ".`
  );
}

function baseFallbackSchemaHint(kind: StudyMaterialKind): string {
  switch (kind) {
    case 'quiz':
      return `{"title": string, "questions": [{"id", "prompt", "options": [{"id", "text", "explanation"}], "correctOptionId", "hint", "topic"}]}. Example: {"title": "Sample Quiz", "questions": [{"id": "q1", "prompt": "What is 2+2?", "options": [{"id": "q1-a", "text": "3", "explanation": "Too low."}, {"id": "q1-b", "text": "4", "explanation": "Correct."}], "correctOptionId": "q1-b", "hint": "", "topic": ""}]}`;
    case 'simple_flashcard':
      return `{"title": string, "cards": [{"front", "back"}]}. Example: {"title": "Sample Cards", "cards": [{"front": "Mitochondria", "back": "Powerhouse of the cell."}]}`;
    case 'roadmap':
      return `{"title", "description", "phases": [{"id", "title", "description", "color": "#rrggbb", "order": 0, "topics": [{"id", "title", "description", "estimatedMinutes": 0, "order": 0}]}]}. Example: {"title": "Sample Roadmap", "description": "", "phases": [{"id": "p1", "title": "Basics", "description": "", "color": "#64748b", "order": 0, "topics": [{"id": "p1-t1", "title": "Intro", "description": "", "estimatedMinutes": 30, "order": 0}]}]}`;
    case 'mind_map':
      return `{"title", "rootId", "nodes": [{"id", "label", "color": "#rrggbb", "position": {"x", "y"}}], "edges": [{"id", "sourceId", "targetId", "label", "directed"}]}. Example: {"title": "Sample Map", "rootId": "n1", "nodes": [{"id": "n1", "label": "Root", "color": "#64748b", "position": {"x": 0, "y": 0}}], "edges": []}`;
    case 'slides':
      return `{"schemaVersion": 2, "title", "design": {"background", "surface", "primary", "secondary", "text", "muted" hex colors}, "slides": [{"id", "role": "content", "title", "elements": []}]}. Example: {"schemaVersion": 2, "title": "Sample Deck", "design": {"background": "#0F172A", "surface": "#1E293B", "primary": "#38BDF8", "secondary": "#818CF8", "text": "#F8FAFC", "muted": "#94A3B8"}, "slides": [{"id": "s1", "role": "content", "title": "Intro", "elements": []}]}`;
    case 'audio_overview':
      return `{"title": "A concise title", "sections": [{"heading": "Opening", "turns": [{"speaker": "host", "text": "Ask a useful opening question."}, {"speaker": "guest", "text": "Orient the listener and introduce the topic."}]}, {"heading": "Main idea", "turns": [{"speaker": "host", "text": "Ask how the ideas connect."}, {"speaker": "guest", "text": "Explain and connect the ideas."}]}, {"heading": "Wrap-up", "turns": [{"speaker": "host", "text": "Ask for the central takeaway."}, {"speaker": "guest", "text": "Synthesize the learning."}]}]}`;
    default:
      return `A JSON object with a "title" string field. Example: {"title": "Sample"}`;
  }
}

export function buildOptions(
  input: StreamInput,
): Record<string, unknown> | null {
  switch (input.kind) {
    case 'quiz': {
      if (input.questionCount == null && input.difficulty == null) return null;
      const opts: QuizGenerationOptions = {
        questionCount: input.questionCount ?? 0,
        difficulty: input.difficulty ?? 'auto',
      };
      return opts as unknown as Record<string, unknown>;
    }
    case 'simple_flashcard': {
      if (input.questionCount == null && input.difficulty == null) return null;
      const opts: FlashcardGenerationOptions = {
        questionCount: input.questionCount ?? 0,
        difficulty: input.difficulty ?? 'auto',
      };
      return opts as unknown as Record<string, unknown>;
    }
    case 'roadmap': {
      if (input.roadmapOptions == null) return null;
      return input.roadmapOptions;
    }
    case 'mind_map': {
      if (input.mindMapOptions == null) return null;
      return input.mindMapOptions;
    }
    case 'slides': {
      if (input.slidesOptions == null) return null;
      return input.slidesOptions;
    }
    case 'audio_overview':
      return {
        kind: 'audio_overview',
        ...(input.audioOverviewOptions ?? {
          format: 'briefing',
          length: 'standard',
          audience: 'some_background',
        }),
        brief: input.brief,
        language: input.language ?? 'en',
        sourceIds: input.sourceIds ?? [],
      };
    default:
      return null;
  }
}

export function assertAudioLength(input: StreamInput, content: unknown): void {
  if (input.kind !== 'audio_overview') return;
  try {
    assertAudioOverviewScriptLength(
      content as z.infer<typeof AudioOverviewContent>,
      input.audioOverviewOptions?.length ?? 'standard',
    );
  } catch (error) {
    throw new AudioScriptLengthError(
      error instanceof Error
        ? error.message
        : 'Audio Overview length is invalid.',
    );
  }
}

export function normalizeAudioContent(
  kind: StudyMaterialKind,
  content: unknown,
): unknown {
  if (kind !== 'audio_overview' || !content || typeof content !== 'object')
    return content;
  const record = content as Record<string, unknown>;
  const sections = Array.isArray(record.sections)
    ? (record.sections as Array<Record<string, unknown>>)
    : [];
  return {
    ...record,
    sections: sections.map((section) => {
      const turns = Array.isArray(section.turns)
        ? (section.turns as Array<{ speaker: string; text: string }>)
        : undefined;
      return {
        ...section,
        ...(turns ? { text: turns.map((turn) => turn.text).join(' ') } : {}),
      };
    }),
    transcript: sections
      .map((section) =>
        Array.isArray(section.turns)
          ? (section.turns as Array<{ text: string }>)
              .map((turn) => turn.text)
              .join(' ')
          : typeof section.text === 'string'
            ? section.text
            : '',
      )
      .join('\n\n'),
    citations: [],
  };
}

export function buildGenerationPrompt(
  input: StreamInput,
  grounding: Pick<GenerationGrounding, 'sources' | 'evidence'>,
) {
  const promptTemplate = getPromptTemplate(input.kind);
  const hasEvidence = grounding.evidence.length > 0;
  const systemPrompt =
    promptTemplate.instructions +
    languageDirective(input.language) +
    citationDirective(hasEvidence) +
    groundingDirective(
      input.kind === 'audio_overview' ? 'strict' : input.groundingMode,
      hasEvidence,
    );
  const formatted = formatGroundedSourceText(grounding, {
    includeSourceId: false,
    kind: input.kind,
  });
  const userPrompt = promptTemplate.user(input.brief, formatted.text, {
    questionCount: input.questionCount,
    difficulty: input.difficulty,
    roadmapOptions: input.roadmapOptions,
    mindMapOptions: input.mindMapOptions,
    slidesOptions: input.slidesOptions,
    audioOverviewOptions: input.audioOverviewOptions,
  });
  return {
    systemPrompt,
    userPrompt,
    formatted,
    schema: getContentSchema(input.kind),
    options: buildOptions(input),
  };
}
