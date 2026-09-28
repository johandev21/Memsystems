import type { GroundingMode } from '../notebooks/grounding-mode';

/**
 * Instructs the model to answer in the user's own message language rather
 * than the interface language. The request `language` field is still accepted
 * for API compatibility, but only drives the deterministic no-evidence reply
 * localization (see `composeNoEvidenceReply`); the streamed answer follows
 * the latest user message instead.
 */
export const MESSAGE_LANGUAGE_INSTRUCTION =
  "\n\nRespond in the same language as the user's latest message.";

/**
 * Returns the per-mode instruction block appended to the system prompt, after
 * the Evidence block / base SYSTEM_PROMPT in `chat.service.ts`.
 */
export function groundingDirective(mode: GroundingMode): string {
  switch (mode) {
    case 'strict':
      return [
        '',
        '',
        'GROUNDING MODE: STRICT',
        '- Answer ONLY from the provided source passages above. Never use general knowledge, even to fill gaps.',
        '- If the passages partially cover the question, answer the covered part with [ref:Rn] citations and explicitly refuse the uncovered part: name what is not covered and state that the sources do not contain it.',
        '- If the passages do not cover the question at all, say so plainly instead of answering from general knowledge.',
      ].join('\n');
    case 'moderate':
      return [
        '',
        '',
        'GROUNDING MODE: MODERATE',
        '- Use the provided source passages where relevant and cite source-backed claims with [ref:Rn] citations.',
        "- You may complete the answer with general knowledge where the passages fall short, but clearly label general-knowledge sections: start each such section with a visible 'General knowledge:' label so source-backed and general content are never mixed without marking.",
      ].join('\n');
    case 'free':
      return [
        '',
        '',
        'GROUNDING MODE: FREE',
        '- If the question is about the provided sources, ground the answer in them and cite source-backed claims with [ref:Rn] citations.',
        '- Otherwise answer freely from general knowledge; do not force citations when the question is unrelated to the sources.',
      ].join('\n');
  }
}
