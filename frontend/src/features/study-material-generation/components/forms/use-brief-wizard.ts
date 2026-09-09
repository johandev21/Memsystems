import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { sourcesQueryOptions } from "@/features/sources";
import type { BaseMaterialFormProps, BriefFormData } from "./types";

export interface UseBriefWizardOptions
  extends Pick<BaseMaterialFormProps, "notebookId" | "value" | "onChange" | "disabled"> {
  initialStep?: 1 | 2;
}

export function useBriefWizard({
  notebookId,
  value,
  onChange,
  disabled = false,
  initialStep = 1,
}: UseBriefWizardOptions) {
  const [step, setStep] = useState<1 | 2>(initialStep);
  const { data: sources = [] } = useQuery(sourcesQueryOptions(notebookId));

  const hasSources = value.sourceIds.length > 0;
  const hasInstructions = value.brief.trim().length > 0;
  const canSubmit = !disabled && (hasSources || hasInstructions);

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
