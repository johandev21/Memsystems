export function isPresetBannerUrl(url: string | null | undefined): boolean {
  return Boolean(url?.includes("/notebook-banners/"));
}
