export interface ModelOption {
  id: string;
  displayName: string;
  supportsWebSearch?: boolean;
}

export interface ModelsResponse {
  models: ModelOption[];
}
