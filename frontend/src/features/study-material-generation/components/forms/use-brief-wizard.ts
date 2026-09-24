import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { sourcesQueryOptions } from "@/features/sources/api/sources";
import type { BaseMaterialFormProps, BriefFormData } from "./types";

export interface UseBriefWizardOptions
  extends Pick<BaseMaterialFormProps, "notebookId" | "value" | "onChange" | "disabled"> {
  initialStep?: number;
  totalSteps?: number;
}

export function useBriefWizard({
  notebookId,
  value,
  onChange,
  disabled = false,
  initialStep = 1,
  totalSteps = 2,
}: UseBriefWizardOptions) {
  const [step, setStepState] = useState<number>(initialStep);
  const { data: sources = [] } = useQuery(sourcesQueryOptions(notebookId));

  const hasSources = value.sourceIds.length > 0;
  const hasInstructions = value.brief.trim().length > 0;
  const canSubmit = !disabled && (hasSources || hasInstructions);

  const setStep = (n: number) => setStepState(Math.min(totalSteps, Math.max(1, Math.round(n))));

  const patchFormData = (patch: Partial<BriefFormData>) => {
    onChange(patch);
  };

  return {
    step,
    setStep,
    sources,
    hasSources,
    hasInstructions,
    canSubmit,
    patchFormData,
  };
}
