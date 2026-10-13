import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ModelOption } from "../types/model.types";
import { MobileModelSelectorDrawer } from "./mobile-model-selector-drawer";

const mockGroups: Record<string, ModelOption[]> = {
  openai: [
    {
      id: "openai/gpt-5.6-luna",
      displayName: "GPT-5.6 Luna",
    },
    {
      id: "openai/gpt-5-mini",
      displayName: "GPT-5 Mini",
    },
  ],
  anthropic: [
    {
      id: "anthropic/claude-opus-5.5",
      displayName: "Claude Opus 5.5",
    },
  ],
};

describe("MobileModelSelectorDrawer", () => {
  it("renders drawer with title, search input, and grouped models", async () => {
    render(
      <MobileModelSelectorDrawer
        open={true}
        onOpenChange={vi.fn()}
        groups={mockGroups}
        selectedModel="openai/gpt-5.6-luna"
        onSelect={vi.fn()}
        title="Select Model"
      />,
    );

    expect(screen.getByRole("heading", { name: "Select Model" })).toBeTruthy();
    expect(screen.getByRole("searchbox", { name: "Search models..." })).toBeTruthy();
    expect(screen.getByRole("option", { name: /GPT-5.6 Luna/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Claude Opus 5.5/ })).toBeTruthy();
    expect(screen.getByText("OpenAI")).toBeTruthy();
    expect(screen.getByText("Anthropic")).toBeTruthy();
  });

  it("marks the selected model with aria-selected='true'", async () => {
    render(
      <MobileModelSelectorDrawer
        open={true}
        onOpenChange={vi.fn()}
        groups={mockGroups}
        selectedModel="openai/gpt-5.6-luna"
        onSelect={vi.fn()}
      />,
    );

    const selectedOption = screen.getByRole("option", { name: /GPT-5.6 Luna/ });
    expect(selectedOption.getAttribute("aria-selected")).toBe("true");

    const unselectedOption = screen.getByRole("option", { name: /Claude Opus 5.5/ });
    expect(unselectedOption.getAttribute("aria-selected")).toBe("false");
  });

  it("calls onSelect and closes the drawer when an option is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <MobileModelSelectorDrawer
        open={true}
        onOpenChange={onOpenChange}
        groups={mockGroups}
        selectedModel="openai/gpt-5.6-luna"
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole("option", { name: /Claude Opus 5.5/ }));
    expect(onSelect).toHaveBeenCalledWith("anthropic/claude-opus-5.5");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("filters models dynamically and allows clearing search", async () => {
    const user = userEvent.setup();

    render(
      <MobileModelSelectorDrawer
        open={true}
        onOpenChange={vi.fn()}
        groups={mockGroups}
        selectedModel="openai/gpt-5.6-luna"
        onSelect={vi.fn()}
      />,
    );

    const searchInput = screen.getByRole("searchbox", { name: "Search models..." });
    await user.type(searchInput, "opus");

    expect(screen.getByRole("option", { name: /Claude Opus 5.5/ })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /GPT-5.6 Luna/ })).toBeNull();

    // Clear search with clear button
    const clearButton = screen.getByRole("button", { name: "Clear search" });
    await user.click(clearButton);

    expect(screen.getByRole("option", { name: /GPT-5.6 Luna/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Claude Opus 5.5/ })).toBeTruthy();
  });

  it("shows empty state when search finds no results", async () => {
    const user = userEvent.setup();

    render(
      <MobileModelSelectorDrawer
        open={true}
        onOpenChange={vi.fn()}
        groups={mockGroups}
        selectedModel="openai/gpt-5.6-luna"
        onSelect={vi.fn()}
      />,
    );

    const searchInput = screen.getByRole("searchbox", { name: "Search models..." });
    await user.type(searchInput, "nonexistent model xyz");

    expect(screen.getByText("No models found")).toBeTruthy();
    expect(screen.queryByRole("option")).toBeNull();
  });

  it("renders company provider labels in Title Case and never uppercase", () => {
    const alibabaGroups: Record<string, ModelOption[]> = {
      alibaba: [
        { id: "alibaba/qwen-3", displayName: "Qwen3-14B" },
      ],
    };

    render(
      <MobileModelSelectorDrawer
        open={true}
        onOpenChange={vi.fn()}
        groups={alibabaGroups}
        selectedModel="alibaba/qwen-3"
        onSelect={vi.fn()}
      />,
    );

    const alibabaHeader = screen.getByText("Alibaba");
    expect(alibabaHeader).toBeTruthy();
    expect(alibabaHeader.textContent).toBe("Alibaba");
    expect(screen.queryByText("ALIBABA")).toBeNull();
    expect(alibabaHeader.className).not.toContain("uppercase");
  });
});
