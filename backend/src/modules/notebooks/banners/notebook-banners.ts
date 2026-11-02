import { createHash } from 'node:crypto';
import { notebooks } from '../../../database/schema';
import type { GroundingMode } from '../../../database/schema';
import { BadRequestError } from '../../../common/errors/domain-error';
import { StorageService } from '../../storage/storage.service';
import { DEFAULT_GROUNDING_MODE, isGroundingMode } from '../grounding-mode';
import { PRESET_BANNER_PREFIX, presetBannerVariants } from '../preset-banners';

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_BANNER_BYTES = 2 * 1024 * 1024;
export const BANNER_PRESIGN_TTL = 86400;

export const BANNER_VARIANT_WIDTHS = [240, 480, 960, 1920] as const;
export type BannerVariantWidth = (typeof BANNER_VARIANT_WIDTHS)[number];

export interface BannerVariantKeys {
  w240?: string;
  w480?: string;
  w960?: string;
  w1920?: string;
}

export interface BannerVariantUpload {
  width: BannerVariantWidth;
  buffer: Buffer;
  contentType: string;
}

export interface BannerVariantUrls {
  w240: string | null;
  w480: string | null;
  w960: string | null;
  w1920: string | null;
}

export interface BannerUploadResponse {
  s3Key: string;
  uploadUrl: string;
  bannerUrl: string;
}

export interface NotebookResponse {
  id: string;
  title: string;
  description: string;
  icon: string;
  folderId: string | null;
  banner: string | null;
  bannerUrl: string | null;
  bannerVariants: BannerVariantUrls | null;
  bannerFocalPoint: { x: number; y: number } | null;
  groundingMode: GroundingMode;
  createdAt: Date;
  updatedAt: Date;
}

export function toNotebookResponse(
  nb: typeof notebooks.$inferSelect,
): NotebookResponse {
  return {
    id: nb.id,
    title: nb.title,
    description: nb.description ?? '',
    icon: nb.icon ?? 'notebook',
    folderId: nb.folderId ?? null,
    banner: nb.banner,
    bannerUrl: null,
    bannerVariants: null,
    bannerFocalPoint: nb.bannerFocalPoint ?? null,
    groundingMode: isGroundingMode(nb.groundingMode)
      ? nb.groundingMode
      : DEFAULT_GROUNDING_MODE,
    createdAt: nb.createdAt,
    updatedAt: nb.updatedAt,
  };
}

export async function presignBannerVariants(
  storageService: StorageService,
  keys: BannerVariantKeys | null | undefined,
): Promise<BannerVariantUrls | null> {
  if (!keys) return null;
  const presign = (key?: string) =>
    key ? storageService.presignDownload(key, BANNER_PRESIGN_TTL) : null;
  const [w240, w480, w960, w1920] = await Promise.all([
    presign(keys.w240),
    presign(keys.w480),
    presign(keys.w960),
    presign(keys.w1920),
  ]);
  if (!w240 && !w480 && !w960 && !w1920) return null;
  return { w240, w480, w960, w1920 };
}

export async function resolveNotebookBannerUrls(
  storageService: StorageService,
  banner: string | null,
  bannerVariants: BannerVariantKeys | null | undefined,
): Promise<{
  bannerUrl: string | null;
  bannerVariants: BannerVariantUrls | null;
}> {
  const presetId = banner?.startsWith(PRESET_BANNER_PREFIX)
    ? banner.slice(PRESET_BANNER_PREFIX.length)
    : null;
  const bannerUrl = presetId
    ? presetBannerVariants(presetId).w1920
    : banner
      ? await storageService.presignDownload(banner, BANNER_PRESIGN_TTL)
      : null;
  const variants = presetId
    ? presetBannerVariants(presetId)
    : await presignBannerVariants(storageService, bannerVariants);
  return { bannerUrl, bannerVariants: variants };
}

export async function formatNotebookResponse(
  storageService: StorageService,
  nb: typeof notebooks.$inferSelect,
): Promise<NotebookResponse> {
  const res = toNotebookResponse(nb);
  const urls = await resolveNotebookBannerUrls(
    storageService,
    nb.banner,
    nb.bannerVariants,
  );
  res.bannerUrl = urls.bannerUrl;
  res.bannerVariants = urls.bannerVariants;
  return res;
}

export function pickExtension(originalName: string): string {
  const idx = originalName.lastIndexOf('.');
  if (idx === -1 || idx === originalName.length - 1) return '';
  return originalName.slice(idx).toLowerCase();
}

