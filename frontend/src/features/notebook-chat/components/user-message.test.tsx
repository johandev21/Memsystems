import type { UIMessage } from "@ai-sdk/react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n/i18n";
import { UserMessage } from "./user-message";

beforeAll(async () => {
  await i18n.loadNamespaces("chat");
});

function message(id: string, text: string): UIMessage {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

describe("UserMessage branch actions", () => {
  it("edits text while preserving visible files and sends only changed text", async () => {
    const user = userEvent.setup();
    const original: UIMessage = {
      id: "user-1",
      role: "user",
      parts: [
        { type: "file", mediaType: "image/png", url: "data:image/png;base64,abc", filename: "chart.png" },
        { type: "text", text: "Describe this chart" },
      ],
    };
    const onEdit = vi.fn();
    render(<UserMessage message={original} onEdit={onEdit} />);

    await user.click(screen.getByRole("button", { name: "Edit message" }));
    expect(screen.getByText("1 attachment(s) will stay with this message.")).toBeTruthy();
    const editor = screen.getByRole("textbox", { name: "Edit your message" });
    await user.clear(editor);
    await user.type(editor, "Explain the chart trend");
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(onEdit).toHaveBeenCalledWith(original, "Explain the chart trend");
  });

  it("does not create a branch when saved text is unchanged", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<UserMessage message={message("user-1", "Same text")} onEdit={onEdit} />);
    await user.click(screen.getByRole("button", { name: "Edit message" }));
    expect(screen.getByRole("button", { name: "Send" }).hasAttribute("disabled")).toBe(true);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("selects a sibling branch through the real navigation controls", async () => {
    const user = userEvent.setup();
    const first = message("user-1", "First version");
    const second = message("user-2", "Second version");
    const onSelectBranch = vi.fn();
    render(<UserMessage message={first} siblingMessages={[first, second]} onSelectBranch={onSelectBranch} />);
    await user.click(screen.getByRole("button", { name: "Next version" }));
    expect(onSelectBranch).toHaveBeenCalledWith("user-2");
  });
});
