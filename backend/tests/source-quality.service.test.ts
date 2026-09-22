import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SOURCE_QUALITY_CONFIG,
  loadSourceQualityConfig,
  measureHtmlLinkDensity,
  qualityFailureOf,
  SourceQualityService,
} from '../src/modules/sources/source-quality.service';

const SUBSTANTIVE_ARTICLE = `
Epistemology is the branch of philosophy concerned with knowledge. Epistemologists study the nature,
origin, and scope of knowledge, epistemic justification, the rationality of belief, and various related
issues. Debates in epistemology are generally centered around four core areas: the philosophical analysis
of the nature of knowledge and how it relates to concepts such as truth, belief, and justification, the
problem of skepticism, the sources and criteria of justified belief, and the limits of knowledge. The
Gettier problem challenged the traditional view that justified true belief constitutes knowledge by
presenting counterexamples where a belief is both true and justified yet fails to count as genuine
knowledge. Contemporary epistemology also examines social dimensions of knowledge, including testimony,
peer disagreement, and the distribution of epistemic goods across communities. Philosophers disagree about
whether knowledge requires certainty, whether it can be analysed into simpler components, and how it
relates to practical action. These disagreements shape debates in science, law, education, and artificial
intelligence, where the reliability of belief-forming processes matters for everyday decisions.
`;

function navigationPage(linkCount = 80): string {
  return Array.from(
    { length: linkCount },
    (_, i) =>
      `[Chapter ${i} study guide summary notes](https://example.com/chapter-${i})`,
  ).join('\n');
}

describe('SourceQualityService', () => {
  const service = new SourceQualityService();

  it('degrades a navigation-only page as link-dense', () => {
    const assessment = service.assess({
      text: navigationPage(),
      markdown: navigationPage(),
    });

    expect(assessment.status).toBe('degraded');
    expect(assessment.reason).toBe('navigation');
    expect(assessment.score).toBe(0);
    expect(assessment.signals.linkDensity).toBeGreaterThan(0.9);
    expect(qualityFailureOf(assessment)).toEqual({
      code: 'quality_navigation',
      messageKey: 'errors.sources.quality.navigation',
    });
  });

  it('keeps a substantive article ready', () => {
    const assessment = service.assess({ text: SUBSTANTIVE_ARTICLE });

    expect(assessment.status).toBe('ready');
    expect(assessment.reason).toBeNull();
    expect(assessment.score).toBe(1);
    expect(assessment.signals.linkDensity).toBe(0);
    expect(assessment.signals.wordCount).toBeGreaterThan(100);
    expect(qualityFailureOf(assessment)).toBeNull();
  });

  it('keeps an article with a few inline links ready', () => {
    const text = `${SUBSTANTIVE_ARTICLE}\n\nSee [the Stanford Encyclopedia entry](https://plato.stanford.edu/entries/epistemology/) and [Wikipedia](https://en.wikipedia.org/wiki/Epistemology).`;
    const assessment = service.assess({ text, markdown: text });

    expect(assessment.status).toBe('ready');
    expect(assessment.signals.linkDensity).toBeLessThan(0.1);
  });

  it('degrades repeated boilerplate even without links', () => {
    const boilerplate = Array.from(
      { length: 20 },
      () =>
        'Sign up for our newsletter and never miss another update from the team today',
    ).join('\n');
    const unique = Array.from(
      { length: 6 },
      (_, i) => `Distinct closing paragraph number ${i} with a few more words`,
    ).join('\n');
    const assessment = service.assess({
      text: `${boilerplate}\n${unique}`,
    });

    expect(assessment.status).toBe('degraded');
    expect(assessment.reason).toBe('boilerplate');
    expect(assessment.signals.paywallHits).toBe(0);
  });

  it('degrades a paywall interstitial with little substance', () => {
    const assessment = service.assess({
      text: 'Subscribe to continue reading this premium story. Already a member? Sign in to continue reading.',
    });

    expect(assessment.status).toBe('degraded');
    expect(assessment.reason).toBe('paywall');
    expect(assessment.signals.paywallHits).toBeGreaterThan(0);
  });

  it('reads link density from precomputed HTML extraction when provided', () => {
    const assessment = service.assess({
      text: 'Navigation text',
      linkDensity: 0.95,
    });

    expect(assessment.signals.linkDensity).toBe(0.95);
    expect(assessment.status).toBe('degraded');
  });
});

describe('measureHtmlLinkDensity', () => {
  it('scores a navigation list as link-dense', () => {
    const html = `<ul>${Array.from(
      { length: 40 },
      (_, i) => `<li><a href="/c-${i}">Chapter ${i} study guide</a></li>`,
    ).join('')}</ul>`;

    expect(measureHtmlLinkDensity(html)).toBeGreaterThan(0.9);
  });

  it('scores prose with a couple of citations as low density', () => {
    const html = `<article><p>Epistemology studies the nature of knowledge and justified belief across many traditions and debates.</p><p>See <a href="https://example.com">the entry</a> for a survey.</p></article>`;

    expect(measureHtmlLinkDensity(html)).toBeLessThan(0.15);
  });
});

describe('loadSourceQualityConfig', () => {
  it('uses documented defaults when the environment is empty', () => {
    expect(loadSourceQualityConfig({})).toEqual(
      DEFAULT_SOURCE_QUALITY_CONFIG,
    );
  });

  it('reads thresholds from the environment and clamps them', () => {
    const config = loadSourceQualityConfig({
      SOURCE_QUALITY_THRESHOLD: '0.7',
      SOURCE_QUALITY_LINK_DENSITY_LIMIT: '1.4',
      SOURCE_QUALITY_PAYWALL_MAX_WORDS: 'not-a-number',
    });

    expect(config.threshold).toBe(0.7);
    expect(config.linkDensityLimit).toBe(1);
    expect(config.paywallMaxWords).toBe(
      DEFAULT_SOURCE_QUALITY_CONFIG.paywallMaxWords,
    );
  });
});
