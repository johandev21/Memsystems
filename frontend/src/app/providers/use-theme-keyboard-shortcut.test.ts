import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTheme } from "next-themes";
import { useThemeKeyboardShortcut } from "./use-theme-keyboard-shortcut";

vi.mock("next-themes", () => ({
  useTheme: vi.fn(),
}));

describe("useThemeKeyboardShortcut", () => {
  const setTheme = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("toggles theme to dark when currently light and 'd' is pressed", () => {
    vi.mocked(useTheme).mockReturnValue({
      resolvedTheme: "light",
      setTheme,
    } as any);

    renderHook(() => useThemeKeyboardShortcut());

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "d",
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("toggles theme to light when currently dark and 'd' is pressed", () => {
    vi.mocked(useTheme).mockReturnValue({
      resolvedTheme: "dark",
      setTheme,
    } as any);

    renderHook(() => useThemeKeyboardShortcut());

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "D",
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(setTheme).toHaveBeenCalledWith("light");
  });

  it("does not toggle theme when modifier keys are pressed", () => {
    vi.mocked(useTheme).mockReturnValue({
      resolvedTheme: "light",
      setTheme,
    } as any);

    renderHook(() => useThemeKeyboardShortcut());

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "d",
        metaKey: true,
        bubbles: true,
      }),
    );
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "d",
        ctrlKey: true,
        bubbles: true,
      }),
    );

    expect(setTheme).not.toHaveBeenCalled();
  });

  it("does not toggle theme when typing inside an input element", () => {
    vi.mocked(useTheme).mockReturnValue({
      resolvedTheme: "light",
      setTheme,
    } as any);

    renderHook(() => useThemeKeyboardShortcut());

    const input = document.createElement("input");
    document.body.appendChild(input);

    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "d",
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(setTheme).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });
});
