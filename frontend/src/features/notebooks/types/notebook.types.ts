export interface NotebookBannerVariants {
  w480: string | null;
  w960: string | null;
  w1920: string | null;
}

export interface Notebook {
  id: string;
  title: string;
  description: string;
  icon: string;
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
