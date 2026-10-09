import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/cn";
import { useLanguage } from "../hooks/use-language";

export function MobileLanguageSelector() {
  const { t } = useTranslation("settings");
  const { language, languages, setLanguage } = useLanguage();

  return (
    <div
      role="radiogroup"
      aria-label={t("language.title")}
      className="grid grid-cols-2 gap-1 rounded-2xl border border-border/40 bg-muted/60 p-1"
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
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-medium transition-all duration-150 touch-manipulation select-none active:scale-97 cursor-pointer",
              selected
                ? "bg-card text-foreground shadow-xs font-semibold ring-1 ring-border/50"
                : "text-muted-foreground hover:text-foreground hover:bg-card/40",
            )}
          >
            <span className="truncate">{option.nativeLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
