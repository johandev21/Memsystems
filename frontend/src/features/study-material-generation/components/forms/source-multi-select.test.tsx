import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SourceMultiSelect } from "./source-multi-select";

function makeSource(id: string, title: string) {
  return {
    id,
    notebookId: "nb-1",
    kind: "text" as const,
    title,
    url: null,
    contentType: "text/plain",
    fileSize: null,
    folderId: null,
    createdAt: "2026-10-01T00:00:00.000Z",
  };
}

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), { status: 200 });
}

function Wrapper() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <QueryClientProvider client={queryClient}>
      <SourceMultiSelect notebookId="nb-1" value={selected} onChange={setSelected} />
      <output data-testid="selected-source-ids">{selected.join(",")}</output>
    </QueryClientProvider>
  );
}

describe("SourceMultiSelect", () => {
  const originalPointerEvent = window.PointerEvent;

  beforeEach(() => {
    if (!window.PointerEvent) {
      Object.defineProperty(window, "PointerEvent", {
        configurable: true,
        value: class extends MouseEvent {},
      });
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window, "PointerEvent", {
      configurable: true,
      value: originalPointerEvent,
    });
  });

  it("loads source pages on demand and keeps selected IDs while searching", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://localhost");
      const query = url.searchParams.get("q");
      const cursor = url.searchParams.get("cursor");
      if (query?.toLowerCase() === "beta" || cursor === "next") {
        return jsonResponse({ items: [makeSource("source-beta", "Beta notes")], nextCursor: null });
      }
      return jsonResponse({ items: [makeSource("source-alpha", "Alpha notes")], nextCursor: "next" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<Wrapper />);

    expect(await screen.findByText("Alpha notes")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByTestId("selected-source-ids").textContent).toBe("source-alpha");

    await user.click(screen.getByRole("button", { name: "Load more sources" }));
    expect(await screen.findByText("Beta notes")).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox", { name: "Search sources..." }), {
      target: { value: "Beta" },
    });
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input]) => String(input).includes("q=Beta"))).toBe(true);
    });
    expect(screen.getByTestId("selected-source-ids").textContent).toBe("source-alpha");
    expect(await screen.findByText("Beta notes")).toBeTruthy();
  });

  it("offers recovery when the first source page fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 500 }))
      .mockResolvedValueOnce(jsonResponse({ items: [makeSource("source-a", "Recovered source")], nextCursor: null }));
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<Wrapper />);

    expect(await screen.findByText("Failed to load sources")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Recovered source")).toBeTruthy();
  });
});
