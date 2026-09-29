import {
  type ApiErrorResponse,
  apiDelete,
  apiPatch,
  apiPost,
  createApiErrorMessage,
  createQueryOptions,
  fetchApi,
  resolveApiErrorMessage,
} from "@/shared/api";
import { isStructuredOutputMessageKey } from "@/features/ai";
import type { StudyMaterialDTO, CreateStudyMaterialInput } from "../types";
import type { ProblemEvaluationResult } from "../shapes/practice-problems";

export interface EvaluateProblemInput {
  problemId: string;
  studentAnswer: string;
  modelId: string;
}

export interface UpdateStudyMaterialInput {
  title?: string;
  content?: unknown;
}

export const studyMaterialsQueryOptions = (notebookId: string) =>
  createQueryOptions<StudyMaterialDTO[]>(
    ["study-materials", notebookId],
    `/api/notebooks/${notebookId}/study-materials`,
  );

export const studyMaterialQueryOptions = (materialId: string) =>
  createQueryOptions<StudyMaterialDTO>(
    ["study-material", materialId],
    `/api/study-materials/${materialId}`,
  );

export const createStudyMaterial = (notebookId: string, input: CreateStudyMaterialInput) =>
  apiPost<CreateStudyMaterialInput, StudyMaterialDTO>(
    `/api/notebooks/${notebookId}/study-materials`,
    input,
  );

export const updateStudyMaterial = (materialId: string, input: UpdateStudyMaterialInput) =>
  apiPatch<UpdateStudyMaterialInput, StudyMaterialDTO>(`/api/study-materials/${materialId}`, input);

export const deleteStudyMaterial = (materialId: string) =>
  apiDelete(`/api/study-materials/${materialId}`);

export const duplicateStudyMaterial = (materialId: string) =>
  apiPost<Record<string, never>, StudyMaterialDTO>(
    `/api/study-materials/${materialId}/duplicate`,
    {},
  );

export const moveStudyMaterial = (materialId: string, folderId: string | null) =>
  apiPatch<{ folderId: string | null }, StudyMaterialDTO>(
    `/api/study-materials/${materialId}/move`,
    { folderId },
  );

export const downloadSlidesPptx = async (materialId: string, filename: string) => {
  const res = await fetchApi(`/api/study-materials/${materialId}/export`);
  if (!res.ok) {
    throw new Error(`Export failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".pptx") ? filename : `${filename}.pptx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};

export const evaluatePracticeProblem = async (
  materialId: string,
  input: EvaluateProblemInput,
): Promise<ProblemEvaluationResult> => {
  const res = await fetchApi(`/api/study-materials/${materialId}/evaluate-problem`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload: unknown = await res.json().catch(() => ({}));
  const errorData = payload as ApiErrorResponse;
  if (!res.ok) {
    // Preserve the structured-output preflight key so the evaluation surface
    // classifies it as a capability block instead of a generic failure.
    const messageKey = isStructuredOutputMessageKey(errorData.error)
      ? errorData.error
      : isStructuredOutputMessageKey(errorData.messageKey)
        ? errorData.messageKey
        : null;
    if (messageKey) throw new Error(messageKey);
    throw new Error(resolveApiErrorMessage(errorData, createApiErrorMessage(res)));
  }
  return payload as ProblemEvaluationResult;
};
