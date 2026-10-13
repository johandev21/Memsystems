import type { LanguageModel, Tool } from 'ai';

export interface ModelCapabilities {
  imageInput?: boolean;
  fileInput?: boolean;
  audioInput?: boolean;
  tools?: boolean;
  structuredOutput?: boolean;
  reasoning?: boolean;
  webSearch?: boolean;
}

export interface ProviderModel {
  id: string;
  displayName: string;
  supportsWebSearch?: boolean;
  capabilities?: ModelCapabilities;
  pricing?: { input: number; output: number } | null;
  isFreeTier?: boolean;
}

export interface HealthCheckResult {
  ok: boolean;
  detail?: string;
  degraded?: boolean;
}

export interface Provider {
  id: string;
  name: string;
  listModels(): ProviderModel[];
  createModel(modelId: string): LanguageModel;
  supportsWebSearch(modelId: string): boolean;
  createWebSearchTool?(): Tool;
  health(): Promise<HealthCheckResult>;
}
