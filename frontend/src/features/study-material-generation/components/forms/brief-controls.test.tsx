import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { BriefChoiceField } from "./brief-choice-field";
import { BriefWizardHeader } from "./brief-wizard-header";

describe("shared brief controls", () => {
  it("changes the choice without submitting the containing form", () => {
    const submit = vi.fn((event) => event.preventDefault());
    function Form() {
      const [value, setValue] = useState("basic");
      return (
        <form onSubmit={submit}>
          <BriefChoiceField
            label="Detail Level"
            options={[
              { id: "basic", title: "Basic", desc: "Concise bullets" },
              { id: "detailed", title: "Detailed", desc: "Rich bullets" },
            ]}
            value={value}
            onChange={setValue}
          />
        </form>
      );
    }
    render(<Form />);
    fireEvent.click(screen.getByRole("button", { name: "Detailed Rich bullets" }));
    expect(
      screen.getByRole("button", { name: "Detailed Rich bullets" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "Basic Concise bullets" }).getAttribute("aria-pressed"),
    ).toBe("false");
    expect(submit).not.toHaveBeenCalled();
  });

  it("lets the parent control step changes in both directions", () => {
    function Wizard() {
      const [step, setStep] = useState<1 | 2>(1);
      return <BriefWizardHeader title="Quiz Setup" step={step} onStepChange={setStep} />;
    }
    const { container } = render(<Wizard />);
    const bars = container.querySelectorAll(".grid > button, .grid > div");
    fireEvent.click(bars[1]);
    expect(screen.getByText("Step 2 of 2")).toBeTruthy();
    fireEvent.click(bars[0]);
    expect(screen.getByText("Step 1 of 2")).toBeTruthy();
  });
});
