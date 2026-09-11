import { Key, Settings2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

interface GatewayKeyPromptProps {
  className?: string;
  description?: string;
}

/**
 * Shown wherever AI is unavailable for lack of a gateway key. Keys are only
 * ever entered in Settings — this card just routes there.
 */
export function GatewayKeyPrompt({ className = "", description }: GatewayKeyPromptProps) {
  const { t } = useTranslation("ai");
  const resolvedDescription = description ?? t("gatewayKeyPrompt.description");

  return (
    <div className={`w-full rounded-xl border border-border/70 bg-card p-5 shadow-sm ${className}`}>
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2 text-primary">
          <Key className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-foreground">{t("gatewayKeyPrompt.title")}</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">{resolvedDescription}</p>
        </div>
      </div>
      <Link
        to="/settings"
        className="inline-flex h-9 items-center gap-1.5 rounded-2xl bg-primary px-4 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        <Settings2 className="size-3.5" />
        {t("gatewayKeyPrompt.openSettings")}
      </Link>
    </div>
  );
}
