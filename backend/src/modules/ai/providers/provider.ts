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
  /**
   * Advertised web-search support. Only present when the Gateway public model
   * list provided capabilities for this model; absent means "no claims"
   * (fail closed), not "unsupported".
   */
  supportsWebSearch?: boolean;
  /**
   * Gateway-reported Model Capabilities. Only populated for models found in
   * the Gateway public model list during a successful catalog sync; omitted
   * otherwise so stale/seed catalogs cannot be mistaken for verified data.
   */
  capabilities?: ModelCapabilities;
  /** Per-token USD pricing from the gateway catalog, when reported. */
  pricing?: { input: number; output: number } | null;
  /**
   * Best-effort free-tier marker (`-free` slug or zero pricing).
   * Entitlement is account-side and NOT guaranteed by this flag.
   */
  isFreeTier?: boolean;
}

export interface HealthCheckResult {
  ok: boolean;
  detail?: string;
  /**
   * True when the credential is accepted but the gateway is temporarily
   * degraded (rate limit, entitlement gap, upstream outage). Degraded is
   * NOT disconnected: callers should let requests through and surface
   * per-request errors instead of locking the UI.
   */
  degraded?: boolean;
}

export interface Provider {
  id: string;
  name: string;
  listModels(): ProviderModel[];
  // Provider packages may expose a newer model specification than the app's
  // AI SDK peer dependency; the runtime contract is still the AI SDK model.
  createModel(modelId: string): LanguageModel;
  supportsWebSearch(modelId: string): boolean;
  createWebSearchTool?(): Tool;
  health(): Promise<HealthCheckResult>;
}
