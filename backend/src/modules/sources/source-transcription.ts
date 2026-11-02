import { BadRequestError } from '../../common/errors/domain-error';
import { sources } from '../../database/schema';
import {
  contentHashOf,
  DocumentSection,
  NormalizedDocument,
} from './extraction/document-normalizer.service';
import { CaptionParserService } from './extraction/caption-parser.service';
import type { SourceExtractionService } from './extraction/source-extraction.service';
import type { SourceJobsService } from './jobs/source-jobs.service';
import type { SourceCreationCompletion } from './creation/source-creation-completion';

export async function addTranscript(
  source: typeof sources.$inferSelect,
  transcriptText: string,
  deps: {
    sourceExtractionService: SourceExtractionService;
    creationCompletion: SourceCreationCompletion;
    sourceJobsService: SourceJobsService;
    captionParser?: CaptionParserService;
  },
): Promise<void> {
  const trimmed = transcriptText.trim();
  if (!trimmed) {
    throw new BadRequestError('Transcript text must not be empty', {
      messageKey: 'errors.sources.transcript.empty',
    });
  }

  const captionParser = deps.captionParser ?? new CaptionParserService();
  const segments = captionParser.parse(trimmed, 'auto');
  if (segments.length === 0) {
    throw new BadRequestError(
      'Failed to parse transcript segments from provided text',
      { messageKey: 'errors.sources.transcript.parseFailed' },
    );
  }

  const isYouTube = source.url
    ? deps.sourceExtractionService.isYouTubeUrl(source.url)
    : false;
  const extractionMethod = isYouTube ? 'youtube' : 'transcription';
  const text = segments.map((s) => s.content).join('\n\n');

  const sections: DocumentSection[] = segments.map((seg, idx) => ({
    headingPath: seg.speaker ? [seg.speaker] : [],
    content: seg.content,
    ordinal: idx,
    kind: 'transcript' as const,
    locator: {
      startOffsetMs: seg.startOffsetMs,
      endOffsetMs: seg.endOffsetMs,
      ...(seg.speaker ? { speaker: seg.speaker } : {}),
    },
  }));

  const doc: NormalizedDocument = {
    title: source.title,
    text,
    siteName: isYouTube ? 'YouTube' : undefined,
    extractionMethod,
    contentType: source.contentType ?? 'text/html',
    sourceUrl: source.url ?? undefined,
    canonicalUrl: source.canonicalUrl ?? undefined,
    contentHash: contentHashOf(text),
    sections,
  };

  const quality = deps.creationCompletion.assessDocument(doc);
  await deps.creationCompletion.persistVersion(source.id, doc, quality);
  if (quality.status !== 'degraded') {
    await deps.sourceJobsService.enqueue(source.id);
  }
}

export class SourceTranscription {
  constructor(
    private readonly sourceExtractionService: SourceExtractionService,
    private readonly creationCompletion: SourceCreationCompletion,
    private readonly sourceJobsService: SourceJobsService,
    private readonly captionParser?: CaptionParserService,
  ) {}

  async addTranscript(
    source: typeof sources.$inferSelect,
    transcriptText: string,
  ): Promise<void> {
    return addTranscript(source, transcriptText, {
      sourceExtractionService: this.sourceExtractionService,
      creationCompletion: this.creationCompletion,
      sourceJobsService: this.sourceJobsService,
      captionParser: this.captionParser,
    });
  }
}
