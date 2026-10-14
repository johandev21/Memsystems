import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BannerCanvas, BannerEditToolbar } from "./banner-canvas";

describe("BannerEditToolbar", () => {
  it("scopes mobile touch sizes with max-sm to keep desktop icon buttons consistent", () => {
    render(
      <BannerEditToolbar
        visibleBannerUrl="https://example.com/banner.jpg"
        isSaving={false}
        onOpenImageDialog={vi.fn()}
        onRemoveBanner={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const removeBtn = screen.getByRole("button", { name: "Remove banner" });
    const cancelBtn = screen.getByRole("button", { name: "Cancel edits" });
    const changeBtn = screen.getByRole("button", { name: /change/i });
    const saveBtn = screen.getByRole("button", { name: "Save" });

    // Desktop: should NOT have unprefixed min-h-11/min-w-11 or desktop size overrides like sm:size-8
    expect(removeBtn.className).not.toMatch(/(^|\s)min-h-11(\s|$)/);
    expect(removeBtn.className).not.toMatch(/(^|\s)min-w-11(\s|$)/);
    expect(removeBtn.className).not.toMatch(/(^|\s)sm:size-8(\s|$)/);

    expect(cancelBtn.className).not.toMatch(/(^|\s)min-h-11(\s|$)/);
    expect(cancelBtn.className).not.toMatch(/(^|\s)min-w-11(\s|$)/);
    expect(cancelBtn.className).not.toMatch(/(^|\s)sm:size-8(\s|$)/);

    // Mobile: must scope 44px touch targets with max-sm:
    expect(removeBtn.className).toContain("max-sm:min-h-11");
    expect(removeBtn.className).toContain("max-sm:min-w-11");
    expect(cancelBtn.className).toContain("max-sm:min-h-11");
    expect(cancelBtn.className).toContain("max-sm:min-w-11");

    // Change and Save buttons must also preserve desktop height without sm:min-h-8
    expect(changeBtn.className).toContain("max-sm:min-h-11");
    expect(changeBtn.className).not.toMatch(/(^|\s)sm:min-h-8(\s|$)/);
    expect(saveBtn.className).toContain("max-sm:min-h-11");
    expect(saveBtn.className).not.toMatch(/(^|\s)sm:min-h-8(\s|$)/);

    // Icon buttons retain size-7 variant styling
    expect(removeBtn.className).toContain("size-7");
    expect(cancelBtn.className).toContain("size-7");
  });

  it("scopes mobile touch sizes with max-sm on the edit button when not editing", () => {
    render(
      <BannerCanvas
        containerRef={{ current: null }}
        isEditing={false}
        visibleBannerUrl={null}
        visibleFocalPoint={{ x: 0.5, y: 0.5 }}
        imageError={false}
        onImageError={vi.fn()}
        focalPointDrag={{
          containerRef: { current: null },
          handleMouseDown: vi.fn(),
          handleMouseMove: vi.fn(),
          stopDragging: vi.fn(),
          handleTouchStart: vi.fn(),
          handleTouchMove: vi.fn(),
          isDragging: false,
        }}
        onKeyDown={vi.fn()}
        isSaving={false}
        onOpenImageDialog={vi.fn()}
        onRemoveBanner={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onBeginEditing={vi.fn()}
        draftTitle="Title"
        onDraftTitleChange={vi.fn()}
        formattedDate="Oct 14, 2026"
        draftIcon="notebook"
        onDraftIconChange={vi.fn()}
        title="Title"
        isUntitled={false}
      />,
    );

    const editBtn = screen.getByRole("button", { name: "Edit notebook" });

    // Desktop: should NOT have unprefixed min-h-11/min-w-11 or desktop overrides like sm:size-8
    expect(editBtn.className).not.toMatch(/(^|\s)min-h-11(\s|$)/);
    expect(editBtn.className).not.toMatch(/(^|\s)min-w-11(\s|$)/);
    expect(editBtn.className).not.toMatch(/(^|\s)sm:size-8(\s|$)/);
    expect(editBtn.className).not.toMatch(/(^|\s)sm:min-h-8(\s|$)/);
    expect(editBtn.className).not.toMatch(/(^|\s)sm:min-w-8(\s|$)/);

    // Mobile: must scope 44px touch targets with max-sm:
    expect(editBtn.className).toContain("max-sm:min-h-11");
    expect(editBtn.className).toContain("max-sm:min-w-11");

    // Icon button retains size-7 variant styling
    expect(editBtn.className).toContain("size-7");
  });
});
