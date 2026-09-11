const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
};

export function languageName(language?: string | null): string | null {
  if (!language) return null;
  const base = language.split('-')[0].toLowerCase();
  return LANGUAGE_NAMES[base] ?? null;
}

export function languageDirective(language?: string | null): string {
  const name = languageName(language);
  return name ? `\n\nRespond in ${name}.` : '';
}
