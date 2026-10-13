export const PROVIDER_NAMES: Record<string, string> = {
  openai: "OpenAI",
  opencode: "OpenCode",
  google: "Google",
  gemini: "Gemini",
  anthropic: "Anthropic",
  deepseek: "DeepSeek",
  kimi: "Kimi",
  alibaba: "Alibaba",
  meta: "Meta",
  mistral: "Mistral",
  cohere: "Cohere",
  groq: "Groq",
  xai: "xAI",
  amazon: "Amazon",
  microsoft: "Microsoft",
  together: "Together",
};

export function getProviderName(provider: string): string {
  const normalized = provider.toLowerCase();
  return PROVIDER_NAMES[normalized] || provider.charAt(0).toUpperCase() + provider.slice(1).toLowerCase();
}
