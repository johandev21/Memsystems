const BANNER_VARIANT_WIDTHS = [240, 480, 960, 1920] as const;
const MAX_BANNER_VARIANT_HEIGHT = 1080;
const WEBP_QUALITY = 0.8;

export type BannerVariantWidth = (typeof BANNER_VARIANT_WIDTHS)[number];

export type BannerVariantFiles = Partial<Record<BannerVariantWidth, File>>;

export interface BannerUploadPayload {
  file: File;
  variants: BannerVariantFiles;
}

function toWebpFile(blob: Blob, sourceName: string, width: number): File | null {
  if (blob.type !== "image/webp") return null;
  const baseName = sourceName.replace(/\.[^.]+$/, "") || "banner";
  return new File([blob], `${baseName}-${width}w.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

function drawAtWidth(bitmap: ImageBitmap, width: number): HTMLCanvasElement {
  const scale = Math.min(1, width / bitmap.width, MAX_BANNER_VARIANT_HEIGHT / bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function canvasToWebpBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob && blob.type === "image/webp" ? blob : null),
      "image/webp",
      WEBP_QUALITY,
    );
  });
}

/**
 * Generates responsive WebP variants (480/960/1920 px wide) of an uploaded
 * banner. The original file is passed through untouched so the backend keeps
 * a canonical copy; variant generation is best-effort — if the browser cannot
 * decode or encode WebP, the returned variant set is simply empty and the
 * upload falls back to the single original image.
 */
export async function createBannerVariants(file: File): Promise<BannerUploadPayload> {
  const variants: BannerVariantFiles = {};
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    try {
      await Promise.all(
        BANNER_VARIANT_WIDTHS.map(async (width) => {
          const blob = await canvasToWebpBlob(drawAtWidth(bitmap, width));
          if (blob) {
            const variantFile = toWebpFile(blob, file.name, width);
            if (variantFile) variants[width] = variantFile;
          }
        }),
      );
    } finally {
      bitmap.close();
    }
  } catch {
    // Decoding failed (unsupported format/corrupt file): upload as-is.
  }
  return { file, variants };
}

export function buildBannerSrcSet(
  variants:
    | {
        w240?: string | null;
        w480: string | null;
        w960: string | null;
        w1920: string | null;
      }
    | null
    | undefined,
): string | undefined {
  if (!variants) return undefined;
  const entries: string[] = [];
  if (variants.w240) entries.push(`${variants.w240} 240w`);
  if (variants.w480) entries.push(`${variants.w480} 480w`);
  if (variants.w960) entries.push(`${variants.w960} 960w`);
  if (variants.w1920) entries.push(`${variants.w1920} 1920w`);
  return entries.length > 0 ? entries.join(", ") : undefined;
}
