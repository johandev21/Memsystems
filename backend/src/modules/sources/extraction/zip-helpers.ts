import { inflateRawSync } from 'node:zlib';
import { BadRequestError } from '../../../common/errors/domain-error';

export interface ZipEntryInfo {
  fileName: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  isDirectory: boolean;
  data: Buffer;
}

export interface ParsedZip {
  entries: Map<string, Buffer>;
  entryInfos: ZipEntryInfo[];
  entryCount: number;
  totalCompressed: number;
  totalUncompressed: number;
}

const LOCAL_FILE_HEADER_SIG = 0x04034b50;
const CENTRAL_DIR_SIG = 0x02014b50;
const END_OF_CENTRAL_DIR_SIG = 0x06054b50;

export function parseZipEntries(buffer: Buffer): ParsedZip {
  if (!buffer || buffer.length < 4) {
    throw new BadRequestError('Corrupt ZIP header: buffer too small.', {
      messageKey: 'errors.sources.parse.zipCorrupted',
    });
  }
  if (buffer.readUInt32LE(0) !== LOCAL_FILE_HEADER_SIG) {
    throw new BadRequestError(
      'Corrupt ZIP header: missing PK\\x03\\x04 signature.',
      { messageKey: 'errors.sources.parse.zipCorrupted' },
    );
  }

  const entries = new Map<string, Buffer>();
  const entryInfos: ZipEntryInfo[] = [];
  let offset = 0;
  let totalCompressed = 0;
  let totalUncompressed = 0;
  let entryCount = 0;

  while (offset + 30 <= buffer.length) {
    const sig = buffer.readUInt32LE(offset);
    if (sig === CENTRAL_DIR_SIG || sig === END_OF_CENTRAL_DIR_SIG) {
      break;
    }
    if (sig !== LOCAL_FILE_HEADER_SIG) {
      break;
    }

    const flag = buffer.readUInt16LE(offset + 6);
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);

    if (offset + 30 + fileNameLen + extraLen > buffer.length) {
      throw new BadRequestError(
        'Corrupt ZIP header: truncated file name or extra field.',
        { messageKey: 'errors.sources.parse.zipCorrupted' },
      );
    }

    const fileName = buffer.toString(
      'utf8',
      offset + 30,
      offset + 30 + fileNameLen,
    );
    const dataStart = offset + 30 + fileNameLen + extraLen;

    if ((flag & 0x08) !== 0) {
      let nextHeader = -1;
      for (let i = dataStart; i + 4 <= buffer.length; i++) {
        const s = buffer.readUInt32LE(i);
        if (
          s === LOCAL_FILE_HEADER_SIG ||
          s === CENTRAL_DIR_SIG ||
          s === END_OF_CENTRAL_DIR_SIG
        ) {
          nextHeader = i;
          break;
        }
      }
      if (nextHeader === -1) {
        nextHeader = buffer.length;
      }
      const estimatedCompressed = nextHeader - dataStart;
      totalCompressed += estimatedCompressed;
      totalUncompressed += estimatedCompressed;
      entryCount++;
      entryInfos.push({
        fileName,
        compressionMethod: method,
        compressedSize: estimatedCompressed,
        uncompressedSize: estimatedCompressed,
        isDirectory: fileName.endsWith('/'),
        data: Buffer.alloc(0),
      });
      entries.set(fileName, Buffer.alloc(0));
      offset = nextHeader;
      continue;
    }

    if (dataStart + compressedSize > buffer.length) {
      throw new BadRequestError(
        `Corrupt ZIP entry "${fileName}": truncated compressed data.`,
        { messageKey: 'errors.sources.parse.zipCorrupted' },
      );
    }

    const compressedData = buffer.subarray(
      dataStart,
      dataStart + compressedSize,
    );
    let data: Buffer;
    if (method === 0) {
      data = Buffer.from(compressedData);
    } else if (method === 8) {
      try {
        data = inflateRawSync(compressedData);
      } catch (e) {
        throw new BadRequestError(
          `Failed to decompress ZIP entry "${fileName}": ${e instanceof Error ? e.message : String(e)}`,
          { messageKey: 'errors.sources.parse.zipCorrupted' },
        );
      }
    } else {
      throw new BadRequestError(
        `Unsupported ZIP compression method ${method} for entry "${fileName}".`,
        { messageKey: 'errors.sources.parse.zipCorrupted' },
      );
    }

    totalCompressed += compressedSize;
    totalUncompressed += data.length;
    entryCount++;

    const isDirectory = fileName.endsWith('/');
    entryInfos.push({
      fileName,
      compressionMethod: method,
      compressedSize,
      uncompressedSize: data.length,
      isDirectory,
      data,
    });
    if (!isDirectory) {
      entries.set(fileName, data);
    }

    offset = dataStart + compressedSize;

    if (offset === dataStart) {
      break;
    }
  }

  if (entryCount === 0) {
    throw new BadRequestError('Empty ZIP archive or corrupt header.', {
      messageKey: 'errors.sources.parse.zipCorrupted',
    });
  }

  return {
    entries,
    entryInfos,
    entryCount,
    totalCompressed,
    totalUncompressed,
  };
}

export function assertNotArchiveBomb(parsed: ParsedZip): void {
  if (parsed.entryCount > 1000) {
    throw new BadRequestError(
      `Archive bomb detected: entry count ${parsed.entryCount} exceeds limit of 1000.`,
      { messageKey: 'errors.sources.parse.zipCorrupted' },
    );
  }
  if (parsed.totalCompressed > 0) {
    const ratio = parsed.totalUncompressed / parsed.totalCompressed;
    if (ratio > 100) {
      throw new BadRequestError(
        `Archive bomb detected: uncompressed ratio ${ratio.toFixed(1)}x exceeds limit of 100x.`,
        { messageKey: 'errors.sources.parse.zipCorrupted' },
      );
    }
  }
  for (const info of parsed.entryInfos) {
    if (
      info.compressedSize > 0 &&
      info.uncompressedSize / info.compressedSize > 100
    ) {
      throw new BadRequestError(
        `Archive bomb detected: entry "${info.fileName}" ratio exceeds 100x.`,
        { messageKey: 'errors.sources.parse.zipCorrupted' },
      );
    }
  }
}

export function createStoredZipEntry(
  fileName: string,
  content: Buffer,
): Buffer {
  const fileNameBuf = Buffer.from(fileName, 'utf8');
  const header = Buffer.alloc(30);
  header.writeUInt32LE(LOCAL_FILE_HEADER_SIG, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt32LE(0, 14);
  header.writeUInt32LE(content.length, 18);
  header.writeUInt32LE(content.length, 22);
  header.writeUInt16LE(fileNameBuf.length, 26);
  header.writeUInt16LE(0, 28);
  return Buffer.concat([header, fileNameBuf, content]);
}

export function createStoredZip(
  entries: Array<{ name: string; content: Buffer | string }>,
): Buffer {
  const parts: Buffer[] = [];
  for (const e of entries) {
    const content =
      typeof e.content === 'string'
        ? Buffer.from(e.content, 'utf8')
        : e.content;
    parts.push(createStoredZipEntry(e.name, content));
  }
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(END_OF_CENTRAL_DIR_SIG, 0);
  parts.push(eocd);
  return Buffer.concat(parts);
}
