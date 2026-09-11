import "@/shared/i18n/i18n";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { afterEach, beforeEach, expect, it } from "vitest";
import { LanguageSelector } from "./language-selector";

afterEach(cleanup);

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

it("reflects English as the initial selection", () => {
  render(<LanguageSelector />);

  expect(screen.getByRole("radio", { name: "English" }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByRole("radio", { name: "Español" }).getAttribute("aria-checked")).toBe("false");
  expect(document.documentElement.lang).toBe("en");
});

it("switches to Español and reflects the selected state", async () => {
  const user = userEvent.setup();
  render(<LanguageSelector />);

  await user.click(screen.getByRole("radio", { name: "Español" }));

  await waitFor(() => {
    expect(document.documentElement.lang).toBe("es");
    expect(screen.getByRole("radio", { name: "Español" }).getAttribute("aria-checked")).toBe(
      "true",
    );
  });
  expect(screen.getByRole("radio", { name: "English" }).getAttribute("aria-checked")).toBe(
    "false",
  );
});
