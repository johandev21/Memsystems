/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { Injectable } from '@nestjs/common';
import { BadRequestError } from '../../common/errors/domain-error';
import { parseZipEntries } from './zip-helpers';
import { getFileExtension } from './tabular-inspector.service';

export interface TabularColumnProfile {
  name: string;
  type: 'number' | 'string' | 'date' | 'boolean';
  nonNullCount: number;
  nullCount: number;
  uniqueSampleValues: string[];
  min?: number | string;
  max?: number | string;
}

export interface TabularSheetResult {
  sheetName: string;
  rowCount: number;
  columnCount: number;
  cellRange: string;
  headers: string[];
  columns: TabularColumnProfile[];
  sampleRows: string[][];
  markdownTable: string;
  rawText: string;
}

export interface ParsedTabularResult {
  fileName: string;
  title: string;
  format: 'csv' | 'tsv' | 'xlsx';
  totalRows: number;
  totalColumns: number;
  sheetCount: number;
  sheets: TabularSheetResult[];
  rawText: string;
}

/** Delimiter autodetection for delimited text */
export function sniffDelimiter(text: string): string {
  const lines = text
    .slice(0, 4096)
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .slice(0, 5);
  if (lines.length === 0) return ',';

  const delimiters = [',', '\t', ';', '|'];
  let bestDelim = ',';
  let maxCount = -1;

  for (const delim of delimiters) {
    const counts = lines.map((line) => line.split(delim).length);
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    // Check if consistent across lines
    const isConsistent = counts.every((c) => c === counts[0] && c > 1);
    if (isConsistent && avg > maxCount) {
      maxCount = avg;
      bestDelim = delim;
    } else if (avg > maxCount && maxCount === -1) {
      bestDelim = delim;
    }
  }

  return bestDelim;
}

/** RFC 4180 CSV / Delimited tokenizer */
export function parseDelimitedText(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\r') {
        if (nextChar === '\n') i++;
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  // Filter out trailing completely empty rows
  return rows.filter((r) => r.some((cell) => cell.length > 0));
}

function inferType(values: string[]): 'number' | 'string' | 'date' | 'boolean' {
  const nonEmpty = values.filter((v) => v.length > 0);
  if (nonEmpty.length === 0) return 'string';

  let numCount = 0;
  let boolCount = 0;
  let dateCount = 0;

  for (const v of nonEmpty) {
    const lower = v.toLowerCase();
    if (
      lower === 'true' ||
      lower === 'false' ||
      lower === 'yes' ||
      lower === 'no'
    ) {
      boolCount++;
    } else if (!isNaN(Number(v)) && !isNaN(parseFloat(v))) {
      numCount++;
    } else if (
      !isNaN(Date.parse(v)) &&
      v.length >= 8 &&
      /\d{4}|\d{2}[-/]\d{2}/.test(v)
    ) {
      dateCount++;
    }
  }

  const threshold = 0.8;
  if (numCount / nonEmpty.length >= threshold) return 'number';
  if (boolCount / nonEmpty.length >= threshold) return 'boolean';
  if (dateCount / nonEmpty.length >= threshold) return 'date';
  return 'string';
}

function profileColumns(
  headers: string[],
  rows: string[][],
): TabularColumnProfile[] {
  return headers.map((header, colIdx) => {
    const values = rows.map((r) => r[colIdx] ?? '');
    const nonEmpty = values.filter((v) => v.length > 0);
    const type = inferType(nonEmpty);

    const samples = Array.from(new Set(nonEmpty)).slice(0, 5);
    let min: number | string | undefined;
    let max: number | string | undefined;

    if (type === 'number') {
      const nums = nonEmpty.map(Number).filter((n) => !isNaN(n));
      if (nums.length > 0) {
        min = Math.min(...nums);
        max = Math.max(...nums);
      }
    }

    return {
      name: header || `Column_${colIdx + 1}`,
      type,
      nonNullCount: nonEmpty.length,
      nullCount: rows.length - nonEmpty.length,
      uniqueSampleValues: samples,
      min,
      max,
    };
  });
}

