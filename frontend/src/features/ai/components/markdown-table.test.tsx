import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownTable } from "./markdown-table";

describe("MarkdownTable", () => {
  it("wraps content in a scrollable region", () => {
    render(
      <MarkdownTable>
        <thead>
          <tr>
            <th>ID</th>
          </tr>
        </thead>
      </MarkdownTable>,
    );

    const region = screen.getByRole("region", { name: "Scrollable table" });
    expect(region.classList.contains("markdown-table-wrapper")).toBe(true);
    expect(region.querySelector("table")).not.toBeNull();
  });

  it("keeps tables keyboard-focusable", () => {
    render(
      <MarkdownTable>
        <tbody>
          <tr>
            <td>cell</td>
          </tr>
        </tbody>
      </MarkdownTable>,
    );

    expect(screen.getByRole("region", { name: "Scrollable table" }).getAttribute("tabindex")).toBe(
      "0",
    );
  });
});
