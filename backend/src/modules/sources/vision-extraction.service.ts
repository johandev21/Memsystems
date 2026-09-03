import { Injectable, Logger, Optional } from '@nestjs/common';
import { generateText } from 'ai';
import { AiService } from '../ai/ai.service';
import { ConnectionService } from '../ai/connection.service';
import {
  ImageRegion,
  VisionExtractionInput,
  VisionExtractionPort,
  VisionExtractionResult,
  VisionSegment,
  VisionSegmentKind,
} from './vision-extraction.port';

export const VISION_EXTRACTION_SYSTEM_PROMPT = `You are a precision document vision extraction assistant.
Analyze the provided image and extract its textual and semantic content into structured segments.

CRITICAL EXTRACTION RULES:
1. Distinguish transcription from interpretation:
   - For readable text, transcribe it faithfully without hallucinating or making up missing/unclear parts.
   - For diagrams, charts, illustrations, photos, or non-textual graphics, use kind "visual_description" to describe what is shown.
2. Do not invent or hallucinate unreadable text. If text is illegible or blurred, omit it or describe the section generally.
3. Output all mathematical and chemical formulas in LaTeX format using $...$ (inline) or $$...$$ (block).
4. Provide normalized bounding box coordinates for 'imageRegion' where:
   - x: horizontal position of top-left corner (0.0 to 1.0)
   - y: vertical position of top-left corner (0.0 to 1.0)
   - width: box width (0.0 to 1.0)
   - height: box height (0.0 to 1.0)
5. Structure the content into an array of segments with the appropriate 'kind':
   - "heading": section headings, titles, subheadings.
   - "text": standard prose, paragraphs, list items, captions.
   - "formula": standalone mathematical expressions, equations, formulas.
   - "visual_description": descriptions of diagrams, graphs, charts, UI elements, images.

Return ONLY a valid JSON object matching this shape:
{
  "title": "Optional inferred document or image title",
  "segments": [
    {
      "kind": "heading" | "text" | "formula" | "visual_description",
      "content": "extracted text or description",
      "confidence": 0.95,
      "imageRegion": { "x": 0.0, "y": 0.0, "width": 1.0, "height": 0.2 }
    }
  ]
}`;

export function parseVisionJson(text: string): {
  title?: string;
  segments: VisionSegment[];
} | null {
  try {
    let clean = text.trim();
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    const jsonStr = clean.slice(start, end + 1);
    const parsed: unknown = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const parsedObj = parsed as Record<string, unknown>;
    const rawSegments = Array.isArray(parsedObj.segments)
      ? (parsedObj.segments as unknown[])
      : [];
    const segments: VisionSegment[] = [];

    for (const rawItem of rawSegments) {
      if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
        continue;
      }
      const item = rawItem as Record<string, unknown>;
      const content =
        typeof item.content === 'string' ? item.content.trim() : '';
      if (!content) continue;

      let kind: VisionSegmentKind = 'text';
      if (
        item.kind === 'heading' ||
        item.kind === 'formula' ||
        item.kind === 'visual_description' ||
        item.kind === 'text'
      ) {
        kind = item.kind;
      }

      let confidence: number | undefined;
      if (
        typeof item.confidence === 'number' &&
        Number.isFinite(item.confidence)
      ) {
        confidence = Math.max(0, Math.min(1, item.confidence));
      }

      let imageRegion: ImageRegion | undefined;
      if (
        item.imageRegion &&
        typeof item.imageRegion === 'object' &&
        !Array.isArray(item.imageRegion)
      ) {
        const region = item.imageRegion as Record<string, unknown>;
        const { x, y, width, height } = region;
        if (
          typeof x === 'number' &&
          Number.isFinite(x) &&
          typeof y === 'number' &&
          Number.isFinite(y) &&
          typeof width === 'number' &&
          Number.isFinite(width) &&
          typeof height === 'number' &&
          Number.isFinite(height)
        ) {
          imageRegion = {
            x: Math.max(0, Math.min(1, x)),
            y: Math.max(0, Math.min(1, y)),
            width: Math.max(0, Math.min(1, width)),
            height: Math.max(0, Math.min(1, height)),
          };
        }
      }

      segments.push({
        kind,
        content,
        confidence,
        imageRegion,
      });
    }

    const title =
      typeof parsedObj.title === 'string' ? parsedObj.title.trim() : undefined;

    return {
      title,
      segments,
    };
  } catch {
    return null;
  }
}

