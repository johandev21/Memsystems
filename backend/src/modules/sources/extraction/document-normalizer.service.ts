import { Injectable } from '@nestjs/common';
import type { ScrapedPage } from '../acquisition/web-scraper.service';
import type {
  FirecrawlDocumentInput,
  FirecrawlMetaInput,
  ParsedFileDocument,
} from '../../crawler/crawler.types';
import type { VisionExtractionResult } from './vision-extraction.port';
import type { TranscriptionResult } from './transcription.port';
import type { YouTubeAcquisitionResult } from '../acquisition/youtube-acquisition.service';
import type { PptxParseResult } from './pptx-parser.service';
import type { EpubParseResult } from './epub-parser.service';
import type { ParsedTabularResult } from './tabular-parser.service';
import {
  fromText,
  fromFile,
  fromHtml,
  fromFirecrawlResult,
  fromParsedFileResult,
} from './normalization/text-web';
import { fromImageResult } from './normalization/image';
import { fromAudioResult, fromVideoResult } from './normalization/audio-video';
import {
  fromYouTubeResult,
  fromPptxResult,
  fromEpubResult,
  fromTabularResult,
} from './normalization/publication-tabular';
import type {
  NormalizedDocument,
  FileDocumentInput,
  ImageDocumentOptions,
  AudioDocumentOptions,
  VideoDocumentOptions,
  YouTubeDocumentOptions,
  PptxDocumentOptions,
  EpubDocumentOptions,
  TabularDocumentOptions,
} from './normalization/document.types';
export * from './normalization/document.types';
export { contentHashOf } from './normalization/document-normalization';
export { sectionsFromHtml } from './normalization/html-sections';
export { sectionsFromMarkdown } from './normalization/markdown-sections';

@Injectable()
export class DocumentNormalizerService {
  fromText(text: string, title: string): NormalizedDocument {
    return fromText(text, title);
  }
  fromFile(input: FileDocumentInput): NormalizedDocument {
    return fromFile(input);
  }
  fromHtml(
    page: ScrapedPage,
    meta: {
      sourceUrl: string;
      canonicalUrl?: string;
      fetchedUrl?: string;
      contentType?: string;
    },
  ): NormalizedDocument {
    return fromHtml(page, meta);
  }
  fromFirecrawlResult(
    doc: FirecrawlDocumentInput,
    meta: FirecrawlMetaInput,
  ): NormalizedDocument {
    return fromFirecrawlResult(doc, meta);
  }
  fromParsedFileResult(
    doc: ParsedFileDocument,
    meta: { fileName: string; contentType: string },
  ): NormalizedDocument {
    return fromParsedFileResult(doc, meta);
  }
  fromImageResult(
    result: VisionExtractionResult,
    options: ImageDocumentOptions = {},
  ): NormalizedDocument {
    return fromImageResult(result, options);
  }
  fromAudioResult(
    result: TranscriptionResult,
    options: AudioDocumentOptions = {},
  ): NormalizedDocument {
    return fromAudioResult(result, options);
  }
  fromVideoResult(
    result: TranscriptionResult,
    options: VideoDocumentOptions = {},
  ): NormalizedDocument {
    return fromVideoResult(result, options);
  }
  fromYouTubeResult(
    result: YouTubeAcquisitionResult,
    options: YouTubeDocumentOptions = {},
  ): NormalizedDocument {
    return fromYouTubeResult(result, options);
  }
  fromPptxResult(
    result: PptxParseResult,
    options: PptxDocumentOptions = {},
  ): NormalizedDocument {
    return fromPptxResult(result, options);
  }
  fromEpubResult(
    result: EpubParseResult,
    options: EpubDocumentOptions = {},
  ): NormalizedDocument {
    return fromEpubResult(result, options);
  }
  fromTabularResult(
    result: ParsedTabularResult,
    options: TabularDocumentOptions = {},
  ): NormalizedDocument {
    return fromTabularResult(result, options);
  }
}
