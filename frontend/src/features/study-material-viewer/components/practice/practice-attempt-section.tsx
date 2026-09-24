import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorFilter,
  ModelSelectorInput,
  ModelSelectorModels,
  ModelSelectorTrigger,
  useModelList,
} from "@/features/ai";
import type { ModelOption } from "@/features/ai";
import { AttemptFeedbackCard } from "./practice-solution-section";

export interface AttemptCapability {
  canEvaluate: boolean;
  capabilitiesVerified: boolean;
  modelName: string;
  models: ModelOption[];
  selectedModel: string;
  onModelChange: (modelId: string) => void;
}

export function AttemptSection({
  studentAnswer,
  isEvaluating,
  evaluation,
  evaluationError,
  difficulty,
  isSolutionRevealed,
  capability,
  onAnswerChange,
  onEvaluate,
  onGiveUp,
}: {
  studentAnswer: string;
  isEvaluating: boolean;
  evaluation: { status: string; feedback: string; strengths: string[]; missingPoints: string[] } | null | undefined;
  evaluationError?: string | null;
  difficulty: string;
  isSolutionRevealed: boolean;
  capability: AttemptCapability;
  onAnswerChange: (v: string) => void;
  onEvaluate: () => void;
  onGiveUp: () => void;
}) {
  const { t } = useTranslation("viewer");
  const [gateOpen, setGateOpen] = useState(false);
  const showGate = !capability.canEvaluate && gateOpen;

  const handleEvaluate = () => {
    if (!capability.canEvaluate) {
      setGateOpen(true);
      return;
    }
    onEvaluate();
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <label htmlFor="student-attempt-input" className="text-base font-semibold text-text-primary">
          {t("practice.yourAttempt")}
        </label>
        {evaluation && (
          <span className="text-xs text-text-secondary">{t("practice.evaluatedWithAi")}</span>
        )}
      </div>

      <Textarea
        id="student-attempt-input"
        aria-label={t("practice.attemptAria")}
        value={studentAnswer}
        onChange={(e) => onAnswerChange(e.target.value)}
        placeholder={t("practice.attemptPlaceholder")}
        className="min-h-35 text-base leading-relaxed resize-y border-surface-border bg-surface-2 focus-visible:border-surface-border-strong"
      />

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleEvaluate}
            disabled={isEvaluating || !studentAnswer.trim()}
            className="gap-2 cursor-pointer"
          >
            {isEvaluating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("practice.evaluating")}
              </>
            ) : (
              <>{evaluation ? t("practice.reevaluate") : t("practice.evaluate")}</>
            )}
          </Button>

          {difficulty === "hard" && !isSolutionRevealed && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onGiveUp}
              className="text-xs text-text-secondary hover:text-text-primary"
            >
              {t("practice.giveUp")}
            </Button>
          )}
        </div>

        {evaluationError && <p className="text-xs text-destructive">{evaluationError}</p>}
      </div>

      {showGate && (
        <EvaluationCapabilityGate {...capability} onSelected={() => setGateOpen(false)} />
      )}

      {evaluation && <AttemptFeedbackCard evaluation={evaluation} />}
    </section>
  );
}

/**
 * Blocks the evaluation call until the chosen model can produce structured
 * output. The picker opens in place and the gate disappears once a capable
 * model is chosen.
 */
function EvaluationCapabilityGate({
  capabilitiesVerified,
  modelName,
  models,
  selectedModel,
  onModelChange,
  onSelected,
}: AttemptCapability & { onSelected: () => void }) {
  const { t } = useTranslation("viewer");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [structuredOnly, setStructuredOnly] = useState(false);
  const groups = useModelList(models, { search, structuredOnly, capabilitiesVerified });

  return (
    <Alert>
      <AlertTitle>{t("practice.structuredOutput.title")}</AlertTitle>
      <AlertDescription>
        {capabilitiesVerified
          ? t("practice.structuredOutput.description", { name: modelName })
          : t("practice.structuredOutput.unverifiedDescription")}
      </AlertDescription>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <ModelSelector open={pickerOpen} onOpenChange={setPickerOpen}>
          <ModelSelectorTrigger render={<Button size="sm" />}>
            {t("practice.structuredOutput.chooseModel")}
          </ModelSelectorTrigger>
          <ModelSelectorContent title={t("practice.structuredOutput.pickerTitle")}>
            <ModelSelectorInput
              placeholder={t("practice.structuredOutput.searchPlaceholder")}
              value={search}
              onValueChange={setSearch}
            />
            <ModelSelectorFilter checked={structuredOnly} onCheckedChange={setStructuredOnly} />
            <ModelSelectorModels
              groups={groups}
              selectedModel={selectedModel}
              capabilitiesVerified={capabilitiesVerified}
              onSelect={(modelId) => {
                onModelChange(modelId);
                setPickerOpen(false);
                onSelected();
              }}
            />
          </ModelSelectorContent>
        </ModelSelector>
        {!capabilitiesVerified && (
          <a
            href="/settings"
            className="text-xs font-medium text-muted-foreground underline underline-offset-3 transition-colors hover:text-foreground"
          >
            {t("practice.structuredOutput.refreshCatalog")}
          </a>
        )}
      </div>
    </Alert>
  );
}