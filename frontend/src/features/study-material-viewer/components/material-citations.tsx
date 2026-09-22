import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { sourcesQueryOptions } from "@/features/sources/api/sources";
import { readMaterialCitations, type CitationReference } from "@/shared/citations/citation";
import { CitationChipRow } from "@/shared/citations/citation-popover";

/**
 * The shared citation surface for generated Study Materials. It renders the
 * citations the server attached to the material's content, whatever the kind,
 * so a grounded material is traceable from the viewer instead of leaving
 * `[ref:Rn]` markers in the prose.
 *
 * A material without citations renders nothing and never mounts the source
 * query, so the viewer works in contexts without a QueryClient.
 */
export function MaterialCitations({
  content,
  notebookId,
}: {
  content: unknown;
  notebookId: string;
}) {
  const citations = readMaterialCitations(content);
  if (citations.length === 0) return null;
  return <MaterialCitationList citations={citations} notebookId={notebookId} />;
}

function MaterialCitationList({
  citations,
  notebookId,
}: {
  citations: CitationReference[];
  notebookId: string;
}) {
  const { t } = useTranslation("viewer");
  const sources = useQuery(sourcesQueryOptions(notebookId));

  // Availability is upgraded from the notebook's source list once it loads,
  // matching the Chat's citation pills; until then the stored citation stands.
  const availableIds = sources.isSuccess ? new Set(sources.data.map((source) => source.id)) : null;
  const references = citations.map((citation) =>
    availableIds ? { ...citation, isAvailable: availableIds.has(citation.id) } : citation,
  );

  return (
    <section
      aria-label={t("citations.aria")}
      className="mt-8 space-y-2 border-t border-surface-border-subtle pt-4"
    >
      <h2 className="text-sm font-semibold text-text-secondary">{t("citations.title")}</h2>
      <CitationChipRow references={references} ariaLabel={t("citations.aria")} />
    </section>
  );
}
