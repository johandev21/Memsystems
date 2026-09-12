import { createContext, useContext } from "react";

const STORAGE_KEY = "memsystems-selected-model";

export const DEFAULT_MODEL_ID = "openai/gpt-5.6-sol";

const MODEL_ID_ALIASES: Record<string, string> = {
  "kimi/kimi-k3": "moonshotai/kimi-k3",
  "kimi/kimi-k2.6": "moonshotai/kimi-k2.6",
  "deepseek/deepseek-v3": "deepseek/deepseek-v3.2",
  "google/gemini-3.6-pro": "google/gemini-2.5-pro",
  "google/gemini-3.6-thinking": "google/gemini-3.8-flash",
};

export function resolveModelId(modelId: string): string {
  return MODEL_ID_ALIASES[modelId] ?? modelId;
}

export function getPersistedModel(notebookId: string): string {
  if (typeof window === "undefined") return DEFAULT_MODEL_ID;
  const stored =
    localStorage.getItem(`${STORAGE_KEY}-${notebookId}`) ??
    localStorage.getItem("memsystems:selected-model") ??
    DEFAULT_MODEL_ID;
  return resolveModelId(stored);
}

export function setPersistedModel(notebookId: string, modelId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${STORAGE_KEY}-${notebookId}`, modelId);
  localStorage.setItem("memsystems:selected-model", modelId);
}

export interface NotebookModelContextValue {
  selectedModel: string;
  setSelectedModel: (modelId: string) => void;
  model: string;
  setModel: (modelId: string) => void;
}

export const NotebookModelContext = createContext<NotebookModelContextValue | null>(null);

export function useNotebookModel(): NotebookModelContextValue {
  const context = useContext(NotebookModelContext);
  if (!context) {
    throw new Error("useNotebookModel must be used within a NotebookModelProvider");
  }
  return context;
}
