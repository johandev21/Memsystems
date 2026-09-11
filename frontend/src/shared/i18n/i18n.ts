import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

export const defaultNS = "common";

type NamespaceResources = Record<string, Record<string, unknown>>;

function toNamespaces(modules: Record<string, unknown>): NamespaceResources {
  const namespaces: NamespaceResources = {};
  for (const [path, module] of Object.entries(modules)) {
    const name = path.slice(path.lastIndexOf("/") + 1).replace(/\.json$/, "");
    namespaces[name] = (module as { default: Record<string, unknown> }).default;
  }
  return namespaces;
}

export const resources = {
  en: toNamespaces(import.meta.glob("./locales/en/*.json", { eager: true })),
  es: toNamespaces(import.meta.glob("./locales/es/*.json", { eager: true })),
} as const;

function applyDocumentLanguage(lng: string | undefined) {
  if (typeof document !== "undefined" && lng) {
    document.documentElement.lang = lng;
  }
}

i18n.on("languageChanged", applyDocumentLanguage);

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    ns: Object.keys(resources.en),
    defaultNS,
    fallbackLng: "en",
    supportedLngs: ["en", "es"],
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
    interpolation: { escapeValue: false },
    debug: import.meta.env.DEV,
  })
  .then(() => {
    applyDocumentLanguage(i18n.resolvedLanguage ?? i18n.language);
  });

export default i18n;
