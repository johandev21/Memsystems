import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PaletteProvider } from "./palette-provider";
import { THEME_STORAGE_KEY, THEMES } from "./themes";
import { usePalette, usePaletteOptional } from "./use-palette";

function wrapper({ children }: { children: ReactNode }) {
  return <PaletteProvider>{children}</PaletteProvider>;
}

describe("usePalette and PaletteProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("defaults to 'default' theme with no data-theme attribute on html", () => {
    const { result } = renderHook(() => usePalette(), { wrapper });

    expect(result.current.theme).toBe("default");
    expect(result.current.themes).toEqual(THEMES);
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });

  it("initializes from localStorage if valid theme name is present", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "grove");

    const { result } = renderHook(() => usePalette(), { wrapper });

    expect(result.current.theme).toBe("grove");
    expect(document.documentElement.getAttribute("data-theme")).toBe("grove");
  });

  it("falls back to default if localStorage contains an invalid theme name", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "invalid-theme-xyz");

    const { result } = renderHook(() => usePalette(), { wrapper });

    expect(result.current.theme).toBe("default");
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });

  it("updates theme state, localStorage, and data-theme attribute on setTheme", () => {
    const { result } = renderHook(() => usePalette(), { wrapper });

    act(() => {
      result.current.setTheme("tide");
    });

    expect(result.current.theme).toBe("tide");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("tide");
    expect(document.documentElement.getAttribute("data-theme")).toBe("tide");

    act(() => {
      result.current.setTheme("plum");
    });

    expect(result.current.theme).toBe("plum");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("plum");
    expect(document.documentElement.getAttribute("data-theme")).toBe("plum");

    act(() => {
      result.current.setTheme("default");
    });

    expect(result.current.theme).toBe("default");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });

  it("throws error when usePalette is used outside of PaletteProvider", () => {
    expect(() => {
      renderHook(() => usePalette());
    }).toThrow("usePalette must be used within PaletteProvider");
  });

  it("returns null when usePaletteOptional is used outside of PaletteProvider", () => {
    const { result } = renderHook(() => usePaletteOptional());
    expect(result.current).toBeNull();
  });
});
