import { Key } from "lucide-react";
import { useTranslation } from "react-i18next";

interface GatewayKeyPromptProps {
  className?: string;
  description?: string;
}

/**
 * Shown wherever AI is unavailable for lack of a gateway key.
 */
export function GatewayKeyPrompt({ className = "", description }: GatewayKeyPromptProps) {
  const { t } = useTranslation("ai");
  const resolvedDescription = description ?? t("gatewayKeyPrompt.description");

  return (
    <div className={`w-full rounded-xl border border-border/70 bg-card p-5 shadow-sm ${className}`}>
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2 text-primary">
          <Key className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-foreground">{t("gatewayKeyPrompt.title")}</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">{resolvedDescription}</p>
        </div>
      </div>
    </div>
  );
}
