import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const scrollToEnd = vi.hoisted(() => vi.fn());

vi.mock("@shadcn/react/message-scroller", () => ({
  MessageScroller: {
    Provider: ({ children }: { children: ReactNode }) => <>{children}</>,
    Root: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    Viewport: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    Content: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    Item: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button {...props}>{children}</button>
    ),
  },
  useMessageScroller: () => ({ scrollToEnd }),
}));

import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "./message-scroller";

class TestResizeObserver {
  static instances: TestResizeObserver[] = [];
  private readonly callback: ResizeObserverCallback;
  disconnected = false;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    TestResizeObserver.instances.push(this);
  }

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect() {
    this.disconnected = true;
  }
  trigger() {
    if (!this.disconnected) this.callback([], this as unknown as ResizeObserver);
  }
}

function renderScroller() {
  return render(
    <MessageScrollerProvider>
      <MessageScroller>
        <MessageScrollerViewport>
          <MessageScrollerContent>
            <div>History</div>
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton>Scroll down</MessageScrollerButton>
      </MessageScroller>
    </MessageScrollerProvider>,
  );
}

describe("MessageScrollerButton bottom following", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    TestResizeObserver.instances = [];
    scrollToEnd.mockReset();
  });

  it("settles at the expanded bottom and follows again after another click", async () => {
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    let contentHeight = 1200;
    const { container } = renderScroller();
    const viewport = container.querySelector<HTMLElement>('[data-slot="message-scroller-viewport"]')!;
    Object.defineProperty(viewport, "scrollHeight", { configurable: true, get: () => contentHeight });
    Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 400 });
    Object.defineProperty(viewport, "scrollTo", {
      configurable: true,
      value: vi.fn((options: ScrollToOptions) => {
        viewport.scrollTop = options.top ?? 0;
      }),
    });

    fireEvent.click(screen.getByRole("button", { name: "Scroll down" }));
    await waitFor(() => expect(viewport.scrollTop).toBe(1200));

    contentHeight = 2400;
    TestResizeObserver.instances.at(-1)?.trigger();
    await waitFor(() => expect(viewport.scrollTop).toBe(2400));

    fireEvent.wheel(viewport, { deltaY: -80 });
    contentHeight = 3200;
    TestResizeObserver.instances.at(-1)?.trigger();
    expect(TestResizeObserver.instances.at(-1)?.disconnected).toBe(true);
    expect(viewport.scrollTop).toBe(2400);

    fireEvent.click(screen.getByRole("button", { name: "Scroll down" }));
    await waitFor(() => expect(viewport.scrollTop).toBe(3200));
  });
});
