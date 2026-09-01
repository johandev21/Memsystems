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
}

export interface ModelsResponse {
  models: ModelOption[];
}

