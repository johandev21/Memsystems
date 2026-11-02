import { resolveSlideDeck } from './slides-design-resolver';
import { renderLegacySlide } from './preview/legacy-layouts';
import { decorationSvg } from './preview/scene-decoration';
import { renderSceneSlide } from './preview/scene-layout';
import { escapeXml, fontFamilyFor, truncate } from './preview/text-layout';
import {
  HEIGHT,
  WIDTH,
  type DeckSlide,
  type LegacyPreviewTheme,
} from './preview/preview.types';
import type { SlideDeck, SlideDesign, SlideScene } from './slides-design.types';

export type { LegacyPreviewTheme } from './preview/preview.types';
type Theme = LegacyPreviewTheme;

function isSlideDesign(value: Theme | SlideDesign): value is SlideDesign {
  return (
    typeof value === 'object' &&
    value !== null &&
    'primary' in value &&
    'surface' in value
  );
}

function isSceneSlide(value: DeckSlide | SlideScene): value is SlideScene {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('role' in value || 'elements' in value)
  );
}

function designToLegacyTheme(design: SlideDesign): Theme {
  return {
    background: design.background,
    accent: design.primary,
    text: design.text,
    muted: design.muted,
  };
}

export function renderSlideSvg(
  slide: DeckSlide | SlideScene,
  index: number,
  total: number,
  theme: Theme | SlideDesign,
): string {
  const isScene = isSceneSlide(slide);
  let design: SlideDesign | null = null;
  let legacyTheme: Theme;
  if (isSlideDesign(theme)) {
    design = theme;
    legacyTheme = designToLegacyTheme(design);
  } else {
    legacyTheme = theme;
  }
  const plainTitle = truncate(
    (slide.title || `Slide ${index + 1}`).slice(0, 90) || `Slide ${index + 1}`,
    90,
  );
  const background = design?.background ?? legacyTheme.background;
  const accent = design?.primary ?? legacyTheme.accent;
  const muted = design?.muted ?? legacyTheme.muted;

  let contentSvg: string;
  if (isScene && design) {
    contentSvg = renderSceneSlide(slide, index, total, design);
  } else if (isScene) {
    const fallback: SlideDesign = {
      background: legacyTheme.background,
      surface: legacyTheme.background,
      primary: legacyTheme.accent,
      secondary: legacyTheme.accent,
      text: legacyTheme.text,
      muted: legacyTheme.muted,
      fontHeading: 'Inter',
      fontBody: 'Inter',
      radius: 'small',
      density: 'balanced',
      decoration: 'minimal',
    };
    contentSvg = renderSceneSlide(slide, index, total, fallback);
  } else {
    contentSvg = renderLegacySlide(slide, index, legacyTheme);
  }

  const decoration =
    design && !isScene ? '' : design ? decorationSvg(design) : '';
  void decoration;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escapeXml(plainTitle)}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${background}"/>
  <rect width="${WIDTH}" height="10" fill="${accent}"/>
  ${design ? decorationSvg(design) : ''}
  <text x="120" y="80" font-family="Inter,Arial,sans-serif" font-size="22" letter-spacing="3" fill="${muted}">SLIDE ${index + 1} / ${total}</text>
  ${contentSvg}
</svg>`;
}

export function renderSceneSvg(
  scene: SlideScene,
  index: number,
  total: number,
  design: SlideDesign,
): string {
  const plainTitle = truncate(scene.title || `Slide ${index + 1}`, 90);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escapeXml(plainTitle)}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${design.background}"/>
  <rect width="${WIDTH}" height="10" fill="${design.primary}"/>
  ${decorationSvg(design)}
  <text x="120" y="80" font-family="${escapeXml(fontFamilyFor(design.fontBody, 'body'))}" font-size="22" letter-spacing="3" fill="${design.muted}">SLIDE ${index + 1} / ${total}</text>
  ${renderSceneSlide(scene, index, total, design)}
</svg>`;
}

function toDeck(content: unknown): SlideDeck {
  return resolveSlideDeck(content);
}

export function buildSlidePreviews(content: unknown): {
  slideId: string;
  svg: string;
}[] {
  if (!content || typeof content !== 'object') return [];
  const deck = toDeck(content);
  if (!Array.isArray(deck.slides)) return [];
  return deck.slides.map((scene, index) => ({
    slideId: scene.id,
    svg: renderSceneSvg(scene, index, deck.slides.length, deck.design),
  }));
}

export function withSlidePreviews<T extends Record<string, unknown>>(
  validated: T,
): T {
  const deck = toDeck(validated);
  const previews = deck.slides.map((scene, index) => ({
    slideId: scene.id,
    svg: renderSceneSvg(scene, index, deck.slides.length, deck.design),
  }));
  return {
    ...(validated as object),
    design: deck.design,
    slides: deck.slides,
    previews,
  } as unknown as T;
}
