import { SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { NoEvidenceMetadata } from "../types/no-evidence.types";

/**
 * The visually distinct no-evidence state. Rendered instead of a grounded
 * reply when retrieval abstains: it names the degraded or unhelpful sources
 * and offers a corrective action, and never shows citations.
 */
export function NoEvidencePanel({ metadata }: { metadata: NoEvidenceMetadata }) {
  const { t } = useTranslation("chat");
  const { t: tSources } = useTranslation("sources");

  return (
    <div
      data-testid="no-evidence-panel"
      className="rounded-xl border border-warning/30 bg-warning/10 p-3"
    >
      <div className="flex items-start gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
          <SearchX className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{t("noEvidence.title")}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {t(`noEvidence.description.${metadata.abstentionReason}`)}
          </p>

          {metadata.degradedSources.length > 0 && (
            <div className="mt-2.5">
              <p className="text-xs font-medium text-foreground">{t("noEvidence.degradedSection")}</p>
              <ul className="mt-1 space-y-1.5">
                {metadata.degradedSources.map((source) => (
                  <li key={source.id} className="text-xs leading-5">
                    <span className="font-medium text-foreground">{source.title}</span>
                    <span className="text-muted-foreground">
                      {" — "}
                      {tSources(`quality.reason.${source.reason ?? "unknown"}`)}
                    </span>
                    <span className="block text-muted-foreground">
                      {tSources(`quality.action.${source.reason ?? "default"}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {metadata.unhelpfulSources.length > 0 && (
            <div className="mt-2.5">
              <p className="text-xs font-medium text-foreground">{t("noEvidence.unhelpfulSection")}</p>
              <ul className="mt-1 space-y-1">
                {metadata.unhelpfulSources.map((source) => (
                  <li key={source.id} className="text-xs leading-5">
                    <span className="font-medium text-foreground">{source.title}</span>
                    <span className="text-muted-foreground"> — {t("noEvidence.unhelpfulReason")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-2.5 text-xs font-medium text-foreground">{t("noEvidence.correctiveAction")}</p>
        </div>
      </div>
    </div>
  );
}
