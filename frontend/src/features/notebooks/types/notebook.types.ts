export interface Notebook {
  id: string;
  userId: string;
  title: string;
  description: string;
  icon: string;
  banner: string | null;
  bannerUrl: string | null;
  bannerFocalPoint: { x: number; y: number } | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotebooksResponse {
  notebooks: Notebook[];
  total: number;
}
