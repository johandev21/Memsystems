export type StudyMaterialKind =
  | "quiz"
  | "simple_flashcard"
  | "roadmap"
  | "mind_map"
  | "slides"
  | "study_guide"
  | "practice_problems"
  | "case_study";

export interface StudyMaterialDTO {
  id: string;
  notebookId: string;
  kind: StudyMaterialKind;
  title: string;
  folderId: string | null;
  content: unknown;
  options: unknown;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStudyMaterialInput {
  kind: StudyMaterialKind;
  title: string;
  content: unknown;
  folderId?: string | null;
}
