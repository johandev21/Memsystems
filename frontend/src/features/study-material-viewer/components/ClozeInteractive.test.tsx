import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ClozeInteractive } from "./ClozeInteractive";

describe("ClozeInteractive", () => {
  it("checks with Enter, shows the expected answer, and clears feedback when edited", async () => {
    const user = userEvent.setup();
    render(<ClozeInteractive front="The capital is ___." back="Paris" />);
    expect(
      (screen.getByRole("button", { name: "Check Answer" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    const input = screen.getByRole("textbox");
    await user.type(input, "London{Enter}");
    expect(screen.getByRole("status").textContent).toMatch(/incorrect/i);
    expect(screen.getByRole("status").textContent).toContain("Paris");
    await user.clear(input);
    expect(screen.queryByText(/incorrect/i)).toBeNull();
    await user.type(input, " paris {Enter}");
    expect(screen.getByRole("status").textContent).toMatch(/correct/i);
    expect(screen.getByRole("status").textContent).not.toMatch(/incorrect/i);
  });

  it("renders one inline input per blank and requires all blanks for an overall correct", async () => {
    const user = userEvent.setup();
    const onAnswerChecked = vi.fn();
    render(
      <ClozeInteractive
        front="___ is the capital of ___."
        back="Paris | France"
        onAnswerChecked={onAnswerChecked}
      />,
    );

    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(2);
    const check = screen.getByRole("button", { name: "Check Answer" });
    expect((check as HTMLButtonElement).disabled).toBe(true);

    // Partially filled -> still disabled (atomic check needs every blank).
    await user.type(inputs[0], "Paris");
    expect((check as HTMLButtonElement).disabled).toBe(true);

    await user.type(inputs[1], "Spain");
    expect((check as HTMLButtonElement).disabled).toBe(false);

    await user.click(check);
    expect(screen.getByRole("status").textContent).toMatch(/incorrect/i);
    expect(screen.getByRole("status").textContent).toContain("France");
    expect(onAnswerChecked).toHaveBeenLastCalledWith(false);

    // Editing any blank clears feedback.
    await user.clear(inputs[1]);
    expect(screen.queryByText(/incorrect/i)).toBeNull();

    await user.type(inputs[1], " france ");
    await user.click(screen.getByRole("button", { name: "Check Answer" }));
    expect(screen.getByRole("status").textContent).toMatch(/correct/i);
    expect(onAnswerChecked).toHaveBeenLastCalledWith(true);
  });

  it("supports three blanks split on semicolons with case-insensitive matching", async () => {
    const user = userEvent.setup();
    render(<ClozeInteractive front="___ , ___ and [blank] are colors." back="red; green; blue" />);

    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(3);

    await user.type(inputs[0], "RED");
    await user.type(inputs[1], " green ");
    await user.type(inputs[2], "Blue");
    await user.click(screen.getByRole("button", { name: "Check Answer" }));
    expect(screen.getByRole("status").textContent).toMatch(/correct/i);
  });

  it("treats blanks without a corresponding expected answer as accept-any", async () => {
    const user = userEvent.setup();
    render(<ClozeInteractive front="___ and ___ are capitals." back="Paris" />);

    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(2);

    await user.type(inputs[0], "Paris");
    await user.type(inputs[1], "Anything");
    await user.click(screen.getByRole("button", { name: "Check Answer" }));
    expect(screen.getByRole("status").textContent).toMatch(/correct/i);
  });
});
