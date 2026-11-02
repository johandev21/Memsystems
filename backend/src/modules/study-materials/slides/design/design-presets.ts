import {
  FALLBACK_FONT,
  SUPPORTED_FONTS,
  type SlideDesign,
  type SlideDesignPreset,
  type SupportedFont,
} from '../slides-design.types';
import { isRecord } from './design-values';

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export const DESIGN_PRESETS: Record<SlideDesignPreset, SlideDesign> = {
  dark: {
    preset: 'dark',
    background: '#0F172A',
    surface: '#1E293B',
    primary: '#38BDF8',
    secondary: '#818CF8',
    text: '#F8FAFC',
    muted: '#94A3B8',
    fontHeading: 'Inter',
    fontBody: 'Inter',
    radius: 'small',
    density: 'balanced',
    decoration: 'geometric',
  },
  light: {
    preset: 'light',
    background: '#FFFFFF',
    surface: '#F1F5F9',
    primary: '#0EA5E9',
    secondary: '#6366F1',
    text: '#0F172A',
    muted: '#64748B',
    fontHeading: 'Inter',
    fontBody: 'Inter',
    radius: 'small',
    density: 'balanced',
    decoration: 'minimal',
  },
  editorial: {
    preset: 'editorial',
    background: '#FDFBF7',
    surface: '#F5EFE6',
    primary: '#B45309',
    secondary: '#44403C',
    text: '#1C1917',
    muted: '#78716C',
    fontHeading: 'Georgia',
    fontBody: 'Inter',
    radius: 'none',
    density: 'airy',
    decoration: 'editorial',
  },
  academic: {
    preset: 'academic',
    background: '#FFFFFF',
    surface: '#EFF6FF',
    primary: '#1D4ED8',
    secondary: '#0F766E',
    text: '#111827',
    muted: '#6B7280',
    fontHeading: 'Times New Roman',
    fontBody: 'Arial',
    radius: 'none',
    density: 'dense',
    decoration: 'minimal',
  },
  technical: {
    preset: 'technical',
    background: '#020617',
    surface: '#0F172A',
    primary: '#22D3EE',
    secondary: '#A78BFA',
    text: '#E2E8F0',
    muted: '#94A3B8',
    fontHeading: 'Inter',
    fontBody: 'Inter',
    radius: 'large',
    density: 'dense',
    decoration: 'diagrammatic',
  },
  warm: {
    preset: 'warm',
    background: '#FFF7ED',
    surface: '#FFEDD5',
    primary: '#EA580C',
    secondary: '#DB2777',
    text: '#431407',
    muted: '#9A3412',
    fontHeading: 'Georgia',
    fontBody: 'Inter',
    radius: 'large',
    density: 'balanced',
    decoration: 'geometric',
  },
};

export function presetForThemeName(
  theme: string | undefined,
): SlideDesignPreset {
  switch (theme) {
    case 'light':
      return 'light';
    case 'accent':
      return 'warm';
    case 'editorial':
      return 'editorial';
    case 'academic':
      return 'academic';
    case 'technical':
      return 'technical';
    case 'warm':
      return 'warm';
    case 'dark':
    default:
      return 'dark';
  }
}

export function designForPreset(preset: SlideDesignPreset): SlideDesign {
  return { ...DESIGN_PRESETS[preset] };
}

function cleanHex(value: unknown): string | undefined {
  return typeof value === 'string' && HEX_RE.test(value) ? value : undefined;
}

function cleanFont(value: unknown): SupportedFont {
  if (
    typeof value === 'string' &&
    (SUPPORTED_FONTS as readonly string[]).includes(value)
  ) {
    return value as SupportedFont;
  }
  return FALLBACK_FONT;
}

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const channel = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function bestTextOn(background: string): string {
  const black = contrastRatio('#111827', background);
  const white = contrastRatio('#F8FAFC', background);
  return white >= black ? '#F8FAFC' : '#111827';
}

export function resolveDesign(input: unknown): SlideDesign {
  const record = isRecord(input) ? input : {};
  const presetName =
    typeof record.preset === 'string' && record.preset in DESIGN_PRESETS
      ? (record.preset as SlideDesignPreset)
      : undefined;
  const legacyTheme =
    typeof record.theme === 'string'
      ? presetForThemeName(record.theme)
      : undefined;
  const base = designForPreset(presetName ?? legacyTheme ?? 'dark');

  const pick = (key: keyof SlideDesign): string | undefined => {
    const v = record[key];
    if (key === 'primary' && !cleanHex(v) && cleanHex(record.accent)) {
      return cleanHex(record.accent);
    }
    return cleanHex(v);
  };

  const design: SlideDesign = {
    preset: presetName ?? legacyTheme ?? base.preset,
    background: pick('background') ?? base.background,
    surface: pick('surface') ?? base.surface,
    primary: pick('primary') ?? base.primary,
    secondary: pick('secondary') ?? base.secondary,
    text: pick('text') ?? base.text,
    muted: pick('muted') ?? base.muted,
    fontHeading: cleanFont(record.fontHeading),
    fontBody: cleanFont(record.fontBody),
    radius:
      record.radius === 'none' ||
      record.radius === 'small' ||
      record.radius === 'large' ||
      record.radius === 'pill'
        ? record.radius
        : base.radius,
    density:
      record.density === 'airy' ||
      record.density === 'balanced' ||
      record.density === 'dense'
        ? record.density
        : base.density,
    decoration:
      record.decoration === 'minimal' ||
      record.decoration === 'geometric' ||
      record.decoration === 'editorial' ||
      record.decoration === 'diagrammatic'
        ? record.decoration
        : base.decoration,
  };

  if (!isRecord(input) || input.fontHeading === undefined) {
    design.fontHeading = base.fontHeading;
  }
  if (!isRecord(input) || input.fontBody === undefined) {
    design.fontBody = base.fontBody;
  }

  if (contrastRatio(design.text, design.background) < 3) {
    design.text = bestTextOn(design.background);
  }
  if (contrastRatio(design.muted, design.background) < 2.2) {
    design.muted = design.text === '#F8FAFC' ? '#CBD5E1' : '#475569';
    if (contrastRatio(design.muted, design.background) < 2.2) {
      design.muted = bestTextOn(design.background);
    }
  }
  return design;
}
