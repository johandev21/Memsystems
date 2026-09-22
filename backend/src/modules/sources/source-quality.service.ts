import { Inject, Injectable, Optional } from '@nestjs/common';
import { JSDOM } from 'jsdom';
import type {
  SourceQualityAssessment,
  SourceQualityReason,
  SourceQualitySignals,
} from '../../database/schema';

/** Link density, repetition, and score thresholds used by the ingestion gate. */
export interface SourceQualityConfig {
  /** Minimum score for a source version to be ready. */
  threshold: number;
  /** Link density (0..1) that scores zero on its own. */
  linkDensityLimit: number;
  /** Below this word count, link density is not considered. */
  linkDensityMinWords: number;
  /** Repetition ratio (0..1) that scores zero on its own. */
  repetitionLimit: number;
  /** Below this word count, repetition is not considered. */
  repetitionMinWords: number;
  /** Below this word count, a paywall marker degrades the source. */
  paywallMaxWords: number;
}

export const DEFAULT_SOURCE_QUALITY_CONFIG: SourceQualityConfig = {
  threshold: 0.5,
  linkDensityLimit: 0.6,
  linkDensityMinWords: 30,
  repetitionLimit: 0.6,
  repetitionMinWords: 100,
  paywallMaxWords: 400,
};

export const SOURCE_QUALITY_CONFIG = 'SOURCE_QUALITY_CONFIG';

function numberEnv(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

/** Reads gate thresholds from the environment, falling back to the defaults. */
export function loadSourceQualityConfig(
  env: NodeJS.ProcessEnv = process.env,
): SourceQualityConfig {
  return {
    threshold: numberEnv(
      env.SOURCE_QUALITY_THRESHOLD,
      DEFAULT_SOURCE_QUALITY_CONFIG.threshold,
      0,
      1,
    ),
    linkDensityLimit: numberEnv(
      env.SOURCE_QUALITY_LINK_DENSITY_LIMIT,
      DEFAULT_SOURCE_QUALITY_CONFIG.linkDensityLimit,
      0.01,
      1,
    ),
    linkDensityMinWords: numberEnv(
      env.SOURCE_QUALITY_LINK_DENSITY_MIN_WORDS,
      DEFAULT_SOURCE_QUALITY_CONFIG.linkDensityMinWords,
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    repetitionLimit: numberEnv(
      env.SOURCE_QUALITY_REPETITION_LIMIT,
      DEFAULT_SOURCE_QUALITY_CONFIG.repetitionLimit,
      0.01,
      1,
    ),
    repetitionMinWords: numberEnv(
      env.SOURCE_QUALITY_REPETITION_MIN_WORDS,
      DEFAULT_SOURCE_QUALITY_CONFIG.repetitionMinWords,
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    paywallMaxWords: numberEnv(
      env.SOURCE_QUALITY_PAYWALL_MAX_WORDS,
      DEFAULT_SOURCE_QUALITY_CONFIG.paywallMaxWords,
      0,
      Number.MAX_SAFE_INTEGER,
    ),
  };
}

/** The failure persisted on a degraded source, used by the API and the UI. */
export interface SourceQualityFailure {
  code: string;
  messageKey: string;
}

const PAYWALL_PATTERNS: RegExp[] = [
  /subscribe\s+(?:to|for)\s+(?:continue|keep)\s+reading/i,
  /subscribe\s+to\s+(?:read|continue|unlock)/i,
  /(?:sign|log)\s*in\s+to\s+(?:continue|read)/i,
  /create\s+(?:a\s+)?(?:free\s+)?account\s+to\s+(?:continue|read)/i,
  /this\s+(?:article|story|content|post)\s+is\s+(?:for|available\s+to)\s+(?:subscribers|members)/i,
  /you(?:'ve|\s+have)\s+reached\s+your\s+(?:free\s+)?(?:article|story)\s+limit/i,
  /enable\s+javascript/i,
];

const MARKDOWN_LINK_RE = /\[([^\]]*)\]\(([^)]*)\)/g;
const BARE_URL_RE = /https?:\/\/\S+/g;
function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Counts substantive words; single characters and pure punctuation are noise. */
export function wordTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}_'-]+/u)
    .filter((token) => token.length >= 2);
}

function wordsIn(text: string): number {
  return wordTokens(text).length;
}

/**
 * Link density of text that may carry Markdown links or bare URLs. The
 * denominator is the visible text (link targets are not visible words).
 */
