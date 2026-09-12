import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

export const defaultNS = "common";

// Locale bundles load on demand instead of shipping both languages and every
// namespace in the eager bundle. The active language's "common" namespace is
// fetched at startup; route namespaces load when a component first declares
// them (react-i18next suspends via the app-level Suspense boundary until the
// local chunk arrives).
const localeModules = import.meta.glob<{ default: Record<string, unknown> }>(
  "./locales/*/*.json",
);

function applyDocumentLanguage(lng: string | undefined) {
  if (typeof document !== "undefined" && lng) {
    document.documentElement.lang = lng;
  }
}

i18n.on("languageChanged", applyDocumentLanguage);

void i18n
  .use(LanguageDetector)
  .use({
    type: "backend",
    read(
      language: string,
      namespace: string,
      callback: (error: unknown, data?: unknown) => void,
    ) {
      const load = localeModules[`./locales/${language}/${namespace}.json`];
      if (!load) {
        // Unknown language/namespace combination: empty bundle, i18next falls
        // back to the fallback language.
        callback(null, {});
        return;
      }
      load()
        .then((module) => callback(null, module.default))
        .catch((error) => callback(error, null));
    },
  })
  .use(initReactI18next)
  .init({
    ns: ["common"],
    defaultNS,
    fallbackLng: "en",
    supportedLngs: ["en", "es"],
    partialBundledLanguages: true,
    interpolation: { escapeValue: false },
    debug: import.meta.env.DEV,
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  })
  .then(() => {
    applyDocumentLanguage(i18n.resolvedLanguage ?? i18n.language);
  });

export default i18n;
