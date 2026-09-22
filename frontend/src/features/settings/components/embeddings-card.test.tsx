import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n/i18n";
import settingsEn from "@/shared/i18n/locales/en/settings.json";
import { EmbeddingsCard } from "./embeddings-card";

const connection = vi.hoisted(() => ({
  hasKey: false,
  model: "voyage-context-4",
  dimensions: 1024,
}));
vi.mock("../api/embeddings", () => ({
  fetchVoyageConnection: () =>
    Promise.resolve({
      hasKey: connection.hasKey,
      model: connection.model,
      dimensions: connection.dimensions,
    }),
  reembedAllSources: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    isPending: false,
    data: {
      hasKey: connection.hasKey,
      model: connection.model,
      dimensions: connection.dimensions,
    },
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

// The settings namespace loads lazily; register the bundle directly so the
// first render cannot race the namespace fetch.
beforeAll(() => {
  i18n.addResourceBundle("en", "settings", settingsEn, true, true);
});

afterEach(cleanup);

describe("Embeddings card", () => {
  it("shows the not-connected badge without a key", () => {
    connection.hasKey = false;
    render(<EmbeddingsCard />);
    expect(screen.getByText("Not connected")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Embeddings" })).toBeTruthy();
    expect(screen.queryByText("Re-embed All Sources")).toBeNull();
  });

  it("shows the connected badge, model info, and re-embed action with a key", () => {
    connection.hasKey = true;
    render(<EmbeddingsCard />);
    expect(screen.getByText("Connected")).toBeTruthy();
    expect(screen.getByText("Model: voyage-context-4 · 1024 dimensions")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Re-embed All Sources" })).toBeTruthy();
  });
});