function buildMarkdownTable(
  headers: string[],
  rows: string[][],
  maxRows = 30,
): string {
  if (headers.length === 0 && rows.length === 0) return '';
  const head = `| ${headers.map((h) => h.replace(/\|/g, '\\|')).join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows
    .slice(0, maxRows)
    .map(
      (r) =>
        `| ${headers.map((_, i) => (r[i] ?? '').replace(/\|/g, '\\|')).join(' | ')} |`,
    )
    .join('\n');

  return `${head}\n${sep}\n${body}`;
}

/** Converts column letter like "A", "B", "Z", "AA", "AB" to 0-based index */
function colLetterToIndex(colStr: string): number {
  let index = 0;
  for (let i = 0; i < colStr.length; i++) {
    index = index * 26 + (colStr.charCodeAt(i) - 64);
  }
  return index - 1;
}

@Injectable()
export class TabularParserService {
  /**
   * Parses CSV, TSV, or XLSX tabular datasets into structured columns, types,
   * summary statistics, and markdown table views.
   */
  parse(input: Buffer | string, fileName = 'dataset.csv'): ParsedTabularResult {
    const ext = getFileExtension(fileName);
    const title = fileName.replace(/\.[a-z0-9]+$/i, '');

    if (ext === 'xlsx' && Buffer.isBuffer(input)) {
      return this.parseXlsxBuffer(input, fileName, title);
    }

    const rawText = typeof input === 'string' ? input : input.toString('utf-8');
    const format = ext === 'tsv' || ext === 'tab' ? 'tsv' : 'csv';
    const delimiter = format === 'tsv' ? '\t' : sniffDelimiter(rawText);

    const allRows = parseDelimitedText(rawText, delimiter);
    if (allRows.length === 0) {
      throw new BadRequestError('Tabular file contains no rows.', {
        messageKey: 'errors.sources.inspect.tabularEmpty',
      });
    }

    const headers = allRows[0];
    const dataRows = allRows.slice(1);
    const columns = profileColumns(headers, dataRows);
    const colCount = headers.length;
    const rowCount = dataRows.length;
    const cellRange = `A1:${String.fromCharCode(65 + Math.min(25, colCount - 1))}${rowCount + 1}`;

    const mdTable = buildMarkdownTable(headers, dataRows);
    const summaryText = [
      `# ${title}`,
      `**Dimensions:** ${rowCount} rows × ${colCount} columns`,
      `**Columns:** ${columns.map((c) => `${c.name} (${c.type})`).join(', ')}`,
      '',
      '### Data Preview',
      mdTable,
    ].join('\n');

    const sheetResult: TabularSheetResult = {
      sheetName: 'Sheet 1',
      rowCount,
      columnCount: colCount,
      cellRange,
      headers,
      columns,
      sampleRows: dataRows.slice(0, 50),
      markdownTable: mdTable,
      rawText: summaryText,
    };

    return {
      fileName,
      title,
      format,
      totalRows: rowCount,
      totalColumns: colCount,
      sheetCount: 1,
      sheets: [sheetResult],
      rawText: summaryText,
    };
  }

  /**
   * Parses OpenXML XLSX workbook archive using zip-helpers and XML parsing.
   */
  private parseXlsxBuffer(
    buffer: Buffer,
    fileName: string,
    title: string,
  ): ParsedTabularResult {
    let zip;
    try {
      zip = parseZipEntries(buffer);
    } catch (err: any) {
      throw new BadRequestError(
        `Failed to parse XLSX archive: ${err.message || 'corrupt zip'}`,
        { messageKey: 'errors.sources.parse.tabularCorrupted' },
      );
    }

    // 1. Parse Shared Strings
    const sharedStrings: string[] = [];
    const sharedStrBuf = zip.entries.get('xl/sharedStrings.xml');
    if (sharedStrBuf) {
      const xml = sharedStrBuf.toString('utf-8');
      const siMatches = xml.match(/<si>[\s\S]*?<\/si>/g) || [];
      for (const si of siMatches) {
        // Extract all <t>...</t> tags inside <si>
        const tMatches = si.match(/<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/g) || [];
        const text = tMatches
          .map((t) => t.replace(/<t(?:\s+[^>]*)?>|<\/t>/g, ''))
          .join('');
        sharedStrings.push(text);
      }
    }

    // 2. Parse Workbook Sheet Names
    const sheetMap: { name: string; path: string }[] = [];
    const wbBuf = zip.entries.get('xl/workbook.xml');
    if (wbBuf) {
      const wbXml = wbBuf.toString('utf-8');
      const sheetTags = wbXml.match(/<sheet\s+[^>]*\/>/g) || [];
      let sheetNum = 1;
      for (const tag of sheetTags) {
        const nameMatch = tag.match(/name="([^"]+)"/);
        const name = nameMatch ? nameMatch[1] : `Sheet${sheetNum}`;
        sheetMap.push({
          name,
          path: `xl/worksheets/sheet${sheetNum}.xml`,
        });
        sheetNum++;
      }
    }

    // Fallback if workbook sheet map is empty: look for all xl/worksheets/sheet*.xml
    if (sheetMap.length === 0) {
      for (const key of zip.entries.keys()) {
        if (/^xl\/worksheets\/sheet\d+\.xml$/i.test(key)) {
          const match = key.match(/sheet(\d+)\.xml/i);
          const num = match ? match[1] : '1';
          sheetMap.push({ name: `Sheet ${num}`, path: key });
        }
      }
    }

    const sheets: TabularSheetResult[] = [];
    let totalRows = 0;
    let maxCols = 0;

    for (const sheetEntry of sheetMap) {
      const sheetBuf = zip.entries.get(sheetEntry.path);
      if (!sheetBuf) continue;

      const xml = sheetBuf.toString('utf-8');
      const dimMatch = xml.match(/<dimension\s+ref="([^"]+)"/);
      const cellRange = dimMatch ? dimMatch[1] : 'A1';

      // Parse rows
      const rowMatches = xml.match(/<row\s+[^>]*>[\s\S]*?<\/row>/g) || [];
      const sheetRows: string[][] = [];

      for (const rowXml of rowMatches) {
        const cMatches =
          rowXml.match(/<c\s+[^>]*>[\s\S]*?<\/c>|<c\s+[^>]*\/>/g) || [];
        const rowCells: string[] = [];

        for (const c of cMatches) {
          const rMatch = c.match(/r="([A-Z]+)(\d+)"/);
          if (!rMatch) continue;

          const colLetter = rMatch[1];
          const colIdx = colLetterToIndex(colLetter);

          const tMatch = c.match(/t="([a-z]+)"/);
          const cellType = tMatch ? tMatch[1] : '';

          let val = '';
          const vMatch = c.match(/<v>([\s\S]*?)<\/v>/);
          if (vMatch) {
            val = vMatch[1];
            if (cellType === 's') {
              const strIdx = parseInt(val, 10);
              val = sharedStrings[strIdx] ?? val;
            }
          } else {
            // Inline string
            const isMatch = c.match(/<is><t>([\s\S]*?)<\/t><\/is>/);
            if (isMatch) val = isMatch[1];
          }

          // Expand row array to column index
          while (rowCells.length <= colIdx) {
            rowCells.push('');
          }
          rowCells[colIdx] = val;
        }

        if (rowCells.some((c) => c.length > 0)) {
          sheetRows.push(rowCells);
        }
      }

      if (sheetRows.length === 0) continue;

      const headers = sheetRows[0];
      const dataRows = sheetRows.slice(1);
      const columns = profileColumns(headers, dataRows);
      const rowCount = dataRows.length;
      const columnCount = headers.length;

      totalRows += rowCount;
      if (columnCount > maxCols) maxCols = columnCount;

      const mdTable = buildMarkdownTable(headers, dataRows);
      const summaryText = [
        `## Sheet: ${sheetEntry.name}`,
        `**Dimensions:** ${rowCount} rows × ${columnCount} columns (${cellRange})`,
        `**Columns:** ${columns.map((c) => `${c.name} (${c.type})`).join(', ')}`,
        '',
        '### Data Preview',
        mdTable,
      ].join('\n');

      sheets.push({
        sheetName: sheetEntry.name,
        rowCount,
        columnCount,
        cellRange,
        headers,
        columns,
        sampleRows: dataRows.slice(0, 50),
        markdownTable: mdTable,
        rawText: summaryText,
      });
    }

    if (sheets.length === 0) {
      throw new BadRequestError('XLSX workbook contains no readable sheets.', {
        messageKey: 'errors.sources.parse.tabularCorrupted',
      });
    }

    const compositeRawText = [
      `# ${title}`,
      `**Workbook Sheets:** ${sheets.length}`,
      ...sheets.map((s) => s.rawText),
    ].join('\n\n');

    return {
      fileName,
      title,
      format: 'xlsx',
      totalRows,
      totalColumns: maxCols,
      sheetCount: sheets.length,
      sheets,
      rawText: compositeRawText,
    };
  }
}
