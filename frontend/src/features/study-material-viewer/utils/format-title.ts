/**
 * Formats a title for display in study materials (Roadmaps, Slides).
 * Converts kebab-case titles (e.g. "life-and-key-milestones") to Title Case ("Life and Key Milestones").
 * Cleans roadmap-specific phase prefixes.
 */
export function formatDisplayTitle(title?: string): string {
  if (!title) return "";

  const clean = title.replace(/^Phase \d+:\s*/i, "").trim();

  // If string contains hyphens and no spaces, convert kebab-case to Title Case
  if (!/\s/.test(clean) && /-/.test(clean)) {
    const minorWords = new Set([
      "and",
      "or",
      "the",
      "in",
      "on",
      "at",
      "to",
      "for",
      "with",
      "of",
      "a",
      "an",
      "vs",
      "by",
      "from",
    ]);

    const words = clean.split("-").filter(Boolean);

    return words
      .map((word, idx) => {
        const lower = word.toLowerCase();
        if (idx > 0 && idx < words.length - 1 && minorWords.has(lower)) {
          return lower;
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(" ");
  }

  return clean;
}
