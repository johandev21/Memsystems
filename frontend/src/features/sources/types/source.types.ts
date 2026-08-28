export type SourceKind = "text" | "url" | "file";

export interface Source {
  id: string;
  notebookId: string;
  kind: SourceKind;
  title: string;
  url: string | null;
  contentType: string | null;
  fileSize: number | null;
  createdAt: string;
}

export interface SourceWithContent extends Source {
  rawText: string;
  s3Key: string | null;
  sha256: string | null;
}
