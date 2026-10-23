import { describe, expect, it } from "vitest";
import { sourceDisplayTitle } from "./source-display-title";

describe("sourceDisplayTitle", () => {
  it.each([
    ["Nietzsche.pdf", "Nietzsche"],
    ["Nietzsche.pptx", "Nietzsche"],
    ["Nietzsche.xlsx", "Nietzsche"],
    ["Nietzsche.notes.PDF", "Nietzsche.notes"],
    ["Nietzsche", "Nietzsche"],
    [".notes", ".notes"],
    ["Nietzsche.", "Nietzsche."],
  ])("displays file %s as %s without changing the stored title", (title, expected) => {
    const source = { kind: "file" as const, title };
    expect(sourceDisplayTitle(source)).toBe(expected);
    expect(source.title).toBe(title);
  });

  it.each(["text", "url"] as const)("keeps %s titles unchanged", (kind) => {
    expect(sourceDisplayTitle({ kind, title: "Nietzsche.pdf" })).toBe("Nietzsche.pdf");
  });
});
