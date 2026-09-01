import { Injectable } from '@nestjs/common';
import { BadRequestError } from '../../common/errors/domain-error';

export function getFileExtension(filename?: string | null): string {
  if (!filename) return '';
  const clean = filename.split('?')[0].split('#')[0];
  const lastDot = clean.lastIndexOf('.');
  if (lastDot === -1 || lastDot === clean.length - 1) return '';
  return clean.slice(lastDot + 1).toLowerCase();
}

export const MAX_TABULAR_BYTES = 100 * 1024 * 1024; // 100 MB

export const TABULAR_EXTENSIONS = new Set([
  'csv',
  'tsv',
  'tab',
  'xlsx',
  'xls',
  'ods',
]);

export const TABULAR_MIME_TYPES = new Set([
  'text/csv',
  'text/tab-separated-values',
  'text/tsv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/x-excel',
  'application/vnd.oasis.opendocument.spreadsheet',
]);

export function isTabularFile(
  contentType?: string | null,
  fileName?: string | null,
): boolean {
  const ext = getFileExtension(fileName);
  if (ext && TABULAR_EXTENSIONS.has(ext)) return true;

  if (contentType) {
    const cleanCt = contentType.split(';')[0].trim().toLowerCase();
    if (TABULAR_MIME_TYPES.has(cleanCt)) return true;
  }

  return false;
}

export interface InspectedTabularFile {
  fileName: string;
  format: 'csv' | 'tsv' | 'xlsx' | 'spreadsheet';
  fileSize: number;
}

const LOCAL_FILE_HEADER_SIG = 0x04034b50;

@Injectable()
export class TabularInspectorService {
  /**
   * Validates size, format extensions, and ZIP header for XLSX workbooks.
   */
  inspect(
    buffer: Buffer,
    fileName = 'dataset.csv',
    contentType?: string,
  ): InspectedTabularFile {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestError('Tabular dataset file is empty.');
    }

    if (buffer.length > MAX_TABULAR_BYTES) {
      const sizeMb = (buffer.length / (1024 * 1024)).toFixed(1);
      throw new BadRequestError(
        `Tabular file exceeds maximum limit of 100 MB (received ${sizeMb} MB).`,
      );
    }

    const ext = getFileExtension(fileName);
    let format: 'csv' | 'tsv' | 'xlsx' | 'spreadsheet' = 'csv';

    if (
      ext === 'tsv' ||
      ext === 'tab' ||
      contentType?.includes('tab-separated-values')
    ) {
      format = 'tsv';
    } else if (ext === 'xlsx' || contentType?.includes('spreadsheetml')) {
      format = 'xlsx';
      if (
        buffer.length < 4 ||
        buffer.readUInt32LE(0) !== LOCAL_FILE_HEADER_SIG
      ) {
        throw new BadRequestError(
          'Corrupt XLSX file: missing valid OpenXML ZIP header signature.',
        );
      }
    } else if (ext === 'xls' || ext === 'ods') {
      format = 'spreadsheet';
    }

    return {
      fileName,
      format,
      fileSize: buffer.length,
    };
  }
}
