import { describe, expect, it } from 'vitest';
import {
  composeNoEvidenceReply,
  noEvidenceMetadata,
  qualityReasonFromCode,
  type NoEvidenceContext,
} from '../src/modules/chat/chat-no-evidence';

function context(
  overrides: Partial<NoEvidenceContext> = {},
): NoEvidenceContext {
  return {
    degradedSources: [],
    unhelpfulSources: [],
    ...overrides,
  };
}

describe('qualityReasonFromCode', () => {
  it('maps the persisted quality error codes to their reason', () => {
    expect(qualityReasonFromCode('quality_navigation')).toBe('navigation');
    expect(qualityReasonFromCode('quality_boilerplate')).toBe('boilerplate');
    expect(qualityReasonFromCode('quality_paywall')).toBe('paywall');
  });

  it('returns null for non-quality codes', () => {
    expect(qualityReasonFromCode('extraction_failed')).toBeNull();
    expect(qualityReasonFromCode(null)).toBeNull();
  });
});

describe('composeNoEvidenceReply', () => {
  it('states the abstention even when no source can be named', () => {
    const reply = composeNoEvidenceReply(context(), 'en');

    expect(reply).toContain('could not find usable material');
    expect(reply).toContain('Suggested fix');
  });

  it('names degraded sources with their quality reason in English', () => {
    const reply = composeNoEvidenceReply(
      context({
        degradedSources: [
          {
            id: 'source-1',
            title: 'Beyond Good and Evil Summary',
            reason: 'navigation',
          },
        ],
      }),
      'en',
    );

    expect(reply).toContain('Beyond Good and Evil Summary');
    expect(reply).toContain('links or navigation');
    expect(reply).toContain('Suggested fix: import the file version or paste the source text');
  });

  it('names a degraded paywall source with the paywall phrasing', () => {
    const reply = composeNoEvidenceReply(
      context({
        degradedSources: [
          { id: 'source-2', title: 'Members only', reason: 'paywall' },
        ],
      }),
      'en',
    );

    expect(reply).toContain('Members only');
    expect(reply).toContain('paywall');
  });

  it('names unhelpful sources that matched nothing', () => {
    const reply = composeNoEvidenceReply(
      context({
        unhelpfulSources: [{ id: 'source-3', title: 'Lecture notes' }],
      }),
      'en',
    );

    expect(reply).toContain('Lecture notes');
    expect(reply).not.toContain('links or navigation');
  });

  it('replies in Spanish when requested', () => {
    const reply = composeNoEvidenceReply(
      context({
        degradedSources: [
          {
            id: 'source-1',
            title: 'Resumen de Más allá del bien y del mal',
            reason: 'navigation',
          },
        ],
        unhelpfulSources: [{ id: 'source-3', title: 'Apuntes' }],
      }),
      'es',
    );

    expect(reply).toContain('material utilizable');
    expect(reply).toContain('Resumen de Más allá del bien y del mal');
    expect(reply).toContain('Apuntes');
    expect(reply).toContain('Corrección sugerida');
  });

  it('falls back to English for unknown languages', () => {
    const reply = composeNoEvidenceReply(context(), 'fr');

    expect(reply).toContain('could not find usable material');
  });
});

describe('noEvidenceMetadata', () => {
  it('captures the abstention reason and the named sources', () => {
    const metadata = noEvidenceMetadata(
      context({
        degradedSources: [
          {
            id: 'source-1',
            title: 'Beyond Good and Evil Summary',
            reason: 'navigation',
          },
        ],
        unhelpfulSources: [{ id: 'source-3', title: 'Lecture notes' }],
      }),
      'below_threshold',
    );

    expect(metadata).toEqual({
      abstentionReason: 'below_threshold',
      degradedSources: [
        {
          id: 'source-1',
          title: 'Beyond Good and Evil Summary',
          reason: 'navigation',
        },
      ],
      unhelpfulSources: [{ id: 'source-3', title: 'Lecture notes' }],
    });
  });

  it('reports an empty notebook outcome', () => {
    expect(noEvidenceMetadata(context(), 'no_indexed_chunks')).toEqual({
      abstentionReason: 'no_indexed_chunks',
      degradedSources: [],
      unhelpfulSources: [],
    });
  });
});
