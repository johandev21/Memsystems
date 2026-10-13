export function formatDisplayTitle(title?: string): string {
  if (!title) return "";

  const clean = title.replace(/^Phase \d+:\s*/i, "").trim();

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
