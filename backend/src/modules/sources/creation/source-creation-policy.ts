export const MAX_RAW_TEXT_BYTES = 5 * 1024 * 1024;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export function lifecycleValues(
  modality:
    | 'document'
    | 'audio'
    | 'video'
    | 'image'
    | 'slides'
    | 'ebook'
    | 'code'
    | 'dataset',
  stage: 'uploading' | 'extracting' | 'indexing',
): Record<string, unknown> {
  return {
    modality,
    processingStatus: 'pending',
    processingStage: stage,
    processingErrorCode: null,
    processingErrorMessage: null,
  };
}

export function buildS3Key(
  _notebookId: string,
  sha256: string,
  originalName: string,
): string {
  const extension = pickExtension(originalName);
  return `sources/${sha256}${extension}`;
}

function pickExtension(originalName: string): string {
  const index = originalName.lastIndexOf('.');
  if (index === -1 || index === originalName.length - 1) return '';
  return originalName.slice(index).toLowerCase();
}

export function resolveSourceTitle(
  providedTitle?: string,
  scrapedTitle?: string,
): string {
  const provided = providedTitle?.trim();
  const scraped = scrapedTitle?.trim();

  if (provided && !looksLikeUrlTitle(provided)) return provided.slice(0, 500);
  if (scraped && !looksLikeUrlTitle(scraped)) return scraped.slice(0, 500);
  return (provided || scraped || 'Untitled').slice(0, 500);
}

function looksLikeUrlTitle(title: string): boolean {
  if (/^https?:\/\//i.test(title)) return true;
  return /^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(title);
}
