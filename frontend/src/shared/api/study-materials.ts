import type {
  StudyMaterialKind,
  StudyMaterialDTO,
  CreateStudyMaterialInput,
} from "@/entities/study-material";
import { apiDelete, apiPatch, apiPost, createQueryOptions } from "./factory";

export type { StudyMaterialKind, StudyMaterialDTO, CreateStudyMaterialInput };

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
