import { BadRequestError } from '../../../common/errors/domain-error';
import type { GroundingMode } from '../../../database/schema';
import type { AiService } from '../../ai/ai.service';
import { stripCitationKeys } from '../history/chat-history';
import {
  groundingDirective,
  MESSAGE_LANGUAGE_INSTRUCTION,
} from '../grounding-directives';

export const SYSTEM_PROMPT = `You are a knowledgeable tutor and research assistant. Help the user master their topics of interest using the provided source passages or your general knowledge.

GROUNDING & CITATION RULES:
- If provided passages lack sufficient info, state this clearly and offer general knowledge.
- Prioritize source-backed claims. Clearly separate source-derived info from general knowledge.
- Never treat source availability as "permission" to answer; they are for evidence only.
- Cite source-backed claims with the evidence key shown in the passages, using exactly this syntax at the end of the supported sentence: [ref:R1].
- Emit citations as plain text only: never wrap them in backticks, code spans, or markdown links such as [1](#reference-R1).
- Use only evidence keys that were provided. Never invent a key, a display number, or put source titles inside citation markers.
- Do not discuss retrieval mechanics (e.g., source counts, indexing, loaded documents).

TUTORING & ENGAGEMENT:
- Deliver clear, well-structured, insightful explanations grounded in the sources.
- Never use emojis in responses.
- Foster active learning and retention: when explaining concepts, ask the learner to recall or explain key principles, or ask at most one focused reflective question at the end to check understanding.
- When an image or document is provided, thoroughly analyze its visual content, diagrams, or handwritten steps in connection with the user question.
- CRITICAL: Produce a single assistant response. Respond ONLY to the user. Do not simulate a multi-turn conversation or fabricate user labels (e.g., "User:", "Q:").`;

export function buildChatSystemPrompt({
  sourceContext,
  groundingMode,
  hasRetrievedChunks,
}: {
  sourceContext: string;
  groundingMode: GroundingMode;
  hasRetrievedChunks: boolean;
}): string {
  return (
    (hasRetrievedChunks
      ? `${SYSTEM_PROMPT}\n\n---\n\nRELEVANT SOURCE PASSAGES:\n\n${sourceContext}`
      : SYSTEM_PROMPT) +
    groundingDirective(groundingMode) +
    MESSAGE_LANGUAGE_INSTRUCTION
  );
}

export function validateAttachmentsAndCapabilities(
  parts: Record<string, unknown>[] | undefined,
  aiService: AiService,
  provider: Awaited<ReturnType<AiService['getProviderForModel']>>,
  modelId: string,
) {
  const submittedParts = parts ?? [];
  for (const part of submittedParts) {
    if (part.type === 'file') {
      if (!part.mediaType || typeof part.mediaType !== 'string') {
        throw new BadRequestError(
          'Invalid file attachment: mediaType is required',
          {
            messageKey: 'errors.chat.attachment.unsupported',
          },
        );
      }
    }
  }
  const hasImageInput = submittedParts.some(
    (part) =>
      part.type === 'file' &&
      typeof part.mediaType === 'string' &&
      part.mediaType.startsWith('image/'),
  );
  const hasFileInput = submittedParts.some(
    (part) =>
      part.type === 'file' &&
      typeof part.mediaType === 'string' &&
      !part.mediaType.startsWith('image/'),
  );
  if (hasImageInput) {
    aiService.requireCapability(
      provider,
      modelId,
      'imageInput',
      'image attachments',
    );
  }
  if (hasFileInput) {
    aiService.requireCapability(
      provider,
      modelId,
      'fileInput',
      'file attachments',
    );
  }
}

export function prepareLanguageModelMessages(
  history: Array<{
    role: string;
    content: string;
    parts?: unknown;
  }>,
) {
  return history.map((m) => {
    const parts =
      (m.parts as Array<{
        type: string;
        text?: string;
        mediaType?: string;
        url?: string;
        filename?: string;
      }>) || [];
    const hasFiles = parts.some((p) => p.type === 'file');

    if (m.role === 'user' && hasFiles) {
      const contentParts: Array<
        | { type: 'text'; text: string }
        | { type: 'image'; image: string }
        | { type: 'file'; data: string; mediaType: string; filename?: string }
      > = [];
      for (const p of parts) {
        if (p.type === 'text' && p.text) {
          contentParts.push({ type: 'text', text: p.text });
        } else if (
          p.type === 'file' &&
          p.url &&
          p.mediaType?.startsWith('image/')
        ) {
          contentParts.push({ type: 'image', image: p.url });
        } else if (
          p.type === 'file' &&
          p.url &&
          p.mediaType &&
          !p.mediaType.startsWith('image/')
        ) {
          contentParts.push({
            type: 'file',
            data: p.url,
            mediaType: p.mediaType,
            ...(p.filename ? { filename: p.filename } : {}),
          });
        }
      }
      if (!parts.some((p) => p.type === 'text') && m.content?.trim()) {
        contentParts.push({ type: 'text', text: m.content });
      }
      if (contentParts.length === 0) {
        contentParts.push({ type: 'text', text: m.content });
      }
      return {
        role: 'user' as const,
        content: contentParts,
      };
    }

    if (m.role === 'assistant') {
      return {
        role: 'assistant' as const,
        content: stripCitationKeys(m.content),
      };
    }

    return {
      role: 'user' as const,
      content: m.content,
    };
  });
}
