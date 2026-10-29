export const PRESET_BANNER_IDS = [
  'abstract-watercolor',
  'blurred-bokeh-lights',
  'calm-ocean-waves-aerial',
  'green-leaves',
  'minimal-marble-texture',
  'misty-mountains-landscape',
  'paper-texture',
  'sand-dunes',
  'stars',
] as const;

export const PRESET_BANNER_PREFIX = 'preset:';

export function isPresetBannerId(id: string): boolean {
  return (PRESET_BANNER_IDS as readonly string[]).includes(id);
}

export function presetBannerVariants(id: string) {
  return {
    w240: `/notebook-banners/${id}-240w.webp`,
    w480: `/notebook-banners/${id}-480w.webp`,
    w960: `/notebook-banners/${id}-960w.webp`,
    w1920: `/notebook-banners/${id}-1920w.webp`,
  };
}
