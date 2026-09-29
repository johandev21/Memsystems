import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n/i18n";
import { GroundingModePicker } from "./grounding-mode-picker";

describe("GroundingModePicker", () => {
  beforeEach(async () => {
    await i18n.loadNamespaces(["notebooks"]);
    await i18n.changeLanguage("en");
  });

  it("renders all three modes with the current one pressed", () => {
    render(<GroundingModePicker value="moderate" onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Strict" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(
      screen.getByRole("button", { name: "Moderate" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByRole("button", { name: "Free" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("emits the chosen mode", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<GroundingModePicker value="strict" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Free" }));
    expect(onChange).toHaveBeenCalledWith("free");
  });

  it("disables every option while saving", () => {
    render(<GroundingModePicker value="strict" onChange={vi.fn()} disabled />);

    for (const name of ["Strict", "Moderate", "Free"]) {
      expect(
        (screen.getByRole("button", { name }) as HTMLButtonElement).disabled,
      ).toBe(true);
    }
  });

  it("shows the one-line descriptions in the full variant", () => {
    render(<GroundingModePicker variant="full" value="strict" onChange={vi.fn()} />);

    expect(screen.getByText("Answers only from sources")).toBeTruthy();
    expect(screen.getByText("Sources first, then labeled general knowledge")).toBeTruthy();
    expect(
      screen.getByText("Answers freely, using sources only when relevant"),
    ).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Strict/ }).getAttribute("aria-checked")).toBe(
      "true",
    );
  });

  it("translates labels and descriptions to Spanish", async () => {
    await i18n.changeLanguage("es");
    await i18n.loadNamespaces(["notebooks"]);
    render(<GroundingModePicker variant="full" value="free" onChange={vi.fn()} />);

    expect(
      screen.getByRole("radiogroup", { name: "Modo de fundamentación" }),
    ).toBeTruthy();
    expect(screen.getByText("Responde solo desde las fuentes")).toBeTruthy();
    expect(
      screen.getByText("Responde libremente, usando las fuentes solo cuando son relevantes"),
    ).toBeTruthy();
  });
});
