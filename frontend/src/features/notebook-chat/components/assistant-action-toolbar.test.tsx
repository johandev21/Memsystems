import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AssistantVersionControls } from "./assistant-version-controls";
import { AssistantActionToolbar } from "./assistant-action-toolbar";

describe("AssistantVersionControls", () => {
  it("renders nothing when totalVersions <= 1", () => {
    const { container } = render(
      <AssistantVersionControls
        activeIndex={0}
        totalVersions={1}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders controls and handles navigation with mobile hitboxes", async () => {
    const user = userEvent.setup();
    const onPrevious = vi.fn();
    const onNext = vi.fn();

    render(
      <AssistantVersionControls
        activeIndex={1}
        totalVersions={3}
        onPrevious={onPrevious}
        onNext={onNext}
      />,
    );

    expect(screen.getByText("2 of 3")).toBeTruthy();

    const prevBtn = screen.getByRole("button", { name: "Previous version" });
    const nextBtn = screen.getByRole("button", { name: "Next version" });

    expect(prevBtn.className).toContain("min-h-11");
    expect(prevBtn.className).toContain("touch-manipulation");
    expect(prevBtn.className).toContain("active:scale-97");

    expect(nextBtn.className).toContain("min-h-11");
    expect(nextBtn.className).toContain("touch-manipulation");
    expect(nextBtn.className).toContain("active:scale-97");

    await user.click(prevBtn);
    expect(onPrevious).toHaveBeenCalledTimes(1);

    await user.click(nextBtn);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("disables boundary buttons correctly", () => {
    const { rerender } = render(
      <AssistantVersionControls
        activeIndex={0}
        totalVersions={2}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    expect((screen.getByRole("button", { name: "Previous version" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Next version" }) as HTMLButtonElement).disabled).toBe(false);

    rerender(
      <AssistantVersionControls
        activeIndex={1}
        totalVersions={2}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    expect((screen.getByRole("button", { name: "Previous version" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Next version" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("AssistantActionToolbar", () => {
  it("renders copy and regenerate buttons with touch targets", async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    const onRegenerate = vi.fn();

    render(
      <AssistantActionToolbar
        totalVersions={1}
        activeIndex={0}
        onPreviousVersion={vi.fn()}
        onNextVersion={vi.fn()}
        onCopy={onCopy}
        onRegenerate={onRegenerate}
        showRegenerate={true}
      />,
    );

    const copyBtn = screen.getByRole("button", { name: "Copy message" });
    const regenBtn = screen.getByRole("button", { name: "Regenerate response" });

    expect(copyBtn.className).toContain("min-h-11");
    expect(copyBtn.className).toContain("touch-manipulation");
    expect(copyBtn.className).toContain("active:scale-97");

    expect(regenBtn.className).toContain("min-h-11");
    expect(regenBtn.className).toContain("touch-manipulation");
    expect(regenBtn.className).toContain("active:scale-97");

    await user.click(copyBtn);
    expect(onCopy).toHaveBeenCalledTimes(1);

    await user.click(regenBtn);
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it("renders continue button when showContinue is true and handles click with mobile touch targets", async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();

    render(
      <AssistantActionToolbar
        totalVersions={1}
        activeIndex={0}
        onPreviousVersion={vi.fn()}
        onNextVersion={vi.fn()}
        onCopy={vi.fn()}
        onRegenerate={vi.fn()}
        showContinue={true}
        onContinue={onContinue}
      />,
    );

    const continueBtn = screen.getByRole("button", { name: "Continue" });
    expect(continueBtn.className).toContain("min-h-11");
    expect(continueBtn.className).toContain("touch-manipulation");
    expect(continueBtn.className).toContain("active:scale-97");

    await user.click(continueBtn);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("does not render continue button when showContinue is false or omitted", () => {
    render(
      <AssistantActionToolbar
        totalVersions={1}
        activeIndex={0}
        onPreviousVersion={vi.fn()}
        onNextVersion={vi.fn()}
        onCopy={vi.fn()}
        onRegenerate={vi.fn()}
        showContinue={false}
      />,
    );

    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
  });

  it("disables continue button while streaming", () => {
    render(
      <AssistantActionToolbar
        totalVersions={1}
        activeIndex={0}
        onPreviousVersion={vi.fn()}
        onNextVersion={vi.fn()}
        onCopy={vi.fn()}
        onRegenerate={vi.fn()}
        showContinue={true}
        isStreaming={true}
      />,
    );

    const continueBtn = screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;
    expect(continueBtn.disabled).toBe(true);
  });
});
