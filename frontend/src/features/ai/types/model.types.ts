export interface ModelCapabilities {
  imageInput?: boolean;
  fileInput?: boolean;
  audioInput?: boolean;
  tools?: boolean;
  structuredOutput?: boolean;
  reasoning?: boolean;
  webSearch?: boolean;
}

export interface ModelOption {
  id: string;
  displayName: string;
  supportsWebSearch?: boolean;
  capabilities?: ModelCapabilities;
  pricing?: { input: number; output: number } | null;
  /**
   * Best-effort free-tier marker from the gateway catalog.
   * Entitlement is account-side and NOT guaranteed by this flag.
   */
  isFreeTier?: boolean;
}

export interface ModelsResponse {
  models: ModelOption[];
}

