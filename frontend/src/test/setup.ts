/* eslint-disable @typescript-eslint/no-explicit-any */

import { beforeEach } from "vitest";
import i18n from "@/shared/i18n/i18n";

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

if (typeof window !== "undefined") {
  if (typeof Element !== "undefined" && !Element.prototype.getAnimations) {
    (Element.prototype as unknown as Record<string, unknown>).getAnimations = () => [];
  }
  if (
    typeof HTMLElement !== "undefined" &&
    !(HTMLElement.prototype as unknown as Record<string, unknown>).getAnimations
  ) {
    (HTMLElement.prototype as unknown as Record<string, unknown>).getAnimations = () => [];
  }

  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }

  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }

  if (typeof window.matchMedia !== "function") {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }

  if (typeof window.ResizeObserver === "undefined") {
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (window as any).ResizeObserver = ResizeObserver;
    (globalThis as any).ResizeObserver = ResizeObserver;
  }

  if (typeof window.IntersectionObserver === "undefined") {
    class IntersectionObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
    (window as any).IntersectionObserver = IntersectionObserver as any;
    (globalThis as any).IntersectionObserver = IntersectionObserver as any;
  }

  if (typeof window.scrollTo !== "function") {
    window.scrollTo = () => {};
  }
}
