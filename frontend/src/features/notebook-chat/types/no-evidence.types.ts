export type NoEvidenceQualityReason = "navigation" | "boilerplate" | "paywall";

export interface NoEvidenceDegradedSource {
  id: string;
  title: string;
  reason: NoEvidenceQualityReason | null;
}

export interface NoEvidenceSourceRef {
  id: string;
  title: string;
}

export interface NoEvidenceMetadata {
  abstentionReason: "no_indexed_chunks" | "below_threshold";
  degradedSources: NoEvidenceDegradedSource[];
  unhelpfulSources: NoEvidenceSourceRef[];
}

const KNOWN_QUALITY_REASONS: ReadonlySet<string> = new Set([
  "navigation",
  "boilerplate",
  "paywall",
]);

function degradedSourceOf(raw: unknown): NoEvidenceDegradedSource | null {
  if (!raw || typeof raw !== "object") return null;
  const { id, title, reason } = raw as Record<string, unknown>;
  if (typeof id !== "string" || typeof title !== "string") return null;
  return {
    id,
    title,
    reason:
      typeof reason === "string" && KNOWN_QUALITY_REASONS.has(reason)
        ? (reason as NoEvidenceQualityReason)
        : null,
  };
}

function unhelpfulSourceOf(raw: unknown): NoEvidenceSourceRef | null {
  if (!raw || typeof raw !== "object") return null;
  const { id, title } = raw as Record<string, unknown>;
  if (typeof id !== "string" || typeof title !== "string") return null;
  return { id, title };
}

/**
 * Extracts the no-evidence metadata block from an assistant message
 * metadata object, so the UI can render the distinct abstention state
 * instead of a source-grounded reply. Returns null for every other message.
 * Malformed entries are dropped instead of rendering raw i18n keys.
 */
export function noEvidenceMetadataOf(metadata: unknown): NoEvidenceMetadata | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const block = (metadata as { noEvidence?: unknown }).noEvidence;
  if (!block || typeof block !== "object" || Array.isArray(block)) return null;
  const { abstentionReason, degradedSources, unhelpfulSources } = block as Record<string, unknown>;
  if (
    !(
      (abstentionReason === "no_indexed_chunks" || abstentionReason === "below_threshold") &&
      Array.isArray(degradedSources) &&
      Array.isArray(unhelpfulSources)
    )
  ) {
    return null;
  }
  const degraded = degradedSources
    .map(degradedSourceOf)
    .filter((source): source is NoEvidenceDegradedSource => source !== null);
  const unhelpful = unhelpfulSources
    .map(unhelpfulSourceOf)
    .filter((source) => source !== null);
  return {
    abstentionReason,
    degradedSources: degraded,
    unhelpfulSources: unhelpful,
  };
}
