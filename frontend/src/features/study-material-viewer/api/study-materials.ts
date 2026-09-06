import { apiDelete, apiPatch, apiPost, createQueryOptions, fetchApi } from "@/shared/api";
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

export const evaluatePracticeProblem = (materialId: string, input: EvaluateProblemInput) =>
  apiPost<EvaluateProblemInput, ProblemEvaluationResult>(
    `/api/study-materials/${materialId}/evaluate-problem`,
    input,
  );
