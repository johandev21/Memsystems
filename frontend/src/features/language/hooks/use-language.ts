import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "../utils/languages";

export function useLanguage() {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;

  const setLanguage = (code: SupportedLanguage) => {
    void i18n.changeLanguage(code);
  };

  return { language, languages: SUPPORTED_LANGUAGES, setLanguage };
}
