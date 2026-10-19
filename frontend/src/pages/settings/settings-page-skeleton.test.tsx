import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SUPPORTED_LANGUAGES } from "@/features/language/utils/languages";
import { THEMES } from "@/features/theme/utils/themes";
import { SettingsPageSkeleton } from "./settings-page-skeleton";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <a {...props}>{children}</a>
  ),
}));

describe("SettingsPageSkeleton", () => {
  afterEach(cleanup);

  it("renders desktop card grids matching scheme, theme, language, and trash item counts", () => {
    const { container } = render(<SettingsPageSkeleton />);

    const desktopContainer = container.querySelector(".hidden.sm\\:flex");
    expect(desktopContainer).not.toBeNull();

    const sections = desktopContainer?.querySelectorAll("main > section");
    expect(sections).toHaveLength(3);

    const desktopCards = desktopContainer?.querySelectorAll(".rounded-selector");
    expect(desktopCards).toHaveLength(3 + THEMES.length + SUPPORTED_LANGUAGES.length + 1);
  });

  it("renders mobile segmented controls, compact theme grid, and trash card", () => {
    const { container } = render(<SettingsPageSkeleton />);

    const mobileContainer = container.querySelector(".sm\\:hidden");
    expect(mobileContainer).not.toBeNull();

    const segmentedControls = mobileContainer?.querySelectorAll(".h-10.w-full.rounded-2xl");
    expect(segmentedControls).toHaveLength(2);

    const mobileThemeGrid = mobileContainer?.querySelector(".grid-cols-2");
    expect(mobileThemeGrid?.children).toHaveLength(THEMES.length);

    const mobileTrashCards = mobileContainer?.querySelectorAll(".rounded-selector");
    expect(mobileTrashCards).toHaveLength(1);
  });
});
