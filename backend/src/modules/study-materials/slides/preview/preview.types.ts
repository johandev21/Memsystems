export const WIDTH = 1280;
export const HEIGHT = 720;
export const CONTENT_BOTTOM = 656;

export type LegacyPreviewTheme = {
  background: string;
  accent: string;
  text: string;
  muted: string;
};

export type DeckSlide = {
  id: string;
  layout?: string;
  title: string;
  subtitle?: string;
  bullets?: string[];
  body?: string;
};
