import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "@/components/ui/checkbox";
import {
  generationSourceCheckboxClass,
  generationSourceIconClass,
  generationSourceOptionClass,
} from "./option-row";

describe("generationSourceOptionClass", () => {
  it("renders selected rows as solid primary (light-mode reference look)", () => {
    const classes = generationSourceOptionClass(true);
    expect(classes).toContain("bg-primary");
    expect(classes).toContain("text-primary-foreground");
  });

  it("renders unselected rows in tertiary text", () => {
    const classes = generationSourceOptionClass(false);
    expect(classes).toContain("text-text-tertiary");
    expect(classes).not.toContain("bg-primary");
  });
});

describe("generationSourceIconClass", () => {
  it("inverts the icon with the selected row", () => {
    expect(generationSourceIconClass(true)).toContain("text-primary-foreground");
    expect(generationSourceIconClass(false)).toContain("text-primary");
  });
});

describe("generationSourceCheckboxClass dark-mode contrast", () => {
  it("carries dark-mode counterparts for the inverted checked state", () => {
    const classes = generationSourceCheckboxClass(true);
    expect(classes).toContain("data-checked:bg-primary-foreground");
    expect(classes).toContain("dark:data-checked:bg-primary-foreground");
    expect(classes).toContain("dark:data-checked:text-primary");
  });

  it("drops the base Checkbox dark rule that would repaint the box with the row color", () => {
    // The base Checkbox ships `dark:data-checked:bg-primary`. On a solid
    // primary row that makes the checked box blend into the row in dark mode
    // (invisible box + invisible check). Matching the variant stack lets
    // tailwind-merge drop the base rule.
    render(
      <Checkbox
        checked
        onCheckedChange={vi.fn()}
        className="border-primary-foreground/40 data-checked:border-primary-foreground data-checked:bg-primary-foreground data-checked:text-primary dark:border-primary-foreground/60 dark:data-checked:border-primary-foreground dark:data-checked:bg-primary-foreground dark:data-checked:text-primary"
      />,
    );
    const box = document.querySelector('[data-slot="checkbox"]');
    expect(box).not.toBeNull();
    const className = box?.getAttribute("class") ?? "";
    expect(className).toContain("dark:data-checked:bg-primary-foreground");
    expect(className).not.toMatch(/(^|\s)dark:data-checked:bg-primary(\s|$)/);
  });

  it("emits no checkbox tone when unselected", () => {
    expect(generationSourceCheckboxClass(false)).toBe("");
  });
});