@Injectable()
export class VisionExtractionService implements VisionExtractionPort {
  private readonly logger = new Logger(VisionExtractionService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly connectionService: ConnectionService,
    @Optional()
    private readonly generateTextFn: typeof generateText = generateText,
  ) {}

  async extractVisualDocument(input: {
    buffer: Buffer;
    mimeType: string;
    filename?: string;
    userId?: string;
    modelId?: string;
  }): Promise<VisionExtractionResult> {
    return this.extract({
      imageBuffer: input.buffer,
      mimeType: input.mimeType as 'image/png' | 'image/jpeg' | 'image/webp',
      fileName: input.filename,
      userId: input.userId,
      modelId: input.modelId,
    });
  }

  async extract(input: VisionExtractionInput): Promise<VisionExtractionResult> {
    const modelId = await this.resolveVisionModel(input);
    if (!modelId || !input.userId) {
      return this.deterministicFallback(
        input,
        'Vision model unavailable or not configured. Used fallback descriptor.',
      );
    }

    try {
      const provider = await this.aiService.getProviderForModel(
        modelId,
        input.userId,
      );
      const model = provider.createModel(modelId);
      const requestOptions = this.aiService.getGatewayRequestOptions(
        modelId,
        input.userId,
      );

      const promptText = `Analyze this image and extract its textual and semantic content. Follow all system instructions faithfully.`;

      const result = await this.generateTextFn({
        model,
        instructions: VISION_EXTRACTION_SYSTEM_PROMPT,
        ...requestOptions,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: promptText,
              },
              {
                type: 'image',
                image: input.imageBuffer,
              },
            ],
          },
        ],
      });

      const parsed = parseVisionJson(result.text);
      if (parsed && parsed.segments.length > 0) {
        const rawText = parsed.segments.map((s) => s.content).join('\n\n');
        return {
          title: parsed.title ?? this.inferTitleFromFileName(input.fileName),
          segments: parsed.segments,
          rawText,
        };
      }

      // If parsing failed or gave 0 segments, wrap text response if available
      const rawText = result.text.trim();
      if (rawText.length > 0) {
        return {
          title: this.inferTitleFromFileName(input.fileName),
          segments: [
            {
              kind: 'text',
              content: rawText,
              imageRegion: { x: 0, y: 0, width: 1, height: 1 },
            },
          ],
          rawText,
          warnings: ['Model output could not be parsed as structured JSON.'],
        };
      }

      return this.deterministicFallback(
        input,
        'Model returned empty response. Used fallback descriptor.',
      );
    } catch (err) {
      this.logger.warn(
        `Vision extraction failed with AI model, falling back to deterministic extraction: ${err instanceof Error ? err.message : String(err)}`,
      );
      return this.deterministicFallback(
        input,
        `Vision extraction model error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async resolveVisionModel(
    input: VisionExtractionInput,
  ): Promise<string | null> {
    if (!input.userId) {
      return null;
    }

    try {
      const snapshot = await this.connectionService.snapshot(input.userId);
      const visionModels = snapshot.models.filter(
        (m) => m.capabilities?.imageInput === true,
      );

      if (input.modelId) {
        const found = visionModels.find((m) => m.id === input.modelId);
        if (found) return found.id;
      }

      if (visionModels.length > 0) {
        return visionModels[0].id;
      }
    } catch (err) {
      this.logger.debug(
        `Could not resolve vision model: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return null;
  }

  private inferTitleFromFileName(fileName?: string): string {
    if (!fileName) return 'Image Document';
    return fileName.replace(/\.[^/.]+$/, '').trim() || 'Image Document';
  }

  deterministicFallback(
    input: VisionExtractionInput,
    reason?: string,
  ): VisionExtractionResult {
    const title = this.inferTitleFromFileName(input.fileName);
    const content = `[Image: ${input.fileName || 'image'}]`;

    return {
      title,
      rawText: content,
      segments: [
        {
          kind: 'visual_description',
          content,
          imageRegion: { x: 0, y: 0, width: 1, height: 1 },
        },
      ],
      warnings: [
        reason ??
          'Vision model unavailable or not configured. Used fallback descriptor.',
      ],
    };
  }
}
