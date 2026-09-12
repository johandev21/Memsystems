import { MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/ui/markdown";
import type { Source } from "@/features/sources";

export function ProblemStatementSection({
  activeIdx,
  prompt,
  givens,
  constraints,
  checklist,
  acceptableAlternatives,
  sourceIds,
  setSourceIds,
  sourceMap,
  onOpenSource,
  onDiscussInChat,
}: {
  activeIdx: number;
  prompt: string;
  givens: string[];
  constraints: string[];
  checklist: string[];
  acceptableAlternatives: string[];
  sourceIds: string[];
  setSourceIds: string[];
  sourceMap: Map<string, Source>;
  onOpenSource: (id: string) => void;
  onDiscussInChat: () => void;
}) {
  const { t } = useTranslation("viewer");

  return (
    <section className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1.5 flex-1">
          <span className="text-sm font-medium text-text-secondary">
            {t("practice.problem", { number: activeIdx + 1 })}
          </span>
          <div className="text-lg md:text-xl font-semibold text-text-primary leading-relaxed">
            <MarkdownRenderer>{prompt}</MarkdownRenderer>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDiscussInChat}
          className="self-start text-xs text-text-secondary hover:text-text-primary shrink-0 gap-1.5"
          title={t("practice.discussTitle")}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {t("practice.discussInChat")}
        </Button>
      </div>

      {(givens.length > 0 ||
        constraints.length > 0 ||
        checklist.length > 0 ||
        acceptableAlternatives.length > 0) && (
        <div className="rounded-xl border border-surface-border-subtle bg-surface-2 p-5 space-y-5 text-sm">
          {givens.length > 0 && (
            <div>
              <h4 className="font-medium text-text-primary mb-1.5">{t("practice.givens")}</h4>
              <ul className="list-disc list-inside space-y-1 text-text-secondary">
                {givens.map((given) => (
                  <li key={given}>{given}</li>
                ))}
              </ul>
            </div>
          )}

          {constraints.length > 0 && (
            <div>
              <h4 className="font-medium text-text-primary mb-1.5">{t("practice.constraints")}</h4>
              <ul className="list-disc list-inside space-y-1 text-text-secondary">
                {constraints.map((constraint) => (
                  <li key={constraint}>{constraint}</li>
                ))}
              </ul>
            </div>
          )}

          {checklist.length > 0 && (
            <div>
              <h4 className="font-medium text-text-primary mb-1.5">
                {t("practice.verificationChecklist")}
              </h4>
              <ul className="list-disc list-inside space-y-1 text-text-secondary">
                {checklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {acceptableAlternatives.length > 0 && (
            <div>
              <h4 className="font-medium text-text-primary mb-1.5">
                {t("practice.acceptableAlternatives")}
              </h4>
              <ul className="list-disc list-inside space-y-1 text-text-secondary">
                {acceptableAlternatives.map((alt) => (
                  <li key={alt}>{alt}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {sourceIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-xs text-text-secondary">{t("practice.sources")}</span>
          {sourceIds.map((srcId) => {
            const src = sourceMap.get(srcId);
            return (
              <Button
                key={srcId}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenSource(srcId)}
                className="h-6 px-2 text-xs text-text-secondary hover:text-text-primary"
              >
                {src?.title || t("common.sourceUnavailable")}
              </Button>
            );
          })}
        </div>
      )}
      {setSourceIds.length === 0 && sourceIds.length === 0 && (
        <p className="text-xs text-text-secondary pt-1">{t("common.generatedWithoutSources")}</p>
      )}
    </section>
  );
}
