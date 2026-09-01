import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ModelOption } from "@/features/ai";
import { useWebSearchModel } from "./use-web-search-model";

const sampleModels: ModelOption[] = [
  {
    id: "openai/gpt-5.6-sol",
    displayName: "GPT-5.6 Sol",
    supportsWebSearch: true,
  },
  {
    id: "google/gemini-2.5-pro",
    displayName: "Gemini 2.5 Pro",
    supportsWebSearch: true,
  },
  {
    id: "anthropic/claude-3-7-sonnet",
    displayName: "Claude 3.7 Sonnet",
    supportsWebSearch: false,
  },
  {
    id: "custom/capabilities-search",
    displayName: "Custom Search Model",
    capabilities: {
      webSearch: true,
    },
  },
];

describe("useWebSearchModel", () => {
  it("returns isSupported: true for models with supportsWebSearch: true", () => {
    const { result } = renderHook(() =>
      useWebSearchModel(sampleModels, "openai/gpt-5.6-sol"),
    );
    expect(result.current.isSupported).toBe(true);
    expect(result.current.currentModel?.displayName).toBe("GPT-5.6 Sol");
  });

  it("returns isSupported: true for models with capabilities.webSearch: true", () => {
    const { result } = renderHook(() =>
      useWebSearchModel(sampleModels, "custom/capabilities-search"),
    );
    expect(result.current.isSupported).toBe(true);
    expect(result.current.currentModel?.displayName).toBe("Custom Search Model");
  });

  it("returns isSupported: false for models that do not support web search", () => {
    const { result } = renderHook(() =>
      useWebSearchModel(sampleModels, "anthropic/claude-3-7-sonnet"),
    );
    expect(result.current.isSupported).toBe(false);
    expect(result.current.currentModel?.displayName).toBe("Claude 3.7 Sonnet");
  });

  it("returns isSupported: false when model is not found in models list", () => {
    const { result } = renderHook(() =>
      useWebSearchModel(sampleModels, "unknown/model-id"),
    );
    expect(result.current.isSupported).toBe(false);
    expect(result.current.currentModel).toBeUndefined();
  });

  it("returns isSupported: false when models is undefined", () => {
    const { result } = renderHook(() =>
      useWebSearchModel(undefined, "openai/gpt-5.6-sol"),
    );
    expect(result.current.isSupported).toBe(false);
    expect(result.current.currentModel).toBeUndefined();
  });
});
