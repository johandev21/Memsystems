import {
  isAudioFile,
  MAX_AUDIO_BYTES,
} from './extraction/audio-inspector.service';
import {
  isImageFile,
  MAX_IMAGE_BYTES,
} from './extraction/image-inspector.service';
import {
  isVideoFile,
  MAX_VIDEO_BYTES,
} from './extraction/video-inspector.service';
import {
  isPptxFile,
  MAX_PPTX_BYTES,
} from './extraction/pptx-inspector.service';
import {
  isEpubFile,
  MAX_EPUB_BYTES,
} from './extraction/epub-inspector.service';
import {
  isTabularFile,
  MAX_TABULAR_BYTES,
} from './extraction/tabular-inspector.service';

export type SourceModality =
  'document' | 'audio' | 'video' | 'image' | 'slides' | 'ebook' | 'dataset';

export interface ClassifiedSourceFile {
  modality: SourceModality;
  maxBytes: number;
}

export function classifySourceFile(
  contentType: string,
  filename: string,
  fallbackMaxBytes: number,
  includeTabular = true,
): ClassifiedSourceFile {
  const isVideo = isVideoFile(contentType, filename);
  const isAudio = isAudioFile(contentType, filename);
  const isImage = isImageFile(contentType, filename);
  const isPptx = isPptxFile(contentType, filename);
  const isEpub = isEpubFile(contentType, filename);
  const isTabular = includeTabular && isTabularFile(contentType, filename);
  return {
    modality: isVideo
      ? 'video'
      : isAudio
        ? 'audio'
        : isImage
          ? 'image'
          : isPptx
            ? 'slides'
            : isEpub
              ? 'ebook'
              : isTabular
                ? 'dataset'
                : 'document',
    maxBytes: isVideo
      ? MAX_VIDEO_BYTES
      : isAudio
        ? MAX_AUDIO_BYTES
        : isImage
          ? MAX_IMAGE_BYTES
          : isPptx
            ? MAX_PPTX_BYTES
            : isEpub
              ? MAX_EPUB_BYTES
              : isTabular
                ? MAX_TABULAR_BYTES
                : fallbackMaxBytes,
  };
}
