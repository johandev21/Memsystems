import type { useWebSearch } from "../../hooks/use-web-search";
import { SearchResultsHeader } from "./search-results-header";
import { SearchResultsSummary } from "./search-results-summary";
import { SearchCandidateRow } from "./search-candidate-row";
import { SearchResultsFooter } from "./search-results-footer";

export interface SearchResultsProps {
  webSearch: ReturnType<typeof useWebSearch>;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  importedCount: number;
  failedUrls: string[];
  onClearResults: () => Promise<void>;
}

export function SearchResults({
  webSearch,
  expanded,
  onExpandedChange,
  importedCount,
  failedUrls,
  onClearResults,
}: SearchResultsProps) {
  const selectedCount = webSearch.selectedUrls.size;
  const selectableCount = webSearch.candidates.length;
  const allSelectableSelected = selectableCount > 0 && selectedCount === selectableCount;

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <SearchResultsHeader
        candidatesCount={webSearch.candidates.length}
        selectedCount={selectedCount}
        allSelectableSelected={allSelectableSelected}
        selectableCount={selectableCount}
        importing={webSearch.importing}
        clearing={webSearch.clearing}
        onClearResults={onClearResults}
        onToggleSelectAll={() =>
          allSelectableSelected ? webSearch.clearSelection() : webSearch.selectAllCandidates()
        }
      />

      {webSearch.summary && (
        <SearchResultsSummary
          summary={webSearch.summary}
          expanded={expanded}
          onExpandedChange={onExpandedChange}
        />
      )}

      <div className="flex flex-col max-h-72 overflow-y-auto p-1.5 gap-2">
        {webSearch.candidates.map((candidate) => {
          const result = webSearch.importResults.get(candidate.url);
          const selected = webSearch.selectedUrls.has(candidate.url);
          const selectionDisabled = Boolean(result) || webSearch.importing || webSearch.clearing;

          return (
            <SearchCandidateRow
              key={candidate.url}
              candidate={candidate}
              result={result}
              selected={selected}
              selectionDisabled={selectionDisabled}
              busy={webSearch.importing || webSearch.clearing}
              onToggleCandidate={webSearch.toggleCandidate}
              onDismissCandidate={webSearch.dismissCandidate}
            />
          );
        })}
      </div>

      <SearchResultsFooter
        hasImportResults={webSearch.importResults.size > 0}
        selectedCount={selectedCount}
        importedCount={importedCount}
        failedUrls={failedUrls}
        importing={webSearch.importing}
        clearing={webSearch.clearing}
        onRetryFailed={webSearch.retryFailed}
        onImportSelected={webSearch.importSelected}
      />
    </div>
  );
}
