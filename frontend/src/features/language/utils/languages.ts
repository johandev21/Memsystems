// Samples are specimen phrases in their own language, shown regardless of UI locale — never route them through i18n.
export const SUPPORTED_LANGUAGES = [
  { code: "en", nativeLabel: "English", sample: "Welcome back" },
  { code: "es", nativeLabel: "Español", sample: "Bienvenido de nuevo" },
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]["code"];
