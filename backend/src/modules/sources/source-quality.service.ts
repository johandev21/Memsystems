import { Inject, Injectable, Optional } from '@nestjs/common';
import { JSDOM } from 'jsdom';
import type {
  SourceQualityAssessment,
  SourceQualityReason,
  SourceQualitySignals,
} from '../../database/schema';

export interface SourceQualityConfig {
  threshold: number;
  linkDensityLimit: number;
  linkDensityMinWords: number;
  repetitionLimit: number;
  repetitionMinWords: number;
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

export interface SourceQualityFailure {
  code: string;
  messageKey: string;
}

export const UNKNOWN_QUALITY_FAILURE: SourceQualityFailure = {
  code: 'content_quality',
  messageKey: 'errors.sources.quality.unknown',
};

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

export function wordTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}_'-]+/u)
    .filter((token) => token.length >= 2);
}

function wordsIn(text: string): number {
  return wordTokens(text).length;
}

export function measureTextLinkDensity(text: string): number {
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

export function measureElementLinkDensity(element: Element): number {
  const total = wordsIn(element.textContent ?? '');
  if (total === 0) return 0;
  let linkWords = 0;
  element.querySelectorAll('a').forEach((anchor) => {
    linkWords += wordsIn(anchor.textContent ?? '');
  });
  return round(clamp01(linkWords / total));
}

export function measureHtmlLinkDensity(html: string): number {
  if (!html || !html.trim()) return 0;
  const dom = new JSDOM(html);
  const body = dom.window.document.body;
  if (!body) return 0;
  return measureElementLinkDensity(body);
}

export function qualityFailureOf(
  assessment: SourceQualityAssessment,
): SourceQualityFailure | null {
  if (assessment.status !== 'degraded') return null;
  const reason = assessment.reason;
  if (!reason) return UNKNOWN_QUALITY_FAILURE;
  return {
    code: `quality_${reason}`,
    messageKey: `errors.sources.quality.${reason}`,
  };
}

export function qualityFailureLifecycle(failure: SourceQualityFailure): {
  processingStatus: 'degraded';
  processingStage: null;
  processingErrorCode: string;
  processingErrorMessage: string;
} {
  return {
    processingStatus: 'degraded',
    processingStage: null,
    processingErrorCode: failure.code,
    processingErrorMessage: failure.messageKey,
  };
}

export function qualityLifecycleValues(failure: SourceQualityFailure | null): {
  processingStatus: 'degraded' | 'processing';
  processingStage: 'indexing' | null;
  processingErrorCode: string | null;
  processingErrorMessage: string | null;
} {
  if (failure) return qualityFailureLifecycle(failure);
  return {
    processingStatus: 'processing',
    processingStage: 'indexing',
    processingErrorCode: null,
    processingErrorMessage: null,
  };
}

export interface QualityAssessableDocument {
  text: string;
  markdown?: string;
  linkDensity?: number;
}

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
      : measureTextLinkDensity(text);

    const signals: SourceQualitySignals = {
      wordCount,
      linkDensity: round(clamp01(linkDensity)),
      repetitionRatio: round(clamp01(repeatedLineRatio(text))),
      paywallHits: countPaywallHits(text),
    };

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
        paywallPenalty > 0 &&
        paywallPenalty >= linkPenalty &&
        paywallPenalty >= repetitionPenalty
      ) {
        reason = 'paywall';
      } else if (linkPenalty > 0 && linkPenalty >= repetitionPenalty) {
        reason = 'navigation';
      } else if (repetitionPenalty > 0) {
        reason = 'boilerplate';
      }
    }

    return { status, score, reason, signals };
  }
}
