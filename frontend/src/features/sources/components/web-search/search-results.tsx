import type { useWebSearch } from "../../hooks/use-web-search";
import { SearchResultsHeader } from "./search-results-header";
import { SearchResultsSummary } from "./search-results-summary";
import { SearchCandidateRow } from "./search-candidate-row";
import { SearchResultsFooter } from "./search-results-footer";

export interface SearchResultsProps {
  webSearch: ReturnType<typeof useWebSearch>;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  remainingSourceSlots: number;
  importedCount: number;
  failedUrls: string[];
  onClearResults: () => Promise<void>;
}

export function SearchResults({
  webSearch,
  expanded,
  onExpandedChange,
  remainingSourceSlots,
  importedCount,
  failedUrls,
  onClearResults,
}: SearchResultsProps) {
  const selectedCount = webSearch.selectedUrls.size;
  const selectableCount = Math.min(webSearch.candidates.length, remainingSourceSlots);
  const allSelectableSelected = selectableCount > 0 && selectedCount === selectableCount;

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <SearchResultsHeader
        candidatesCount={webSearch.candidates.length}
        remainingSourceSlots={remainingSourceSlots}
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

      <div className="max-h-72 overflow-y-auto p-1.5">
        {webSearch.candidates.map((candidate) => {
          const result = webSearch.importResults.get(candidate.url);
          const selected = webSearch.selectedUrls.has(candidate.url);
          const selectionDisabled =
            Boolean(result) ||
            webSearch.importing ||
            webSearch.clearing ||
            (!selected && selectedCount >= remainingSourceSlots);

          return (
            <SearchCandidateRow
              key={candidate.url}
              candidate={candidate}
              result={result}
              selected={selected}
              selectionDisabled={selectionDisabled}
              onToggleCandidate={webSearch.toggleCandidate}
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
