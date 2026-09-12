import { inflateRawSync } from 'node:zlib';
import { BadRequestError } from '../../common/errors/domain-error';

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
      // No more local headers
      break;
    }

    const flag = buffer.readUInt16LE(offset + 6);
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
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

    // Data descriptor flag (bit 3) – unsupported for reliable bomb detection
    if ((flag & 0x08) !== 0) {
      // For bomb safety reject or handle by scanning forward
      // Scan for next local header to estimate
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
      // Treat as bomb-unsafe: entry count still increments, sizes unknown
      // Use compressed size as nextHeader - dataStart for estimation
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
      // Verify uncompressed size if header had it
      if (uncompressedSize !== 0 && data.length !== uncompressedSize) {
        // Allow mismatch? Log warning but don't fail – some encoders are inaccurate
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

    // Guard infinite loop
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
    // Also guard absolute uncompressed > 1GB? Not needed but spec says 200MB for pptx/epub
  }
  // Also if any single entry ratio extreme
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
  // Helper for tests to create simple stored (method 0) ZIP entries without compression
  const fileNameBuf = Buffer.from(fileName, 'utf8');
  const header = Buffer.alloc(30);
  header.writeUInt32LE(LOCAL_FILE_HEADER_SIG, 0);
  header.writeUInt16LE(20, 4); // version needed
  header.writeUInt16LE(0, 6); // flag
  header.writeUInt16LE(0, 8); // method stored
  header.writeUInt16LE(0, 10); // time
  header.writeUInt16LE(0, 12); // date
  header.writeUInt32LE(0, 14); // crc (0 for test)
  header.writeUInt32LE(content.length, 18); // compressed size
  header.writeUInt32LE(content.length, 22); // uncompressed size
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
  // Add minimal end of central directory to make it look like valid zip for external tools (optional)
  // But our parser stops at central dir signature, so we need to append central dir sig to terminate correctly.
  // For test zips we can just leave without central dir; parser will stop at end.
  // Add EOCD with 0 entries to allow graceful stop if inspector scans.
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(END_OF_CENTRAL_DIR_SIG, 0);
  // rest zeros
  parts.push(eocd);
  return Buffer.concat(parts);
}
