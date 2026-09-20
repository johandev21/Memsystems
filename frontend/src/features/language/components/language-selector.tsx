import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../hooks/use-language";

export function LanguageSelector() {
  const { t } = useTranslation("settings");
  const { language, languages, setLanguage } = useLanguage();

  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
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
                : "border-border bg-card hover:border-border/80 hover:bg-muted/10"
            }`}
          >
            <span
              className="flex h-20 w-full items-center justify-center overflow-hidden rounded-xl bg-muted/20 px-3"
              aria-hidden="true"
            >
              <span className="truncate text-lg font-medium tracking-tight text-foreground">
                {option.sample}
              </span>
            </span>
            <span className="flex items-center justify-between gap-2 px-0.5">
              <span className="min-w-0 truncate text-base font-medium text-foreground">
                {option.nativeLabel}
              </span>
              <span
                className={`ml-auto flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-transparent bg-muted text-muted-foreground group-hover:bg-muted group-hover:text-foreground"
                }`}
                aria-hidden="true"
              >
                {selected ? (
                  <Check className="size-3.5" />
                ) : (
                  <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                )}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
