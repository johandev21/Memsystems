export interface NotebookBannerVariants {
  w240: string | null;
  w480: string | null;
  w960: string | null;
  w1920: string | null;
}

export interface Notebook {
  id: string;
  title: string;
  description: string;
  icon: string;
  folderId: string | null;
  banner: string | null;
  bannerUrl: string | null;
  bannerVariants: NotebookBannerVariants | null;
  bannerFocalPoint: { x: number; y: number } | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotebooksResponse {
  notebooks: Notebook[];
  total: number;
}
