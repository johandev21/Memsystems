import type { RetrievalAbstentionReason } from '../ai/retrieval.service';
import type { SourceQualityReason } from '../../database/schema';

/** A source the no-evidence reply names as unhelpful. */
export interface NoEvidenceSourceRef {
  id: string;
  title: string;
}

/** A degraded source named in the no-evidence reply. */
export interface NoEvidenceDegradedSource extends NoEvidenceSourceRef {
  /** The quality reason behind the degraded state, when known. */
  reason: SourceQualityReason | null;
}

/** Everything the no-evidence reply needs to name. */
export interface NoEvidenceContext {
  degradedSources: NoEvidenceDegradedSource[];
  unhelpfulSources: NoEvidenceSourceRef[];
}

/** The persisted metadata block that drives the distinct no-evidence UI. */
export interface NoEvidenceMetadata {
  abstentionReason: RetrievalAbstentionReason;
  degradedSources: NoEvidenceDegradedSource[];
  unhelpfulSources: NoEvidenceSourceRef[];
}

/** Maps the persisted `quality_<reason>` error code to its reason. */
const QUALITY_REASON_BY_CODE: Record<string, SourceQualityReason> = {
  quality_navigation: 'navigation',
  quality_boilerplate: 'boilerplate',
  quality_paywall: 'paywall',
};

export function qualityReasonFromCode(
  code: string | null | undefined,
): SourceQualityReason | null {
  return (code && QUALITY_REASON_BY_CODE[code]) || null;
}

interface NoEvidenceTemplate {
  title: string;
  degradedHeader: string;
  degradedReasons: Record<SourceQualityReason, string>;
  degradedReasonFallback: string;
  unhelpfulHeader: string;
  unhelpfulLine: string;
  closing: string;
}

const ENGLISH: NoEvidenceTemplate = {
  title:
    'I could not find usable material in this Notebook to answer that question.',
  degradedHeader: 'Sources with no usable content:',
  degradedReasons: {
    navigation: 'most of it is links or navigation',
    boilerplate: 'most of it repeats the same boilerplate',
    paywall: 'most of it is a paywall or sign-in message',
  },
  degradedReasonFallback: 'it has no usable reading material',
  unhelpfulHeader: 'Sources without matching content:',
  unhelpfulLine: '- "{title}" — nothing matched the question.',
  closing:
    'Suggested fix: import the file version or paste the source text, then try again.',
};

const SPANISH: NoEvidenceTemplate = {
  title:
    'No pude encontrar material utilizable en este Notebook para responder esa pregunta.',
  degradedHeader: 'Fuentes sin contenido utilizable:',
  degradedReasons: {
    navigation: 'la mayoría son enlaces o navegación',
    boilerplate: 'la mayoría repite el mismo texto genérico',
    paywall: 'la mayoría es un muro de pago o un mensaje de inicio de sesión',
  },
  degradedReasonFallback: 'no tiene material de lectura utilizable',
  unhelpfulHeader: 'Fuentes sin contenido coincidente:',
  unhelpfulLine: '- "{title}" — nada coincide con la pregunta.',
  closing:
    'Corrección sugerida: importa la versión en archivo o pega el texto de la fuente, y vuelve a intentarlo.',
};

const TEMPLATES: Record<string, NoEvidenceTemplate> = {
  en: ENGLISH,
  es: SPANISH,
};

function templateFor(language?: string | null): NoEvidenceTemplate {
  const base = language?.split('-')[0].toLowerCase();
  return (base && TEMPLATES[base]) || ENGLISH;
}

function degradedPhrase(
  template: NoEvidenceTemplate,
  reason: SourceQualityReason | null,
): string {
  return (
    (reason && template.degradedReasons[reason]) ||
    template.degradedReasonFallback
  );
}

/**
 * Composes the deterministic no-evidence reply. The Chat shows this text
 * instead of an answer when retrieval abstains, naming the degraded or
 * unhelpful sources and offering a corrective action — never a
 * general-knowledge answer presented as grounded.
 */
export function composeNoEvidenceReply(
  context: NoEvidenceContext,
  language?: string | null,
): string {
  const template = templateFor(language);
  const paragraphs: string[] = [template.title];

  if (context.degradedSources.length > 0) {
    const lines = context.degradedSources.map(
      (source) =>
        `- "${source.title}" — ${degradedPhrase(template, source.reason)}.`,
    );
    paragraphs.push(`${template.degradedHeader}\n${lines.join('\n')}`);
  }

  if (context.unhelpfulSources.length > 0) {
    const lines = context.unhelpfulSources.map((source) =>
      template.unhelpfulLine.replace('{title}', source.title),
    );
    paragraphs.push(`${template.unhelpfulHeader}\n${lines.join('\n')}`);
  }

  paragraphs.push(template.closing);
  return paragraphs.join('\n\n');
}

/** Builds the metadata block persisted with a no-evidence assistant message. */
export function noEvidenceMetadata(
  context: NoEvidenceContext,
  abstentionReason: RetrievalAbstentionReason,
): NoEvidenceMetadata {
  return {
    abstentionReason,
    degradedSources: context.degradedSources.map((source) => ({
      id: source.id,
      title: source.title,
      reason: source.reason,
    })),
    unhelpfulSources: context.unhelpfulSources.map((source) => ({
      id: source.id,
      title: source.title,
    })),
  };
}
