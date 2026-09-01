import { describe, expect, it } from 'vitest';
import {
  isTabularFile,
  MAX_TABULAR_BYTES,
  TabularInspectorService,
} from '../src/modules/sources/tabular-inspector.service';
import { BadRequestError } from '../src/common/errors/domain-error';

describe('TabularInspectorService', () => {
  const inspector = new TabularInspectorService();

  describe('isTabularFile', () => {
    it('detects CSV, TSV, and XLSX extensions', () => {
      expect(isTabularFile(undefined, 'data.csv')).toBe(true);
      expect(isTabularFile(undefined, 'export.tsv')).toBe(true);
      expect(isTabularFile(undefined, 'table.tab')).toBe(true);
      expect(isTabularFile(undefined, 'financials.xlsx')).toBe(true);
      expect(isTabularFile(undefined, 'report.xls')).toBe(true);
      expect(isTabularFile('text/csv', 'unknown')).toBe(true);
      expect(
        isTabularFile(
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'file',
        ),
      ).toBe(true);
    });

    it('rejects non-tabular formats', () => {
      expect(isTabularFile(undefined, 'notes.md')).toBe(false);
      expect(isTabularFile(undefined, 'image.png')).toBe(false);
    });
  });

  describe('inspect', () => {
    it('validates a CSV buffer', () => {
      const csv = 'id,name,score\n1,Alice,95\n2,Bob,88\n';
      const result = inspector.inspect(
        Buffer.from(csv, 'utf-8'),
        'students.csv',
      );

      expect(result.fileName).toBe('students.csv');
      expect(result.format).toBe('csv');
      expect(result.fileSize).toBe(csv.length);
    });

    it('validates a TSV buffer', () => {
      const tsv = 'id\tname\tscore\n1\tAlice\t95\n';
      const result = inspector.inspect(
        Buffer.from(tsv, 'utf-8'),
        'students.tsv',
      );
      expect(result.format).toBe('tsv');
    });

    it('rejects empty buffer', () => {
      expect(() => inspector.inspect(Buffer.alloc(0))).toThrow(BadRequestError);
    });

    it('rejects oversized buffer > 100 MB', () => {
      const oversized = Buffer.alloc(MAX_TABULAR_BYTES + 1);
      expect(() => inspector.inspect(oversized)).toThrow(BadRequestError);
    });

    it('rejects XLSX with invalid ZIP header signature', () => {
      const corrupt = Buffer.from('NOT A ZIP FILE', 'utf-8');
      expect(() => inspector.inspect(corrupt, 'workbook.xlsx')).toThrow(
        BadRequestError,
      );
    });
  });
});
