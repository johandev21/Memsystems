import { beforeEach, describe, expect, it } from "vitest";
import i18n from "@/shared/i18n/i18n";
import { resolveApiErrorMessage } from "./api-error";

describe("resolveApiErrorMessage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("translates a backend message key in English", () => {
    expect(
      resolveApiErrorMessage(
        {
          error: "errors.generation.problemCount",
          params: { min: 1, max: 30 },
        },
        "fallback",
      ),
    ).toBe("Problem count must be between 1 and 30.");
  });

  it("translates a backend message key in Spanish", async () => {
    await i18n.changeLanguage("es");

    expect(
      resolveApiErrorMessage(
        {
          error: "errors.generation.problemCount",
          params: { min: 1, max: 30 },
        },
        "fallback",
      ),
    ).toBe("La cantidad de problemas debe estar entre 1 y 30.");
  });

  it("passes through a plain message that is not a translation key", () => {
    expect(
      resolveApiErrorMessage({ error: "Legacy plain message" }, "fallback"),
    ).toBe("Legacy plain message");
  });

  it("falls back when the response carries no error", () => {
    expect(resolveApiErrorMessage({}, "fallback")).toBe("fallback");
  });
});
