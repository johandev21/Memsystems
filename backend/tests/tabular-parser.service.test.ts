import { describe, expect, it } from 'vitest';
import {
  parseDelimitedText,
  sniffDelimiter,
  TabularParserService,
} from '../src/modules/sources/tabular-parser.service';
import { BadRequestError } from '../src/common/errors/domain-error';

describe('TabularParserService', () => {
  const parser = new TabularParserService();

  describe('sniffDelimiter', () => {
    it('detects comma, tab, semicolon, and pipe delimiters', () => {
      expect(sniffDelimiter('a,b,c\n1,2,3\n4,5,6')).toBe(',');
      expect(sniffDelimiter('a\tb\tc\n1\t2\t3\n4\t5\t6')).toBe('\t');
      expect(sniffDelimiter('a;b;c\n1;2;3\n4;5;6')).toBe(';');
      expect(sniffDelimiter('a|b|c\n1|2|3\n4|5|6')).toBe('|');
    });
  });

  describe('parseDelimitedText (RFC 4180)', () => {
    it('handles quoted fields with commas and escaped quotes', () => {
      const csv = [
        'id,name,description,price',
        '1,"Product, A","High quality ""deluxe"" item",19.99',
        '2,"Product B","Line 1\nLine 2",29.50',
      ].join('\n');

      const rows = parseDelimitedText(csv, ',');
      expect(rows).toHaveLength(3);
      expect(rows[0]).toEqual(['id', 'name', 'description', 'price']);
      expect(rows[1]).toEqual([
        '1',
        'Product, A',
        'High quality "deluxe" item',
        '19.99',
      ]);
      expect(rows[2][1]).toBe('Product B');
      expect(rows[2][2]).toBe('Line 1\nLine 2');
    });
  });

  describe('parse', () => {
    it('profiles column types, min/max, summary statistics, and markdown table', () => {
      const csv = [
        'EmployeeId,Name,Department,Salary,HireDate,Active',
        '101,Alice Smith,Engineering,125000,2021-03-15,true',
        '102,Bob Jones,Marketing,85000,2022-06-01,true',
        '103,Charlie Brown,Engineering,140000,2019-11-20,false',
        '104,Diana Prince,Product,,2023-01-10,true',
      ].join('\n');

      const result = parser.parse(csv, 'employees.csv');

      expect(result.fileName).toBe('employees.csv');
      expect(result.title).toBe('employees');
      expect(result.format).toBe('csv');
      expect(result.totalRows).toBe(4);
      expect(result.totalColumns).toBe(6);
      expect(result.sheetCount).toBe(1);

      const sheet = result.sheets[0];
      expect(sheet.headers).toEqual([
        'EmployeeId',
        'Name',
        'Department',
        'Salary',
        'HireDate',
        'Active',
      ]);

      // Column profiles
      const colMap = new Map(sheet.columns.map((c) => [c.name, c]));
      expect(colMap.get('EmployeeId')?.type).toBe('number');
      expect(colMap.get('Name')?.type).toBe('string');
      expect(colMap.get('Salary')?.type).toBe('number');
      expect(colMap.get('Salary')?.min).toBe(85000);
      expect(colMap.get('Salary')?.max).toBe(140000);
      expect(colMap.get('Salary')?.nullCount).toBe(1);
      expect(colMap.get('HireDate')?.type).toBe('date');
      expect(colMap.get('Active')?.type).toBe('boolean');

      // Markdown preview
      expect(sheet.markdownTable).toContain(
        '| EmployeeId | Name | Department |',
      );
      expect(sheet.markdownTable).toContain(
        '| 101 | Alice Smith | Engineering |',
      );

      expect(result.rawText).toContain('**Dimensions:** 4 rows × 6 columns');
    });

    it('parses TSV formatted datasets', () => {
      const tsv =
        'City\tPopulation\tCountry\nTokyo\t37400000\tJapan\nParis\t2161000\tFrance';
      const result = parser.parse(tsv, 'cities.tsv');

      expect(result.format).toBe('tsv');
      expect(result.totalRows).toBe(2);
      expect(result.sheets[0].headers).toEqual([
        'City',
        'Population',
        'Country',
      ]);
    });

    it('rejects empty tabular data', () => {
      expect(() => parser.parse('', 'empty.csv')).toThrow(BadRequestError);
    });
  });
});
