export type VisionSegmentKind =
  'text' | 'heading' | 'formula' | 'visual_description';

export interface ImageRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisionSegment {
  kind: VisionSegmentKind;
  content: string;
  confidence?: number;
  imageRegion?: ImageRegion;
}

export interface VisionExtractionInput {
  imageBuffer: Buffer;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  fileName?: string;
  modelId?: string;
}

export interface VisionExtractionResult {
  segments: VisionSegment[];
  rawText: string;
  title?: string;
  warnings?: string[];
  confidence?: number;
}

export interface VisionExtractionPort {
  extract(input: VisionExtractionInput): Promise<VisionExtractionResult>;
}

export const VISION_EXTRACTION_PORT = Symbol('VISION_EXTRACTION_PORT');