function linkDensityOfText(text: string): number {
  let linkWords = 0;
  const withoutTargets = text.replace(
    MARKDOWN_LINK_RE,
    (_match, label: string) => {
      linkWords += wordsIn(label);
      return label;
    },
  );
  const withoutUrls = withoutTargets.replace(BARE_URL_RE, (url) => {
    linkWords += wordsIn(url);
    return ' ';
  });
  const total = wordsIn(withoutUrls);
  if (total === 0) return linkWords > 0 ? 1 : 0;
  return clamp01(linkWords / total);
}

function repeatedLineRatio(text: string): number {
  const counts = new Map<string, number>();
  let total = 0;
  for (const line of text.split('\n')) {
    const normalized = line.trim().replace(/\s+/g, ' ').toLowerCase();
    if (wordsIn(normalized) < 4) continue;
    total += 1;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  if (total === 0) return 0;
  let repeated = 0;
  for (const count of counts.values()) {
    if (count > 1) repeated += count - 1;
  }
  return repeated / total;
}

function countPaywallHits(text: string): number {
  let hits = 0;
  for (const pattern of PAYWALL_PATTERNS) {
    if (pattern.test(text)) hits += 1;
  }
  return hits;
}

/**
 * Word-based link density of rendered HTML: anchor words over total words.
 * Used by web extraction to decide whether the main-content heuristic picked
 * navigation instead of the article.
 */
export function measureHtmlLinkDensity(html: string): number {
  if (!html || !html.trim()) return 0;
  const dom = new JSDOM(html);
  const body = dom.window.document.body;
  if (!body) return 0;
  const total = wordsIn(body.textContent ?? '');
  if (total === 0) return 0;
  let linkWords = 0;
  body.querySelectorAll('a').forEach((anchor) => {
    linkWords += wordsIn(anchor.textContent ?? '');
  });
  return round(clamp01(linkWords / total));
}

export function qualityFailureOf(
  assessment: SourceQualityAssessment,
): SourceQualityFailure | null {
  if (assessment.status !== 'degraded') return null;
  const reason: SourceQualityReason = assessment.reason ?? 'navigation';
  return {
    code: `quality_${reason}`,
    messageKey: `errors.sources.quality.${reason}`,
  };
}

export interface QualityAssessableDocument {
  text: string;
  markdown?: string;
  /** Precomputed word-based density for HTML extractions that drop link markup. */
  linkDensity?: number;
}

/**
 * Scores an extracted document for content quality. A navigation-only page,
 * repeated boilerplate, or a paywall interstitial scores below the threshold
 * and must be marked degraded instead of indexed as Evidence.
 */
@Injectable()
export class SourceQualityService {
  private readonly config: SourceQualityConfig;

  constructor(
    @Optional()
    @Inject(SOURCE_QUALITY_CONFIG)
    config?: SourceQualityConfig,
  ) {
    this.config = config ?? DEFAULT_SOURCE_QUALITY_CONFIG;
  }

  assess(document: QualityAssessableDocument): SourceQualityAssessment {
    const text = (document.markdown?.trim() || document.text || '').trim();
    const wordCount = wordsIn(text);
    const measuredLinkDensity = document.linkDensity !== undefined;
    const linkDensity = measuredLinkDensity
      ? document.linkDensity!
      : linkDensityOfText(text);

    const signals: SourceQualitySignals = {
      wordCount,
      linkDensity: round(clamp01(linkDensity)),
      repetitionRatio: round(clamp01(repeatedLineRatio(text))),
      paywallHits: countPaywallHits(text),
    };

    // Text without markup does not reveal its links, so a short text is not
    // judged on density; a measured HTML density is always trusted.
    const linkPenalty =
      !measuredLinkDensity && wordCount < this.config.linkDensityMinWords
        ? 0
        : clamp01(linkDensity / this.config.linkDensityLimit);
    const repetitionPenalty =
      wordCount < this.config.repetitionMinWords
        ? 0
        : clamp01(signals.repetitionRatio / this.config.repetitionLimit);
    const paywallPenalty =
      signals.paywallHits > 0 && wordCount < this.config.paywallMaxWords
        ? 1
        : 0;

    const score = round(
      1 - Math.max(linkPenalty, repetitionPenalty, paywallPenalty),
    );
    const status = score >= this.config.threshold ? 'ready' : 'degraded';

    let reason: SourceQualityReason | null = null;
    if (status === 'degraded') {
      if (
        paywallPenalty >= linkPenalty &&
        paywallPenalty >= repetitionPenalty
      ) {
        reason = 'paywall';
      } else if (linkPenalty >= repetitionPenalty) {
        reason = 'navigation';
      } else {
        reason = 'boilerplate';
      }
    }

    return { status, score, reason, signals };
  }
}
