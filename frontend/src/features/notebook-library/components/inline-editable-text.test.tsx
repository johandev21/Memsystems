import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n/i18n";
import notebooksEn from "@/shared/i18n/locales/en/notebooks.json";
import { InlineEditableText } from "./inline-editable-text";

// The notebooks namespace loads lazily; register the bundle directly so the
// first render cannot race the namespace fetch.
beforeAll(() => {
  i18n.addResourceBundle("en", "notebooks", notebooksEn, true, true);
});

function displayTitle(): HTMLElement {
  const title = document.querySelector<HTMLElement>("[data-library-title]");
  if (!title) throw new Error("title display not found");
  return title;
}

describe("InlineEditableText callbacks", () => {
  it("saves a changed value", () => {
    const onSave = vi.fn();
    render(<InlineEditableText value="Old" onSave={onSave} ariaLabel="title" editRequest={1} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "New" } });
    fireEvent.blur(input);
    expect(onSave).toHaveBeenCalledWith("New");
  });

  it("dismisses an unchanged edit without saving", () => {
    const onSave = vi.fn();
    const onDismiss = vi.fn();
    render(
      <InlineEditableText
        value="Old"
        onSave={onSave}
        onDismiss={onDismiss}
        ariaLabel="title"
        editRequest={1}
      />,
    );
    fireEvent.blur(screen.getByRole("textbox"));
    expect(onSave).not.toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalledWith("Old");
  });

  it("cancels on Escape without saving or dismissing", () => {
    const onSave = vi.fn();
    const onDismiss = vi.fn();
    const onCancel = vi.fn();
    render(
      <InlineEditableText
        value="Old"
        onSave={onSave}
        onDismiss={onDismiss}
        onCancel={onCancel}
        ariaLabel="title"
        editRequest={1}
      />,
    );
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(onSave).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("wraps the field in a sizer when autoSize is enabled", () => {
    render(
      <InlineEditableText
        value="Title"
        onSave={() => {}}
        ariaLabel="title"
        editRequest={1}
        autoSize
      />,
    );
    const sizer = document.querySelector(".library-inline-editable__sizer");
    expect(sizer).not.toBeNull();
    expect(sizer?.querySelector("span")?.textContent).toBe("Title");
  });

  it("keeps the plain title when the title fits", () => {
    render(
      <InlineEditableText value="Short" onSave={() => {}} ariaLabel="title" tooltip="Short" />,
    );
    expect(document.querySelector('[data-slot="tooltip-trigger"]')).toBeNull();
  });

  it("shows the full title in a tooltip when the title is truncated", () => {
    const { rerender } = render(
      <InlineEditableText value="Short" onSave={() => {}} ariaLabel="title" tooltip="Short" />,
    );
    const title = displayTitle();
    Object.defineProperty(title, "scrollWidth", { value: 200, configurable: true });
    Object.defineProperty(title, "clientWidth", { value: 100, configurable: true });
    rerender(
      <InlineEditableText value="Short!" onSave={() => {}} ariaLabel="title" tooltip="Short!" />,
    );
    expect(document.querySelector('[data-slot="tooltip-trigger"]')).not.toBeNull();
  });

  it("stops double-clicks in the editor from reaching the card", () => {
    const onCardDoubleClick = vi.fn();
    render(
      <div onDoubleClick={onCardDoubleClick}>
        <InlineEditableText value="Old" onSave={() => {}} ariaLabel="title" editRequest={1} />
      </div>,
    );
    fireEvent.doubleClick(screen.getByRole("textbox"));
    expect(onCardDoubleClick).not.toHaveBeenCalled();
  });

  it("lets double-clicks on the title reach the card", () => {
    const onCardDoubleClick = vi.fn();
    render(
      <div onDoubleClick={onCardDoubleClick}>
        <InlineEditableText value="Old" onSave={() => {}} ariaLabel="title" />
      </div>,
    );
    fireEvent.doubleClick(displayTitle());
    expect(onCardDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("does not start editing when the title is clicked", () => {
    render(<InlineEditableText value="Old" onSave={() => {}} ariaLabel="title" />);
    fireEvent.click(displayTitle());
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("starts editing only when the owner requests it", () => {
    const { rerender } = render(
      <InlineEditableText value="Old" onSave={() => {}} ariaLabel="notebook" editRequest={0} />,
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    rerender(
      <InlineEditableText value="Old" onSave={() => {}} ariaLabel="notebook" editRequest={1} />,
    );
    expect(screen.getByRole("textbox").getAttribute("aria-label")).toBe("Edit notebook");
  });

  it("reports editing state changes", () => {
    const onEditingChange = vi.fn();
    const { rerender } = render(
      <InlineEditableText
        value="Old"
        onSave={() => {}}
        ariaLabel="title"
        onEditingChange={onEditingChange}
      />,
    );
    rerender(
      <InlineEditableText
        value="Old"
        onSave={() => {}}
        ariaLabel="title"
        onEditingChange={onEditingChange}
        editRequest={1}
      />,
    );
    expect(onEditingChange).toHaveBeenLastCalledWith(true);
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(onEditingChange).toHaveBeenLastCalledWith(false);
  });
});
