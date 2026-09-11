import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n/i18n";
import notebooksEn from "@/shared/i18n/locales/en/notebooks.json";
import { RecentNotebooksSection } from "./recent-notebooks-section";

const recentState = vi.hoisted(() => ({ isError: false, isRetrying: false }));
const onRetryLoad = vi.hoisted(() => vi.fn());

vi.mock("../hooks/use-recent-notebooks", () => ({
  useRecentNotebooks: () => ({
    notebooks: [],
    isLoading: false,
    isError: recentState.isError,
    isRetrying: recentState.isRetrying,
    onRetryLoad,
    isCreating: false,
    onCreate: vi.fn(),
    pagination: {
      hasNextPage: false,
      isFetchingNextPage: false,
      isFetchNextPageError: false,
      onRetry: vi.fn(),
      sentinelRef: { current: null },
    },
  }),
}));

// The notebooks namespace loads lazily; register the bundle directly so the
// first render cannot race the namespace fetch.
beforeAll(() => {
  i18n.addResourceBundle("en", "notebooks", notebooksEn, true, true);
});

afterEach(() => {
  cleanup();
  recentState.isError = false;
  recentState.isRetrying = false;
  onRetryLoad.mockClear();
});

it("shows a retryable error state instead of the empty state when the initial load fails", async () => {
  recentState.isError = true;
  const user = userEvent.setup();
  render(<RecentNotebooksSection />);

  expect(screen.getByText("Couldn't load notebooks")).toBeTruthy();
  expect(screen.queryByText("No notebooks yet")).toBeNull();

  await user.click(screen.getByRole("button", { name: "Retry" }));
  expect(onRetryLoad).toHaveBeenCalledOnce();
});

it("disables retry while refetching", () => {
  recentState.isError = true;
  recentState.isRetrying = true;
  render(<RecentNotebooksSection />);

  // While refetching the button swaps the icon for a Spinner, whose status
  // label joins the accessible name.
  const retry = screen.getByRole("button", { name: /retry/i }) as HTMLButtonElement;
  expect(retry.disabled).toBe(true);
});
