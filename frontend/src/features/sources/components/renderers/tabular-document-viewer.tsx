import { useMemo, useState, useEffect } from "react";
import {
  Search,
  Table as TableIcon,
  ChevronLeft,
  ChevronRight,
  Database,
  Hash,
  Type,
  Calendar,
  ToggleLeft,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SourceWithContent, SourceSegmentLocator } from "../../types";
import { cn } from "@/shared/utils/cn";

interface TabularDocumentViewerProps {
  source: SourceWithContent;
  selectedLocator?: SourceSegmentLocator | null;
  scrollElement?: HTMLElement | null;
}

interface ParsedSheet {
  name: string;
  headers: string[];
  rows: string[][];
  dimensions?: string;
  columns?: { name: string; type: string }[];
}

function parseMarkdownTableOrDelimited(rawText: string): ParsedSheet[] {
  if (!rawText) return [];

  // Check if multiple sheets are demarcated with ## Sheet: Name
  const sheetSections = rawText.split(/(?=## Sheet:\s*)/i);
  const sheets: ParsedSheet[] = [];

  for (const section of sheetSections) {
    const lines = section
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;

    let sheetName = "Dataset";
    const titleMatch = lines[0].match(/## Sheet:\s*(.+)/i);
    if (titleMatch) {
      sheetName = titleMatch[1].trim();
    }

    // Look for markdown table lines starting with |
    const tableLines = lines.filter((l) => l.startsWith("|") && l.endsWith("|"));
    if (tableLines.length >= 2) {
      const headerLine = tableLines[0];
      const headers = headerLine
        .slice(1, -1)
        .split("|")
        .map((h) => h.trim());

      // Skip separator line (|---|---|)
      const dataLines = tableLines.slice(1).filter((l) => !/^\|[\s\-:|]+\|$/.test(l));
      const rows = dataLines.map((l) =>
        l
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim()),
      );

      sheets.push({
        name: sheetName,
        headers,
        rows,
      });
      continue;
    }

    // Fallback: simple CSV / TSV delimited text
    const delim = section.includes("\t") ? "\t" : ",";
    const rows = lines
      .filter((l) => !l.startsWith("#") && !l.startsWith("**"))
      .map((l) => l.split(delim).map((c) => c.trim().replace(/^"|"$/g, "")));

    if (rows.length > 0) {
      const headers = rows[0];
      const dataRows = rows.slice(1);
      sheets.push({
        name: sheetName,
        headers,
        rows: dataRows,
      });
    }
  }

  return sheets.length > 0 ? sheets : [{ name: "Dataset", headers: [], rows: [] }];
}

function inferFrontendType(val: string): "number" | "boolean" | "date" | "string" {
  if (!val) return "string";
  if (val.toLowerCase() === "true" || val.toLowerCase() === "false") return "boolean";
  if (!isNaN(Number(val)) && !isNaN(parseFloat(val))) return "number";
  if (!isNaN(Date.parse(val)) && val.length >= 8 && /\d{4}|\d{2}[-/]\d{2}/.test(val)) return "date";
  return "string";
}

export function TabularDocumentViewer({ source, selectedLocator }: TabularDocumentViewerProps) {
  const sheets = useMemo(() => parseMarkdownTableOrDelimited(source.rawText), [source.rawText]);

  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 30;

  // React to locator selection
  useEffect(() => {
    if (selectedLocator?.sheetName) {
      const idx = sheets.findIndex(
        (s) => s.name.toLowerCase() === selectedLocator.sheetName?.toLowerCase(),
      );
      if (idx !== -1) {
        setActiveSheetIndex(idx);
      }
    }
  }, [selectedLocator, sheets]);

  const activeSheet = sheets[activeSheetIndex] || sheets[0];

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return activeSheet.rows;
    const q = searchQuery.toLowerCase();
    return activeSheet.rows.filter((row) => row.some((cell) => cell.toLowerCase().includes(q)));
  }, [activeSheet.rows, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pageRows = filteredRows.slice(page * pageSize, (page + 1) * pageSize);

  // Column types inferred from first non-empty samples
  const columnTypes = useMemo(() => {
    return activeSheet.headers.map((_, colIdx) => {
      for (const row of activeSheet.rows.slice(0, 20)) {
        if (row[colIdx]) {
          return inferFrontendType(row[colIdx]);
        }
      }
      return "string";
    });
  }, [activeSheet.headers, activeSheet.rows]);

  return (
    <div className="w-full flex flex-col gap-4 font-sans text-foreground">
      {/* Top Banner & Metadata */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <TableIcon className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm leading-none">{source.title}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {activeSheet.rows.length} rows &bull; {activeSheet.headers.length} columns
              {selectedLocator?.cellRange && (
                <span className="ml-2 font-mono text-primary font-medium">
                  Locator: {selectedLocator.cellRange}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Filter table rows..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
            className="pl-9 h-9 text-xs bg-background"
          />
        </div>
      </div>

      {/* Multi-Sheet Selector Tabs */}
      {sheets.length > 1 && (
        <div className="flex items-center gap-1 border-b border-border/60 pb-1 overflow-x-auto">
          {sheets.map((sheet, index) => (
            <button
              key={sheet.name + index}
              type="button"
              onClick={() => {
                setActiveSheetIndex(index);
                setPage(0);
              }}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1.5",
                activeSheetIndex === index
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
              )}
            >
              <Database className="size-3.5" />
              <span>{sheet.name}</span>
              <Badge
                variant={activeSheetIndex === index ? "secondary" : "outline"}
                className="text-[10px] px-1 py-0 h-4"
              >
                {sheet.rows.length}
              </Badge>
            </button>
          ))}
        </div>
      )}

      {/* Interactive Table Container */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto max-h-[600px] overscroll-contain">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10 border-b border-border/60">
              <tr>
                <th className="px-3 py-2.5 w-12 text-center text-muted-foreground font-mono font-normal border-r border-border/30 select-none">
                  #
                </th>
                {activeSheet.headers.map((header, colIdx) => {
                  const colType = columnTypes[colIdx] || "string";
                  return (
                    <th
                      key={header + colIdx}
                      className="px-3 py-2.5 font-semibold text-foreground border-r border-border/30 last:border-r-0 whitespace-nowrap"
                    >
                      <div className="flex items-center gap-1.5">
                        {colType === "number" && <Hash className="size-3 text-blue-500 shrink-0" />}
                        {colType === "string" && (
                          <Type className="size-3 text-muted-foreground shrink-0" />
                        )}
                        {colType === "date" && (
                          <Calendar className="size-3 text-amber-500 shrink-0" />
                        )}
                        {colType === "boolean" && (
                          <ToggleLeft className="size-3 text-emerald-500 shrink-0" />
                        )}
                        <span>{header}</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono text-[11px]">
              {pageRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={activeSheet.headers.length + 1}
                    className="p-8 text-center text-muted-foreground"
                  >
                    No matching rows found.
                  </td>
                </tr>
              ) : (
                pageRows.map((row, rowIdx) => {
                  const globalRowIndex = page * pageSize + rowIdx + 1;
                  return (
                    <tr
                      key={rowIdx}
                      className={cn(
                        "hover:bg-muted/40 transition-colors",
                        rowIdx % 2 === 0 ? "bg-background" : "bg-muted/10",
                      )}
                    >
                      <td className="px-3 py-2 text-center text-muted-foreground select-none border-r border-border/30 bg-muted/20">
                        {globalRowIndex}
                      </td>
                      {activeSheet.headers.map((_, colIdx) => (
                        <td
                          key={colIdx}
                          className="px-3 py-2 text-foreground/90 border-r border-border/30 last:border-r-0 whitespace-nowrap max-w-xs truncate"
                          title={row[colIdx] ?? ""}
                        >
                          {row[colIdx] ?? ""}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Footer controls */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/60 bg-muted/20 text-xs text-muted-foreground">
          <span>
            Showing {filteredRows.length === 0 ? 0 : page * pageSize + 1}–
            {Math.min((page + 1) * pageSize, filteredRows.length)} of {filteredRows.length} rows
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-7"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="font-medium text-foreground">
              {page + 1} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-7"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              aria-label="Next page"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
