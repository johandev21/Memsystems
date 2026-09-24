import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n/i18n";
import { CountSelector } from "./count-selector";

const BASE_PROPS = {
  label: "Number of Questions",
  presets: [5, 10, 15, 20],
  max: 50,
  customDefault: 25,
  customAriaLabel: "Custom count",
};

function StatefulCountSelector({ onChange }: { onChange: (value: number) => void }) {
  const [value, setValue] = useState(10);
  return (
    <CountSelector
      {...BASE_PROPS}
      summary={value === 0 ? "Auto (AI decides)" : `${value} Questions`}
      value={value}
      onValueChange={(next) => {
        onChange(next);
        setValue(next);
      }}
    />
  );
}

describe("CountSelector", () => {
  beforeEach(async () => {
    // The namespace loads lazily; without it the labels render as raw keys.
    await i18n.loadNamespaces(["generation"]);
    await i18n.changeLanguage("en");
  });

  it("calls onValueChange(0) from Auto and presses it only when the value is 0", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(
      <CountSelector {...BASE_PROPS} summary="10 Questions" value={10} onValueChange={onValueChange} />,
    );

    const auto = screen.getByRole("button", { name: "Auto" });
    expect(auto.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "10" }).getAttribute("aria-pressed")).toBe("true");

    await user.click(auto);
    expect(onValueChange).toHaveBeenCalledWith(0);

    rerender(
      <CountSelector
        {...BASE_PROPS}
        summary="Auto (AI decides)"
        value={0}
        onValueChange={onValueChange}
      />,
    );
    expect(screen.getByRole("button", { name: "Auto" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "10" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("calls onValueChange with the clicked preset", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <CountSelector {...BASE_PROPS} summary="10 Questions" value={10} onValueChange={onValueChange} />,
    );

    await user.click(screen.getByRole("button", { name: "15" }));
    expect(onValueChange).toHaveBeenCalledWith(15);
  });

  it("reveals a custom input that clamps to the max and restores the default when cleared", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<StatefulCountSelector onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Custom" }));
    expect(onChange).toHaveBeenCalledWith(25);
    const input = screen.getByLabelText("Custom count") as HTMLInputElement;
    expect(input.value).toBe("25");

    await user.clear(input);
    await user.type(input, "7");
    expect(onChange).toHaveBeenLastCalledWith(7);

    await user.clear(input);
    await user.type(input, "999");
    expect(onChange).toHaveBeenLastCalledWith(50);

    await user.tab();
    expect(input.value).toBe("50");

    await user.clear(input);
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith(25);
    expect(input.value).toBe("25");
  });
});
