import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useReasoningLifecycle } from "./use-reasoning-lifecycle";

describe("useReasoningLifecycle", () => {
  it("mounts open when already streaming", () => {
    const { result } = renderHook(() => useReasoningLifecycle({ isStreaming: true }));
    expect(result.current.isOpen).toBe(true);
  });

  it("keeps a user collapse while streaming (does not force re-open)", () => {
    const { result, rerender } = renderHook(() => useReasoningLifecycle({ isStreaming: true }));
    act(() => result.current.setIsOpen(false));
    rerender();
    expect(result.current.isOpen).toBe(false);
  });

  it("auto-opens once when streaming starts and still honors a later collapse", () => {
    const { result, rerender } = renderHook(
      ({ isStreaming }: { isStreaming: boolean }) => useReasoningLifecycle({ isStreaming }),
      { initialProps: { isStreaming: false } },
    );
    expect(result.current.isOpen).toBe(false);

    rerender({ isStreaming: true });
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.setIsOpen(false));
    rerender({ isStreaming: true });
    expect(result.current.isOpen).toBe(false);
  });

  it("does not auto-open when defaultOpen is false", () => {
    const { result, rerender } = renderHook(
      ({ isStreaming }: { isStreaming: boolean }) =>
        useReasoningLifecycle({ isStreaming, defaultOpen: false }),
      { initialProps: { isStreaming: false } },
    );
    rerender({ isStreaming: true });
    expect(result.current.isOpen).toBe(false);
  });

  it("auto-closes one second after streaming ends", () => {
    vi.useFakeTimers();
    try {
      const { result, rerender } = renderHook(
        ({ isStreaming }: { isStreaming: boolean }) => useReasoningLifecycle({ isStreaming }),
        { initialProps: { isStreaming: true } },
      );
      rerender({ isStreaming: false });
      expect(result.current.isOpen).toBe(true);
      act(() => vi.advanceTimersByTime(1000));
      expect(result.current.isOpen).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
