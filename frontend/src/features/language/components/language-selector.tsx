import { useTranslation } from "react-i18next";
import { useLanguage } from "../hooks/use-language";

export function LanguageSelector() {
  const { t } = useTranslation("settings");
  const { language, languages, setLanguage } = useLanguage();

  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      role="radiogroup"
      aria-label={t("language.title")}
    >
      {languages.map((option) => {
        const selected = language === option.code;
        return (
          <button
            key={option.code}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setLanguage(option.code)}
            className={`group flex flex-col gap-2.5 rounded-[20px] border p-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              selected
                ? "border-primary bg-card shadow-sm ring-1 ring-primary/20"
                : "border-border bg-card hover:border-border/80 hover:bg-muted/20"
            }`}
          >
            <span
              className={`inline-flex items-center gap-1.5 text-sm font-medium ${selected ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}
            >
              {option.nativeLabel}
              {selected ? (
                <span className="ml-auto size-1.5 rounded-full bg-primary" aria-hidden="true" />
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
