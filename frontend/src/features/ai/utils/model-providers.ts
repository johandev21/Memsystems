export const PROVIDER_NAMES: Record<string, string> = {
  openai: "OpenAI",
  opencode: "OpenCode",
  google: "Google",
  gemini: "Gemini",
  anthropic: "Anthropic",
  deepseek: "DeepSeek",
  kimi: "Kimi",
};

export function getProviderName(provider: string): string {
  return PROVIDER_NAMES[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
}
