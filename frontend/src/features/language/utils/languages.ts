export const SUPPORTED_LANGUAGES = [
  { code: "en", nativeLabel: "English" },
  { code: "es", nativeLabel: "Español" },
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]["code"];