export function staleVariantKeys(
  previous: BannerVariantKeys | null | undefined,
  next: BannerVariantKeys | null,
): BannerVariantKeys | null {
  if (!previous) return null;
  const nextValues = new Set(next ? Object.values(next) : []);
  const stale: BannerVariantKeys = {};
  if (previous.w240 && !nextValues.has(previous.w240))
    stale.w240 = previous.w240;
  if (previous.w480 && !nextValues.has(previous.w480))
    stale.w480 = previous.w480;
  if (previous.w960 && !nextValues.has(previous.w960))
    stale.w960 = previous.w960;
  if (previous.w1920 && !nextValues.has(previous.w1920)) {
    stale.w1920 = previous.w1920;
  }
  return Object.keys(stale).length > 0 ? stale : null;
}

export async function deleteBannerVariantObjects(
  storageService: StorageService,
  keys: BannerVariantKeys | null | undefined,
): Promise<void> {
  if (!keys) return;
  const allKeys = [keys.w240, keys.w480, keys.w960, keys.w1920].filter(
    (key): key is string => Boolean(key),
  );
  await Promise.all(
    allKeys.map((key) => storageService.deleteObject(key).catch(() => {})),
  );
}

export async function deleteCustomBannerObject(
  storageService: StorageService,
  banner: string | null | undefined,
): Promise<void> {
  if (banner && !banner.startsWith(PRESET_BANNER_PREFIX)) {
    await storageService.deleteObject(banner).catch(() => {});
  }
}

export async function deleteNotebookBannerStorage(
  storageService: StorageService,
  banner: string | null | undefined,
  bannerVariants: BannerVariantKeys | null | undefined,
): Promise<void> {
  await deleteCustomBannerObject(storageService, banner);
  await deleteBannerVariantObjects(storageService, bannerVariants);
}

export async function uploadBannerWithVariants(
  storageService: StorageService,
  fileBuffer: Buffer,
  fileName: string,
  fileType: string,
  variants: BannerVariantUpload[] = [],
): Promise<{ key: string; variantKeys: BannerVariantKeys | null }> {
  if (fileBuffer.length === 0) {
    throw new BadRequestError('Uploaded file is empty', {
      messageKey: 'errors.notebooks.banner.fileEmpty',
    });
  }
  if (fileBuffer.length > MAX_BANNER_BYTES) {
    throw new BadRequestError('Banner image exceeds maximum size of 2 MB', {
      messageKey: 'errors.notebooks.banner.tooLarge',
    });
  }
  if (!ACCEPTED_IMAGE_TYPES.includes(fileType)) {
    throw new BadRequestError(
      `Unsupported file type: ${fileType || 'unknown'}. Accepted: JPEG, PNG, WebP`,
      {
        messageKey: 'errors.notebooks.banner.unsupportedType',
        params: { fileType: fileType || 'unknown' },
      },
    );
  }

  const sha256 = createHash('sha256').update(fileBuffer).digest('hex');
  const ext = pickExtension(fileName);
  const key = `banners/${sha256}${ext}`;

  const validVariants = variants.filter(
    (variant) =>
      BANNER_VARIANT_WIDTHS.includes(variant.width) &&
      variant.buffer.length > 0 &&
      variant.buffer.length <= MAX_BANNER_BYTES &&
      variant.contentType === 'image/webp',
  );
  const variantKeys: BannerVariantKeys | null = validVariants.length
    ? Object.fromEntries(
        validVariants.map((variant) => [
          `w${variant.width}`,
          `banners/${sha256}-${variant.width}w.webp`,
        ]),
      )
    : null;

  await storageService.putObject({
    key,
    body: fileBuffer,
    contentType: fileType,
  });

  await Promise.all(
    validVariants.map((variant) =>
      storageService.putObject({
        key: `banners/${sha256}-${variant.width}w.webp`,
        body: variant.buffer,
        contentType: variant.contentType,
      }),
    ),
  );

  return { key, variantKeys };
}

export async function cleanupStaleBannerStorage(
  storageService: StorageService,
  existing:
    | {
        banner: string | null;
        bannerVariants: BannerVariantKeys | null;
      }
    | undefined,
  newKey: string,
  newVariantKeys: BannerVariantKeys | null,
): Promise<void> {
  if (
    existing?.banner &&
    !existing.banner.startsWith(PRESET_BANNER_PREFIX) &&
    existing.banner !== newKey
  ) {
    await storageService.deleteObject(existing.banner).catch(() => {});
  }
  if (existing) {
    const staleKeys = staleVariantKeys(existing.bannerVariants, newVariantKeys);
    await deleteBannerVariantObjects(storageService, staleKeys);
  }
}
