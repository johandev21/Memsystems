import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_MODEL_ID,
  NotebookModelProvider,
  resolveModelId,
  useNotebookModel,
} from "./notebook-model-context";
import { useModelPersistence } from "../hooks/use-model-persistence";

describe("NotebookModelContext & useNotebookModel", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("provides default model when no model is persisted", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NotebookModelProvider notebookId="nb-1">{children}</NotebookModelProvider>
    );

    const { result } = renderHook(() => useNotebookModel(), { wrapper });
    expect(result.current.selectedModel).toBe(DEFAULT_MODEL_ID);
  });

  it("reads persisted model from localStorage", () => {
    localStorage.setItem("memsystems-selected-model-nb-1", "google/gemini-2.5-flash");

    const wrapper = ({ children }: { children: ReactNode }) => (
      <NotebookModelProvider notebookId="nb-1">{children}</NotebookModelProvider>
    );

    const { result } = renderHook(() => useNotebookModel(), { wrapper });
    expect(result.current.selectedModel).toBe("google/gemini-2.5-flash");
  });

  it("synchronizes model updates across multiple consumers under the same provider", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NotebookModelProvider notebookId="nb-1">{children}</NotebookModelProvider>
    );

    const { result } = renderHook(
      () => ({
        consumerA: useNotebookModel(),
        consumerB: useModelPersistence("nb-1"),
      }),
      { wrapper },
    );

    expect(result.current.consumerA.selectedModel).toBe(DEFAULT_MODEL_ID);
    expect(result.current.consumerB.selectedModel).toBe(DEFAULT_MODEL_ID);

    act(() => {
      result.current.consumerA.setSelectedModel("anthropic/claude-3-7-sonnet");
    });

    expect(result.current.consumerA.selectedModel).toBe("anthropic/claude-3-7-sonnet");
    expect(result.current.consumerB.selectedModel).toBe("anthropic/claude-3-7-sonnet");
    expect(result.current.consumerB.model).toBe("anthropic/claude-3-7-sonnet");

    // Verify localStorage keys are persisted
    expect(localStorage.getItem("memsystems-selected-model-nb-1")).toBe(
      "anthropic/claude-3-7-sonnet",
    );
    expect(localStorage.getItem("memsystems:selected-model")).toBe("anthropic/claude-3-7-sonnet");
  });

  it("falls back to standalone persistence when used outside NotebookModelProvider", () => {
    const { result } = renderHook(() => useModelPersistence("nb-2"));
    expect(result.current.selectedModel).toBe(DEFAULT_MODEL_ID);

    act(() => {
      result.current.setModel("deepseek/deepseek-chat");
    });

    expect(result.current.selectedModel).toBe("deepseek/deepseek-chat");
    expect(localStorage.getItem("memsystems-selected-model-nb-2")).toBe("deepseek/deepseek-chat");
  });

  it("migrates stale pre-gateway model IDs from localStorage", () => {
    expect(resolveModelId("kimi/kimi-k3")).toBe("moonshotai/kimi-k3");
    expect(resolveModelId("kimi/kimi-k2.6")).toBe("moonshotai/kimi-k2.6");
    expect(resolveModelId("deepseek/deepseek-v3")).toBe("deepseek/deepseek-v3.2");
    expect(resolveModelId("openai/gpt-5.6-sol")).toBe("openai/gpt-5.6-sol");

    localStorage.setItem("memsystems-selected-model-nb-1", "kimi/kimi-k3");

    const wrapper = ({ children }: { children: ReactNode }) => (
      <NotebookModelProvider notebookId="nb-1">{children}</NotebookModelProvider>
    );

    const { result } = renderHook(() => useNotebookModel(), { wrapper });
    expect(result.current.selectedModel).toBe("moonshotai/kimi-k3");
  });
});
