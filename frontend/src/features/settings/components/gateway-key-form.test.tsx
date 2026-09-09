import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GatewayKeyForm } from "./gateway-key-form";
import { deleteGatewayKey, saveGatewayKey } from "../api/gateway";

vi.mock("../api/gateway", () => ({
  saveGatewayKey: vi.fn().mockResolvedValue(undefined),
  deleteGatewayKey: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderForm(hasKey = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GatewayKeyForm hasKey={hasKey} />
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("Gateway key actions", () => {
  it("focuses the input through its label and submits with Enter", async () => {
    const user = userEvent.setup();
    renderForm(false);
    await user.click(screen.getByText("Gateway API Key"));
    expect(document.activeElement).toBe(screen.getByLabelText("Gateway API Key"));
    await user.keyboard("keyboard-key{Enter}");
    await waitFor(() => expect(saveGatewayKey).toHaveBeenCalledWith("keyboard-key"));
  });

  it("reveals Save Key only when replacing the saved key and submits the new value", async () => {
    renderForm();
    expect(screen.queryByRole("button", { name: "Save Key" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    const save = screen.getByRole("button", { name: "Save Key" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Gateway API Key"), { target: { value: "new-key" } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() => expect(saveGatewayKey).toHaveBeenCalledWith("new-key"));
    await screen.findByRole("button", { name: "Saved" });
  });

  it("requires confirmation before removing the saved key", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(deleteGatewayKey).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm Remove" }));
    await waitFor(() => expect(deleteGatewayKey).toHaveBeenCalledOnce());
    await screen.findByRole("button", { name: "Save Key" });
  });

  it("allows retrying a failed save without losing the entered key", async () => {
    vi.mocked(saveGatewayKey).mockRejectedValueOnce(new Error("Invalid key"));
    renderForm(false);
    fireEvent.change(screen.getByLabelText("Gateway API Key"), { target: { value: "retry-key" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Key" }));
    await waitFor(() => {
      expect((screen.getByRole("button", { name: "Save Key" }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });
    expect((screen.getByLabelText("Gateway API Key") as HTMLInputElement).value).toBe("retry-key");
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  });
});
