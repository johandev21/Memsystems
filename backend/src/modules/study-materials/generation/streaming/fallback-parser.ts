import { parsePartialJson } from 'ai';
import { repairJsonText } from '../../content/content-normalizer';

export async function parseFallbackContent(
  cleanText: string,
  requestId: string,
): Promise<unknown> {
  let parsedContent: unknown;
  try {
    parsedContent = JSON.parse(cleanText);
  } catch (strictError) {
    const partialParsed = await parsePartialJson(cleanText).catch(() => null);
    if (
      partialParsed &&
      (partialParsed.state === 'successful-parse' ||
        partialParsed.state === 'repaired-parse')
    ) {
      parsedContent = partialParsed.value;
    } else {
      const repaired = repairJsonText(cleanText);
      try {
        parsedContent = JSON.parse(repaired);
      } catch {
        const repairedPartial = await parsePartialJson(repaired).catch(
          () => null,
        );
        if (
          repairedPartial &&
          (repairedPartial.state === 'successful-parse' ||
            repairedPartial.state === 'repaired-parse')
        ) {
          parsedContent = repairedPartial.value;
        } else {
          const reason =
            strictError instanceof Error
              ? strictError.message
              : String(strictError);
          const preview = cleanText.slice(0, 500);
          throw new SyntaxError(
            `Fallback JSON parse failed for ${requestId} (${reason}). Preview: ${preview}`,
          );
        }
      }
    }
  }

  return parsedContent;
}
